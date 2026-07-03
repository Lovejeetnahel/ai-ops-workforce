import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Actor, ActivityType } from '@prisma/client';
import { EventBus } from '../automation/event-bus';
import { DomainEvent } from '../automation/events';
import { tenantContext } from '../common/tenancy/tenant-context';
import { ActivitiesService } from './activities/activities.service';

type Mapper = (p: any) => { type: ActivityType; title: string; body?: string; actor: Actor };

/**
 * Auto-projects the universal timeline from the EventBus. Every meaningful
 * domain event becomes an Activity so the 360° history is always complete —
 * without any agent or service writing timeline rows by hand. Pure reuse of the
 * existing EventBus; introduces no new queue or infrastructure.
 *
 * Each domain event is emitted exactly once (in one process); registering the
 * in-proc listener in every process that boots AppModule yields exactly-once
 * projection with full coverage. Writes are tenant-scoped via the event's own
 * tenantId and are best-effort (never affect the emitting flow).
 */
@Injectable()
export class ActivityProjector implements OnModuleInit {
  private readonly logger = new Logger(ActivityProjector.name);

  private readonly mappers: Record<string, Mapper> = {
    'call.missed': () => ({ type: 'CALL', actor: 'VOICE_AGENT', title: 'Missed call' }),
    'call.completed': (p) => ({ type: 'CALL', actor: 'VOICE_AGENT', title: 'Call completed', body: p.transcript ? String(p.transcript).slice(0, 280) : undefined }),
    'lead.created': (p) => ({ type: 'AI_ACTION', actor: 'CRM_AGENT', title: 'Lead created', body: p.lead?.serviceType ?? undefined }),
    'lead.stage_changed': (p) => ({ type: 'STAGE_CHANGE', actor: 'SYSTEM', title: `Stage changed to ${p.lead?.stage ?? 'updated'}` }),
    'lead.lost': () => ({ type: 'STAGE_CHANGE', actor: 'SYSTEM', title: 'Lead marked lost' }),
    'booking.confirmed': () => ({ type: 'MEETING', actor: 'SYSTEM', title: 'Appointment confirmed' }),
    'booking.no_show': () => ({ type: 'MEETING', actor: 'SYSTEM', title: 'Appointment no-show' }),
    'job.assigned': () => ({ type: 'AI_ACTION', actor: 'DISPATCH_AGENT', title: 'Job dispatched' }),
    'job.completed': () => ({ type: 'JOB_UPDATE', actor: 'STAFF', title: 'Job completed' }),
    'message.inbound': (p) => ({ type: 'SMS', actor: 'CONTACT', title: 'Customer replied', body: p.text ? String(p.text).slice(0, 280) : undefined }),
    'document.generated': (p) => ({ type: 'DOCUMENT', actor: 'DOCUMENT_AGENT', title: `Document generated: ${p.document?.type ?? 'document'}` }),
    'document.sent': (p) => ({ type: 'DOCUMENT', actor: 'STAFF', title: `Document sent: ${p.document?.type ?? 'document'}` }),
    'invoice.sent': () => ({ type: 'DOCUMENT', actor: 'STAFF', title: 'Invoice sent' }),
    'quote.accepted': () => ({ type: 'DOCUMENT', actor: 'CONTACT', title: 'Quote accepted' }),
    'payment.succeeded': (p) => ({ type: 'PAYMENT', actor: 'SYSTEM', title: 'Payment received', body: p.payment?.amount ? `$${p.payment.amount}` : undefined }),
  };

  constructor(
    private readonly bus: EventBus,
    private readonly activities: ActivitiesService,
  ) {}

  onModuleInit() {
    for (const name of Object.keys(this.mappers)) {
      this.bus.on(name, (event) => this.project(name, event));
    }
    this.logger.log(`Activity projector listening on ${Object.keys(this.mappers).length} event types`);
  }

  private project(name: string, event: DomainEvent) {
    const mapper = this.mappers[name];
    if (!mapper) return Promise.resolve();
    const p = (event.payload ?? {}) as any;
    const mapped = mapper(p);

    // Scope the write to the event's tenant explicitly (robust off any context).
    // Returned (not void) so EventBus.emit() awaits this same-request reaction.
    return tenantContext.run({ tenantId: event.tenantId }, async () => {
      try {
        await this.activities.create({
          ...mapped,
          contactId: p.contact?.id,
          leadId: p.lead?.id,
          jobId: p.job?.id,
          sourceEventId: event.externalId,
          metadata: { event: name },
        });
      } catch (err) {
        this.logger.warn(`projection failed for ${name}: ${(err as Error).message}`);
      }
    });
  }
}
