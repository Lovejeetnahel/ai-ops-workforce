import { Injectable, Logger } from '@nestjs/common';
import { NotificationImportance } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { EventBus } from '../automation/event-bus';
import { DomainEvents } from '../automation/events';
import { ProviderFactory } from '../integrations/provider-factory.service';
import { CommsService } from '../integrations/comms.service';
import { tenantContext } from '../common/tenancy/tenant-context';
import { DomainEvent } from '../automation/events';

interface NotifSpec {
  title: string;
  importance: NotificationImportance;
  body: (p: any) => string;
}

/** Event → customer notification mapping. Importance is the "smart filter". */
const SPEC: Record<string, NotifSpec> = {
  'job.created': { title: 'Service request received', importance: 'NORMAL', body: () => 'We received your request and are getting it scheduled.' },
  'job.assigned': { title: 'A technician has been assigned', importance: 'NORMAL', body: () => 'Your job has been assigned and is being scheduled.' },
  'job.completed': { title: 'Your job is complete', importance: 'IMPORTANT', body: () => 'Your service has been completed. Thank you for your business!' },
  'booking.confirmed': { title: 'Appointment confirmed', importance: 'IMPORTANT', body: (p) => `Your appointment is confirmed${p.booking?.start ? ' for ' + new Date(p.booking.start).toLocaleString() : ''}.` },
  'document.generated': { title: 'A new document is available', importance: 'NORMAL', body: (p) => `A new ${String(p.document?.type ?? 'document').toLowerCase()} is available in your portal.` },
  'invoice.sent': { title: 'Your invoice is ready', importance: 'IMPORTANT', body: () => 'Your invoice is ready to view and pay in your portal.' },
  'payment.succeeded': { title: 'Payment received', importance: 'IMPORTANT', body: (p) => `We received your payment${p.payment?.amount ? ' of $' + p.payment.amount : ''}. Thank you!` },
};

export const NOTIFICATION_EVENTS = Object.keys(SPEC);

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
    private readonly providers: ProviderFactory,
    private readonly comms: CommsService,
  ) {}

  /** Build a customer notification from a domain event. */
  async fromEvent(name: string, event: DomainEvent) {
    const spec = SPEC[name];
    if (!spec) return null;

    const contactId = await this.resolveContact(event);
    if (!contactId) return null;

    const body = await this.summarize(name, event.payload, spec.body(event.payload));

    const notification = await this.prisma.db.notification.create({
      data: {
        contactId,
        category: name,
        title: spec.title,
        body,
        importance: spec.importance,
        sourceEvent: event.externalId ?? null,
        data: { event: name } as any,
      } as any,
    });

    await this.bus.emit({
      name: DomainEvents.NOTIFICATION_CREATED,
      tenantId: event.tenantId,
      payload: { notification: { id: notification.id, importance: spec.importance }, contact: { id: contactId } },
    });

    if (spec.importance === 'IMPORTANT') {
      await this.email(event.tenantId, contactId, spec.title, body);
    }
    return notification;
  }

  list(contactId: string, take = 50) {
    return this.prisma.db.notification.findMany({ where: { contactId }, orderBy: { createdAt: 'desc' }, take });
  }

  unreadCount(contactId: string) {
    return this.prisma.db.notification.count({ where: { contactId, read: false } });
  }

  markRead(id: string, contactId: string) {
    return this.prisma.db.notification.updateMany({ where: { id, contactId }, data: { read: true, readAt: new Date() } });
  }

  markAllRead(contactId: string) {
    return this.prisma.db.notification.updateMany({ where: { contactId, read: false }, data: { read: true, readAt: new Date() } });
  }

  // ── internals ──────────────────────────────────────────────────────────
  private async resolveContact(event: DomainEvent): Promise<string | null> {
    const p = (event.payload ?? {}) as any;
    if (p.contact?.id) return p.contact.id;
    if (p.job?.id) {
      const job = await this.prisma.db.job.findUnique({ where: { id: p.job.id }, select: { contactId: true } });
      return job?.contactId ?? null;
    }
    return null;
  }

  /** AI summary only when a real LLM key is configured (avoids stub echo). */
  private async summarize(name: string, payload: any, fallback: string): Promise<string> {
    if (!process.env.ANTHROPIC_API_KEY) return fallback;
    try {
      const llm = this.providers.llm();
      const res = await llm.complete({
        system: 'You write a single warm, plain-language sentence notifying a customer about an update. No greetings, under 200 characters.',
        messages: [{ role: 'user', content: `Event: ${name}. Details: ${JSON.stringify(payload).slice(0, 400)}. Default text: "${fallback}".` }],
        maxTokens: 80,
      });
      return res.text?.trim() || fallback;
    } catch {
      return fallback;
    }
  }

  private async email(tenantId: string, contactId: string, subject: string, body: string) {
    try {
      const contact = await this.prisma.db.contact.findUnique({ where: { id: contactId }, select: { email: true } });
      if (contact?.email) await this.comms.sendEmail(tenantId, { to: contact.email, subject, body });
    } catch (err) {
      this.logger.warn(`notification email failed: ${(err as Error).message}`);
    }
  }
}
