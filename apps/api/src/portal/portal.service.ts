import { Injectable, NotFoundException } from '@nestjs/common';
import { MemorySubject } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { EventBus } from '../automation/event-bus';
import { DomainEvents } from '../automation/events';
import { tenantContext } from '../common/tenancy/tenant-context';
import { BrainContextService } from '../brain/brain-context.service';
import { ProviderFactory } from '../integrations/provider-factory.service';
import { NotificationsService } from './notifications.service';

/**
 * Read/aggregation layer for the customer portal. Every query is scoped to the
 * authenticated customer's Contact id (in addition to the tenant-scoped Prisma
 * client), so a customer can only ever see their own data. It READS from the
 * existing CRM / Operations / Revenue tables — it owns no business logic of its
 * own and duplicates nothing.
 */
@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
    private readonly brainContext: BrainContextService,
    private readonly providers: ProviderFactory,
    private readonly notifications: NotificationsService,
  ) {}

  async dashboard(contactId: string) {
    const [openJobs, upcomingBookings, unpaidInvoices, unread, recent] = await Promise.all([
      this.prisma.db.job.count({ where: { contactId, status: { in: ['UNSCHEDULED', 'SCHEDULED', 'DISPATCHED', 'IN_PROGRESS'] } } }),
      this.prisma.db.booking.findMany({ where: { contactId, start: { gte: new Date() }, status: { not: 'CANCELLED' } }, orderBy: { start: 'asc' }, take: 5 }),
      this.prisma.db.document.findMany({ where: { contactId, type: 'INVOICE', status: { in: ['SENT', 'VIEWED'] } }, select: { id: true, title: true, amount: true } }),
      this.notifications.unreadCount(contactId),
      this.prisma.db.activity.findMany({ where: { contactId }, orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);
    const unpaidTotal = unpaidInvoices.reduce((s, d) => s + Number(d.amount ?? 0), 0);
    return {
      openJobs,
      upcomingBookings,
      unpaid: { count: unpaidInvoices.length, total: unpaidTotal, invoices: unpaidInvoices },
      unreadNotifications: unread,
      recentActivity: recent,
    };
  }

  profile(contactId: string) {
    return this.prisma.db.contact.findUniqueOrThrow({
      where: { id: contactId },
      include: { company: { select: { id: true, name: true } } },
    });
  }

  jobs(contactId: string) {
    return this.prisma.db.job.findMany({
      where: { contactId },
      orderBy: { createdAt: 'desc' },
      include: { assignedTo: { select: { name: true } }, bookings: { select: { start: true, end: true, status: true } } },
    });
  }

  async jobDetail(contactId: string, jobId: string) {
    const job = await this.prisma.db.job.findFirst({
      where: { id: jobId, contactId },
      include: { assignedTo: { select: { name: true } }, bookings: true, documents: { select: { id: true, type: true, status: true, amount: true } } },
    });
    if (!job) throw new NotFoundException('Job not found');
    const timeline = await this.prisma.db.activity.findMany({ where: { jobId }, orderBy: { createdAt: 'desc' }, take: 50 });
    return { ...job, timeline };
  }

  invoices(contactId: string) {
    return this.prisma.db.document.findMany({
      where: { contactId, type: 'INVOICE' },
      orderBy: { createdAt: 'desc' },
      include: { lineItems: true, payments: { select: { status: true, amount: true, createdAt: true } } },
    });
  }

  documents(contactId: string) {
    return this.prisma.db.document.findMany({
      where: { contactId, type: { in: ['QUOTE', 'INVOICE', 'CONTRACT'] } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, type: true, status: true, title: true, amount: true, createdAt: true, data: true },
    });
  }

  history(contactId: string) {
    return this.prisma.db.activity.findMany({ where: { contactId }, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  // ── Messaging (reuses Conversation/Message, channel = PORTAL) ────────────
  async sendMessage(contactId: string, text: string) {
    let convo = await this.prisma.db.conversation.findFirst({
      where: { contactId, channel: 'PORTAL', status: { not: 'CLOSED' } },
      orderBy: { updatedAt: 'desc' },
    });
    if (!convo) {
      convo = await this.prisma.db.conversation.create({ data: { contactId, channel: 'PORTAL', handledBy: 'SYSTEM' } as any });
    }
    const message = await this.prisma.db.message.create({
      data: { conversationId: convo.id, direction: 'INBOUND', author: 'CONTACT', body: text } as any,
    });
    await this.bus.emit({
      name: DomainEvents.CUSTOMER_MESSAGE_SENT,
      tenantId: tenantContext.tenantId,
      payload: { conversationId: convo.id, contact: { id: contactId }, text },
    });
    return message;
  }

  async messages(contactId: string) {
    const convos = await this.prisma.db.conversation.findMany({
      where: { contactId, channel: 'PORTAL' },
      orderBy: { updatedAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    return convos;
  }

  // ── AI features ──────────────────────────────────────────────────────────
  /** AI assistant grounded in the Business Brain (PUBLIC knowledge + memory). */
  async assistant(contactId: string, question: string) {
    const system = await this.brainContext.composeAgentContext({
      persona: 'You are a friendly customer assistant for this business. Answer the customer clearly using only known information, and offer to connect them to the team if unsure.',
      query: question,
      role: 'CUSTOMER',
      subject: { type: MemorySubject.CUSTOMER, id: contactId },
    });
    const reply = await this.providers.llm().complete({
      system,
      messages: [{ role: 'user', content: question }],
      maxTokens: 350,
    });
    return { answer: reply.text };
  }

  /** Plain-language explanation of an invoice. */
  async explainInvoice(contactId: string, documentId: string) {
    const doc = await this.prisma.db.document.findFirst({ where: { id: documentId, contactId, type: 'INVOICE' }, include: { lineItems: true, payments: true } });
    if (!doc) throw new NotFoundException('Invoice not found');
    const reply = await this.providers.llm().complete({
      system: 'Explain this invoice to a customer in 2-3 short, friendly sentences. State the total, what it covers, and whether it is paid.',
      messages: [{ role: 'user', content: JSON.stringify({ title: doc.title, amount: doc.amount, status: doc.status, lineItems: doc.lineItems.map((l) => ({ d: l.description, q: Number(l.quantity), p: Number(l.unitPrice) })) }) }],
      maxTokens: 200,
    });
    return { documentId, explanation: reply.text };
  }

  /** Plain-language explanation of a job's current status. */
  async explainJob(contactId: string, jobId: string) {
    const job = await this.prisma.db.job.findFirst({ where: { id: jobId, contactId }, include: { bookings: true } });
    if (!job) throw new NotFoundException('Job not found');
    const reply = await this.providers.llm().complete({
      system: 'Explain this job\'s status to the customer in 1-2 friendly sentences, including the next step or appointment time if any.',
      messages: [{ role: 'user', content: JSON.stringify({ title: job.title, status: job.status, scheduledStart: job.scheduledStart }) }],
      maxTokens: 160,
    });
    return { jobId, explanation: reply.text };
  }
}
