import { BadRequestException, Injectable } from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { EventBus } from '../automation/event-bus';
import { DomainEvents } from '../automation/events';
import { tenantContext } from '../common/tenancy/tenant-context';
import { PaymentsService } from './payments.service';

export interface LineItemInput {
  description: string;
  quantity?: number;
  unitPrice: number;
}

export interface CreateDocInput {
  jobId?: string;
  leadId?: string;
  contactId?: string;
  title?: string;
  lineItems: LineItemInput[];
}

/**
 * Quote → Invoice → Payment lifecycle. Quotes and invoices are `Document` rows
 * (reusing the existing model) with structured `DocumentLineItem`s; the document
 * amount is the line-item sum. Sending an invoice issues a Stripe payment link
 * via PaymentsService; settlement flows back through `payment.succeeded`.
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
    private readonly payments: PaymentsService,
  ) {}

  createQuote(input: CreateDocInput) {
    return this.createDoc('QUOTE', input);
  }

  createInvoice(input: CreateDocInput) {
    return this.createDoc('INVOICE', input);
  }

  /** Convert a completed job into a draft invoice (uses job metadata items). */
  async createInvoiceFromJob(jobId: string, lineItems?: LineItemInput[]) {
    const job = await this.prisma.db.job.findUniqueOrThrow({ where: { id: jobId } });
    const items = lineItems?.length ? lineItems : this.itemsFromJob(job);
    return this.createInvoice({
      jobId: job.id,
      leadId: job.leadId ?? undefined,
      contactId: job.contactId ?? undefined,
      title: `Invoice — ${job.title}`,
      lineItems: items,
    });
  }

  /** Accept a quote, then clone its line items into a new invoice. */
  async convertQuoteToInvoice(quoteId: string) {
    const quote = await this.prisma.db.document.findUniqueOrThrow({ where: { id: quoteId }, include: { lineItems: true } });
    // Idempotency: if this quote was already converted, return the existing invoice
    // instead of creating a duplicate. Found via Phase D testing: calling convert()
    // twice created two invoices for the same quote, enabling double-billing.
    const existingInvoiceId = (quote.data as any)?.convertedToInvoiceId;
    if (existingInvoiceId) {
      return this.get(existingInvoiceId);
    }
    const items: LineItemInput[] = quote.lineItems.map((li) => ({
      description: li.description,
      quantity: Number(li.quantity),
      unitPrice: Number(li.unitPrice),
    }));
    const invoice = await this.createInvoice({
      jobId: quote.jobId ?? undefined,
      leadId: quote.leadId ?? undefined,
      contactId: quote.contactId ?? undefined,
      title: quote.title.replace(/quote/i, 'Invoice'),
      lineItems: items,
    });
    await this.prisma.db.document.update({
      where: { id: quoteId },
      data: { status: 'SIGNED', data: { ...(quote.data as any), convertedToInvoiceId: invoice.id } },
    });
    return invoice;
  }

  /** Send a document. Invoices get a payment link; others just mark SENT. */
  async send(id: string) {
    const doc = await this.prisma.db.document.findUniqueOrThrow({ where: { id } });
    if (doc.type === 'INVOICE' && doc.amount && Number(doc.amount) > 0) {
      await this.payments.createPaymentLink(id); // sets status SENT + payUrl + pending Payment
      await this.bus.emit({ name: DomainEvents.INVOICE_SENT, tenantId: tenantContext.tenantId, payload: this.subject(doc) });
    } else {
      await this.prisma.db.document.update({ where: { id }, data: { status: 'SENT' } });
      await this.bus.emit({ name: DomainEvents.DOCUMENT_SENT, tenantId: tenantContext.tenantId, payload: this.subject(doc) });
    }
    return this.get(id);
  }

  async acceptQuote(id: string) {
    const doc = await this.prisma.db.document.update({ where: { id }, data: { status: 'SIGNED' } });
    await this.bus.emit({ name: DomainEvents.QUOTE_ACCEPTED, tenantId: tenantContext.tenantId, payload: this.subject(doc) });
    return this.get(id);
  }

  get(id: string) {
    return this.prisma.db.document.findUniqueOrThrow({
      where: { id },
      include: { lineItems: true, payments: true, contact: { select: { name: true, email: true } } },
    });
  }

  list(filter: { type?: DocumentType; status?: any } = {}) {
    return this.prisma.db.document.findMany({
      where: { ...(filter.type ? { type: filter.type } : {}), ...(filter.status ? { status: filter.status } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { contact: { select: { name: true } } },
      take: 200,
    });
  }

  // ── internals ────────────────────────────────────────────────────────────
  private async createDoc(type: DocumentType, input: CreateDocInput) {
    const items = input.lineItems.map((li) => {
      const quantity = li.quantity ?? 1;
      return { description: li.description, quantity, unitPrice: li.unitPrice, amount: round(quantity * li.unitPrice) };
    });
    const total = round(items.reduce((s, li) => s + li.amount, 0));

    // Validate that provided foreign keys belong to this tenant (prevents cross-tenant injection).
    // Uses findFirst (FILTERABLE_OPS path) so the extension merges tenantId into WHERE — a
    // cross-tenant id returns null without touching the other tenant's row.
    if (input.contactId) {
      const contact = await this.prisma.db.contact.findFirst({ where: { id: input.contactId } });
      if (!contact) throw new BadRequestException(`Contact ${input.contactId} not found in this tenant`);
    }
    if (input.leadId) {
      const lead = await this.prisma.db.lead.findFirst({ where: { id: input.leadId } });
      if (!lead) throw new BadRequestException(`Lead ${input.leadId} not found in this tenant`);
    }
    if (input.jobId) {
      const job = await this.prisma.db.job.findFirst({ where: { id: input.jobId } });
      if (!job) throw new BadRequestException(`Job ${input.jobId} not found in this tenant`);
    }

    const contactId = input.contactId ?? (await this.resolveContact(input));
    const tenantId = tenantContext.tenantId;

    // Document + its line items in a single transaction: a crash between the two
    // writes would leave a Document with amount>0 but zero line items, which is
    // permanent corruption since there's no retry mechanism for the line-item write.
    const doc = await this.prisma.$transaction(async (tx) => {
      const d = await tx.document.create({
        data: {
          tenantId,
          type,
          status: 'DRAFT',
          title: input.title ?? (type === 'QUOTE' ? 'Quote' : 'Invoice'),
          contactId: contactId ?? null,
          jobId: input.jobId ?? null,
          leadId: input.leadId ?? null,
          amount: total,
        } as any,
      });
      await tx.documentLineItem.createMany({
        data: items.map((li) => ({ tenantId, documentId: d.id, description: li.description, quantity: li.quantity, unitPrice: li.unitPrice, amount: li.amount })) as any,
      });
      return d;
    });

    await this.bus.emit({
      name: DomainEvents.DOCUMENT_GENERATED,
      tenantId,
      payload: { document: { id: doc.id, type, amount: total }, contact: contactId ? { id: contactId } : undefined, job: input.jobId ? { id: input.jobId } : undefined },
    });
    return this.get(doc.id);
  }

  private async resolveContact(input: CreateDocInput): Promise<string | null> {
    if (input.jobId) {
      const job = await this.prisma.db.job.findUnique({ where: { id: input.jobId }, select: { contactId: true } });
      if (job?.contactId) return job.contactId;
    }
    if (input.leadId) {
      const lead = await this.prisma.db.lead.findUnique({ where: { id: input.leadId }, select: { contactId: true } });
      if (lead?.contactId) return lead.contactId;
    }
    return null;
  }

  private itemsFromJob(job: { title: string; metadata: unknown }): LineItemInput[] {
    const meta = (job.metadata ?? {}) as any;
    if (Array.isArray(meta.lineItems) && meta.lineItems.length) {
      return meta.lineItems.map((li: any) => ({ description: li.description ?? job.title, quantity: Number(li.quantity ?? 1), unitPrice: Number(li.unitPrice ?? li.amount ?? 0) }));
    }
    const price = Number(meta.price ?? meta.total ?? 0);
    return [{ description: job.title, quantity: 1, unitPrice: price }];
  }

  private subject(doc: { id: string; type: DocumentType; contactId: string | null; jobId: string | null }) {
    return {
      document: { id: doc.id, type: doc.type },
      contact: doc.contactId ? { id: doc.contactId } : undefined,
      job: doc.jobId ? { id: doc.jobId } : undefined,
    };
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
