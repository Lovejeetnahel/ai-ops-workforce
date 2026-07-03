import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Payment } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProviderFactory } from '../integrations/provider-factory.service';
import { EventBus } from '../automation/event-bus';
import { DomainEvents } from '../automation/events';
import { tenantContext } from '../common/tenancy/tenant-context';
import { ValueLedgerService } from '../control/value-ledger.service';

/**
 * End-to-end payment tracking. Issues hosted payment links for invoices (Stripe
 * PaymentPort), records offline payments, and settles payments from provider
 * webhooks. Every settlement books REVENUE_COLLECTED to the Value Ledger
 * directly (unconditionally — this is the authoritative source for "money
 * actually collected") AND emits `payment.succeeded`, which the Control Layer
 * uses to resolve any matching open DecisionRecord (AI-attribution bookkeeping)
 * without booking a second, duplicate ledger entry for the same payment.
 *
 * Found via live verification: revenue collected through a directly
 * staff-initiated invoice (no preceding AI/automation decision) was silently
 * never recorded to the Value Ledger, because booking only happened inside the
 * Control Layer's decision-resolution loop — undercounting the Enterprise
 * Analytics "Revenue" KPI, which sums ValueLedgerEntry credits.
 */
@Injectable()
export class PaymentsService implements OnModuleInit {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderFactory,
    private readonly bus: EventBus,
    private readonly ledger: ValueLedgerService,
  ) {}

  onModuleInit() {
    // Don't block NestJS startup; sweep runs asynchronously within seconds.
    this.sweepPendingPayments().catch((err) =>
      this.logger.warn(`Startup PENDING sweep error: ${(err as Error).message}`),
    );
  }

  /** Issue a hosted payment link for an invoice + create a PENDING payment. */
  async createPaymentLink(documentId: string) {
    // Guard against double-send: if a PENDING payment already exists for this document
    // (e.g. "Send" clicked twice or request retried), return the existing URL instead of
    // issuing a second Stripe link. Two active links for the same invoice let the customer
    // pay twice, doubling the revenue booked for a single invoice.
    const existing = await this.prisma.db.payment.findFirst({ where: { documentId, status: 'PENDING' } });
    if (existing) {
      const existingDoc = await this.prisma.db.document.findUniqueOrThrow({ where: { id: documentId } });
      return { url: (existingDoc.data as any)?.payUrl ?? '', paymentId: existing.id };
    }

    const doc = await this.prisma.db.document.findUniqueOrThrow({ where: { id: documentId }, include: { contact: true } });
    const amount = doc.amount ? Number(doc.amount) : 0;
    if (amount <= 0) throw new BadRequestException('Document has no payable amount');

    const provider = await this.providers.payment(tenantContext.tenantId);
    const link = await provider.createInvoice({
      amount,
      currency: 'usd',
      description: doc.title,
      customerEmail: doc.contact?.email ?? undefined,
    });

    const payment = await this.prisma.db.payment.create({
      data: {
        contactId: doc.contactId ?? null,
        documentId: doc.id,
        amount,
        currency: 'usd',
        status: 'PENDING',
        provider: 'STRIPE',
        externalRef: link.id,
      } as any,
    });

    await this.prisma.db.document.update({
      where: { id: doc.id },
      data: { status: 'SENT', data: { ...(doc.data as any), payUrl: link.url, paymentId: payment.id } },
    });

    return { url: link.url, paymentId: payment.id };
  }

  /**
   * Record an offline payment (cash/check/manual) and settle the document.
   * Idempotent per document: found via concurrency load testing, 5 concurrent
   * calls for the SAME invoice each independently saw no existing payment and
   * each created + settled their own — 5 SUCCEEDED payments and 5x
   * REVENUE_COLLECTED booked for one $500 invoice ($2,500 total). A Postgres
   * transaction-scoped advisory lock keyed on the document serializes
   * attempts, and the existence check covers PENDING as well as SUCCEEDED
   * (not just SUCCEEDED) because the winning caller's own payment is created
   * PENDING and only flips to SUCCEEDED after this transaction commits — a
   * concurrent caller arriving in that gap must still see it as claimed.
   */
  async recordOffline(documentId: string, opts: { amount?: number; method?: string } = {}) {
    const claim = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', documentId);
      const existing = await tx.payment.findFirst({ where: { documentId, status: { in: ['PENDING', 'SUCCEEDED'] } } });
      if (existing) return { alreadyClaimed: true as const, payment: existing };

      const doc = await tx.document.findUniqueOrThrow({ where: { id: documentId } });
      const docAmount = doc.amount ? Number(doc.amount) : 0;
      const amount = opts.amount ?? docAmount;
      if (amount <= 0) throw new BadRequestException('Payment amount must be greater than zero');
      if (opts.amount !== undefined && docAmount > 0 && opts.amount > docAmount * 2) {
        throw new BadRequestException(`Payment amount ${opts.amount} exceeds invoice total ${docAmount} by more than 2×`);
      }
      // Created PENDING (not SUCCEEDED) so settle()'s own status-transition
      // check is meaningful — it must see the pre-settlement state to know
      // this is the first time this payment is being settled and book
      // revenue exactly once.
      const payment = await tx.payment.create({
        data: {
          tenantId: doc.tenantId,
          contactId: doc.contactId ?? null,
          documentId: doc.id,
          amount,
          currency: 'usd',
          status: 'PENDING',
          provider: 'STRIPE',
          externalRef: opts.method ?? 'manual',
        } as any,
      });
      return { alreadyClaimed: false as const, payment, documentId: doc.id };
    });

    if (claim.alreadyClaimed) return claim.payment;

    await this.settle(claim.documentId, claim.payment, opts.method ?? 'manual', `offline:${claim.payment.id}`);
    return this.prisma.db.payment.findUniqueOrThrow({ where: { id: claim.payment.id } });
  }

  /** Settle from a Stripe webhook. Idempotent + tenant-scoped by the caller. */
  async handleWebhook(rawBody: string, signature: string) {
    const provider = await this.providers.payment(tenantContext.tenantId);
    const evt = provider.parseWebhook(rawBody, signature); // throws on invalid/missing signature
    if (!evt.succeeded) return { received: true, settled: false };

    // Match the pending payment by the object reference, else by amount.
    let payment = evt.reference
      ? await this.prisma.db.payment.findFirst({ where: { externalRef: evt.reference, status: 'PENDING' } })
      : null;
    if (!payment && evt.amount) {
      payment = await this.prisma.db.payment.findFirst({
        where: { status: 'PENDING', amount: evt.amount },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (!payment) {
      this.logger.warn(`Stripe webhook ${evt.type} matched no pending payment (ref=${evt.reference})`);
      return { received: true, settled: false };
    }

    await this.settle(payment.documentId, payment, 'stripe', evt.externalId);
    return { received: true, settled: true, paymentId: payment.id };
  }

  /**
   * Mark payment SUCCEEDED, document PAID, book the revenue, and emit
   * payment.succeeded once. Idempotent against concurrent calls: uses a
   * compare-and-swap (updateMany WHERE status='PENDING') as the atomic claim
   * gate inside the transaction. Only the caller whose updateMany returns
   * count=1 writes the ValueLedgerEntry — concurrent settle() calls for the
   * same payment (e.g. duplicate Stripe webhook deliveries) both enter the
   * transaction but only one finds a PENDING row to flip.
   *
   * Found via Phase D load testing: the prior code read alreadySucceeded BEFORE
   * entering the transaction. Two concurrent webhooks for the same payment both
   * read PENDING, both set alreadySucceeded=false, both entered the transaction
   * and both wrote a ValueLedgerEntry — $1,998 booked for a $999 invoice (2× the
   * correct amount). The CAS here closes that window.
   */
  private async settle(documentId: string | null, payment: Payment, source: string, externalId: string) {
    let booked = false;
    await this.prisma.$transaction(async (tx) => {
      if (payment.status !== 'SUCCEEDED') {
        // Atomic claim: only one concurrent caller will find a PENDING row to flip.
        const claimed = await tx.payment.updateMany({
          where: { id: payment.id, status: 'PENDING' },
          data: { status: 'SUCCEEDED' },
        });
        booked = claimed.count > 0;
        if (booked) {
          await tx.valueLedgerEntry.create({
            data: {
              tenantId: (payment as any).tenantId,
              valueType: 'REVENUE_COLLECTED',
              direction: 'CREDIT',
              amount: Number(payment.amount),
              actionType: 'payment',
              source,
              decisionId: null,
              agent: null,
            } as any,
          });
        }
      }
      if (documentId) {
        // Document PAID update is safe to repeat (idempotent PAID→PAID).
        await tx.document.update({ where: { id: documentId }, data: { status: 'PAID' } });
      }
    });
    // Emit after commit. EventBus dedupes on (tenant, source, externalId) so
    // the second concurrent webhook's bus.emit() is a silent no-op.
    await this.bus.emit({
      name: DomainEvents.PAYMENT_SUCCEEDED,
      tenantId: tenantContext.tenantId,
      source,
      externalId,
      payload: {
        payment: { id: payment.id, amount: Number(payment.amount) },
        document: documentId ? { id: documentId } : undefined,
        contact: payment.contactId ? { id: payment.contactId } : undefined,
      },
    });
  }

  /**
   * On startup, find PENDING manual payments older than 5 minutes whose
   * settle() call was interrupted by a crash. Recovers each atomically using
   * the same advisory lock as recordOffline() — a concurrent recordOffline() or
   * a second API instance doing the same sweep will block until this transaction
   * commits, then find the payment already SUCCEEDED and skip it.
   */
  private async sweepPendingPayments() {
    // No tenant context: extension guard (`if (!tenantId) return query(args)`)
    // passes the findMany through without modification, returning all tenants.
    const stale = await this.prisma.db.payment.findMany({
      where: { status: 'PENDING', externalRef: 'manual', createdAt: { lt: new Date(Date.now() - 5 * 60_000) } },
      take: 100,
    });
    for (const payment of stale as any[]) {
      try {
        await tenantContext.run({ tenantId: payment.tenantId }, async () => {
          // this.prisma.$transaction (base PrismaClient, not the extended .db)
          // so tx delegates bypass the tenant extension entirely — correct for
          // a cross-tenant startup sweep that needs to write by id only.
          await this.prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', payment.documentId ?? payment.id);
            const fresh = await tx.payment.findFirst({ where: { id: payment.id, status: 'PENDING' } });
            if (!fresh) return; // settled concurrently by another instance
            await tx.payment.update({ where: { id: payment.id }, data: { status: 'SUCCEEDED' } });
            if (payment.documentId) {
              await tx.document.update({ where: { id: payment.documentId }, data: { status: 'PAID' } });
            }
            await tx.valueLedgerEntry.create({
              data: {
                tenantId: payment.tenantId,
                valueType: 'REVENUE_COLLECTED',
                direction: 'CREDIT',
                amount: Number(payment.amount),
                actionType: 'payment',
                source: 'manual',
                decisionId: null,
                agent: null,
              } as any,
            });
          });
          await this.bus.emit({
            name: DomainEvents.PAYMENT_SUCCEEDED,
            tenantId: payment.tenantId,
            source: 'manual',
            externalId: `offline:${payment.id}`,
            payload: {
              payment: { id: payment.id, amount: Number(payment.amount) },
              document: payment.documentId ? { id: payment.documentId } : undefined,
              contact: payment.contactId ? { id: payment.contactId } : undefined,
            },
          });
        });
      } catch (err) {
        this.logger.warn(`PENDING sweep failed for payment ${payment.id}: ${(err as Error).message}`);
      }
    }
    if (stale.length > 0) this.logger.warn(`Startup sweep recovered ${stale.length} dangling PENDING payment(s)`);
  }

  list(filter: { status?: any } = {}) {
    return this.prisma.db.payment.findMany({
      where: { ...(filter.status ? { status: filter.status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
