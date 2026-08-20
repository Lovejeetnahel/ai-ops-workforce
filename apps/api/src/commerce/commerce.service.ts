import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { DocumentsService, LineItemInput } from '../revenue/documents.service';
import { tenantContext } from '../common/tenancy/tenant-context';

/**
 * Sprint 4: the COMMERCE operating core, activated on the EXISTING Sales +
 * Payments architecture — zero new money models. Products/services are
 * ServiceOfferings, estimates are Document QUOTEs with line items, invoices
 * are Document INVOICEs, payment truth lives in PaymentsService (Stripe
 * webhook or offline entry), and revenue lands in the Value Ledger with
 * DIRECT attribution — feeding the existing Goal/KPI/ROI engines untouched.
 * This service only CONNECTS the chain:
 *   Customer → Opportunity → Estimate → Acceptance → Invoice → Payment → ROI
 */
@Injectable()
export class CommerceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: DocumentsService,
  ) {}

  /** The sellable catalog (reuses appointment ServiceOfferings — one list). */
  catalog() {
    return this.prisma.db.serviceOffering.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' } });
  }

  /**
   * Create an estimate (QUOTE) for an opportunity from catalog items and/or
   * custom lines. Prices come from the real ServiceOffering rows.
   */
  async createEstimate(input: {
    leadId?: string;
    contactId?: string;
    title?: string;
    items: Array<{ serviceId?: string; description?: string; quantity?: number; unitPrice?: number }>;
  }) {
    if (!input.items?.length) throw new BadRequestException('At least one line item is required');
    const lineItems: LineItemInput[] = [];
    for (const item of input.items) {
      if (item.serviceId) {
        const svc = await this.prisma.db.serviceOffering.findFirst({ where: { id: item.serviceId } });
        if (!svc) throw new BadRequestException(`Unknown service: ${item.serviceId}`);
        lineItems.push({
          description: item.description ?? svc.name,
          quantity: item.quantity ?? 1,
          unitPrice: item.unitPrice ?? (svc.priceCents != null ? svc.priceCents / 100 : 0),
        });
      } else {
        if (!item.description || item.unitPrice == null)
          throw new BadRequestException('Custom lines need description and unitPrice');
        lineItems.push({ description: item.description, quantity: item.quantity ?? 1, unitPrice: item.unitPrice });
      }
    }
    if (lineItems.every((li) => (li.quantity ?? 1) * li.unitPrice <= 0))
      throw new BadRequestException('Estimate total must be greater than zero (set service prices in the catalog first)');
    return this.documents.createQuote({
      leadId: input.leadId,
      contactId: input.contactId,
      title: input.title ?? 'Estimate',
      lineItems,
    });
  }

  /**
   * The full commerce timeline for one opportunity — every link in the chain
   * with its REAL state. Nothing is synthesized: absent stages simply are not
   * there yet.
   */
  async flow(leadId: string) {
    const lead = await this.prisma.db.lead.findFirst({
      where: { id: leadId },
      include: { contact: { select: { id: true, name: true, phone: true, email: true } } },
    });
    if (!lead) throw new NotFoundException('Opportunity not found');
    const [documents, activities] = await Promise.all([
      this.prisma.db.document.findMany({
        where: { leadId },
        include: { lineItems: true, payments: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.db.activity.findMany({ where: { leadId }, orderBy: { createdAt: 'desc' }, take: 30 }),
    ]);
    const estimates = documents.filter((d) => d.type === 'QUOTE');
    const invoices = documents.filter((d) => d.type === 'INVOICE');
    const payments = documents.flatMap((d) => d.payments);
    const collected = payments.filter((p) => p.status === 'SUCCEEDED').reduce((sum, p) => sum + Number(p.amount), 0);
    return {
      opportunity: {
        id: lead.id,
        stage: lead.stage,
        source: lead.source,
        estimatedValue: lead.estimatedValue != null ? Number(lead.estimatedValue) : null,
        actualValue: lead.actualValue != null ? Number(lead.actualValue) : null,
        wonAt: lead.wonAt,
      },
      customer: lead.contact,
      estimates: estimates.map((d) => this.docSummary(d)),
      invoices: invoices.map((d) => this.docSummary(d)),
      payments: payments.map((p) => ({ id: p.id, amount: Number(p.amount), status: p.status, provider: p.provider, createdAt: p.createdAt })),
      revenue: {
        collected,
        attribution: 'DIRECT',
        note: 'Collected = provider-confirmed or staff-recorded payments only. Feeds the Value Ledger, Goals/KPIs and ROI automatically.',
      },
      timeline: activities.map((a) => ({ id: a.id, type: a.type, title: a.title, status: a.status, createdAt: a.createdAt })),
    };
  }

  /** Real commerce funnel numbers across the tenant. */
  async stats() {
    const db = this.prisma.db;
    const [quotes, invoices, paidAgg] = await Promise.all([
      db.document.groupBy({ by: ['status'], where: { type: 'QUOTE' }, _count: true }),
      db.document.groupBy({ by: ['status'], where: { type: 'INVOICE' }, _count: true, _sum: { amount: true } }),
      db.payment.aggregate({ where: { status: 'SUCCEEDED' }, _sum: { amount: true }, _count: true }),
    ]);
    const q = (status: string) => quotes.find((x) => x.status === status)?._count ?? 0;
    const sentOrDecided = q('SENT') + q('VIEWED') + q('SIGNED') + q('VOID');
    return {
      estimates: {
        draft: q('DRAFT'),
        outstanding: q('SENT') + q('VIEWED'),
        accepted: q('SIGNED'),
        declined: q('VOID'),
        acceptanceRate: sentOrDecided > 0 ? Math.round((q('SIGNED') / sentOrDecided) * 100) : null,
      },
      invoices: invoices.map((x) => ({ status: x.status, count: x._count, total: Number(x._sum.amount ?? 0) })),
      collected: { total: Number(paidAgg._sum.amount ?? 0), payments: paidAgg._count },
    };
  }

  /** Decline an estimate (VOID) — the honest opposite of acceptance. */
  async declineEstimate(id: string, reason?: string) {
    const doc = await this.prisma.db.document.findFirst({ where: { id, type: 'QUOTE' } });
    if (!doc) throw new NotFoundException('Estimate not found');
    if (doc.status === 'SIGNED') throw new BadRequestException('Estimate is already accepted');
    return this.prisma.db.document.update({
      where: { id },
      data: { status: 'VOID', data: { ...((doc.data as any) ?? {}), declinedReason: reason?.slice(0, 300) ?? null } },
    });
  }

  private docSummary(d: any) {
    return {
      id: d.id,
      type: d.type,
      status: d.status,
      title: d.title,
      amount: d.amount != null ? Number(d.amount) : null,
      lineItems: d.lineItems.map((li: any) => ({ description: li.description, quantity: Number(li.quantity), unitPrice: Number(li.unitPrice), amount: Number(li.amount) })),
      payUrl: (d.data as any)?.payUrl ?? null,
      convertedToInvoiceId: (d.data as any)?.convertedToInvoiceId ?? null,
      createdAt: d.createdAt,
    };
  }
}
