import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventBus } from '../../automation/event-bus';
import { DomainEvent } from '../../automation/events';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { WorkflowService } from './workflow.service';
import { WorkflowEngine } from './workflow-engine.service';

/** Events the visual workflow builder may listen to as triggers. */
const TRIGGER_EVENTS = [
  'lead.created', 'lead.stage_changed', 'booking.confirmed', 'booking.no_show',
  'job.created', 'job.assigned', 'job.completed', 'invoice.sent', 'payment.succeeded',
  'customer.booking.requested', 'message.inbound',
];

/**
 * Starts published workflows when their trigger event fires, and resumes WAITING
 * runs whose timer elapsed (swept on each tick). Reuses the EventBus — workflows
 * are first-class event consumers alongside automations and AI employees.
 */
@Injectable()
export class WorkflowRouter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkflowRouter.name);
  private sweepInterval?: NodeJS.Timeout;

  constructor(
    private readonly bus: EventBus,
    private readonly workflows: WorkflowService,
    private readonly engine: WorkflowEngine,
  ) {}

  onModuleInit() {
    for (const name of TRIGGER_EVENTS) this.bus.on(name, (e) => this.onEvent(name, e));
    // Background sweep resumes WAITING runs whose timer has elapsed even when no
    // trigger event fires. Without this, WAIT nodes only advance when a matching
    // event coincidentally arrives — correct behavior when traffic is steady, but
    // silent deadlock when no events fire (e.g. overnight, test environments).
    this.sweepInterval = setInterval(
      () => this.engine.resumeDueGlobal().catch((err) => this.logger.warn(`WAIT sweep error: ${(err as Error).message}`)),
      30_000,
    );
    this.logger.log(`Workflow router wired (${TRIGGER_EVENTS.length} triggers + 30s WAIT sweep)`);
  }

  onModuleDestroy() {
    if (this.sweepInterval) clearInterval(this.sweepInterval);
  }

  private onEvent(eventName: string, event: DomainEvent) {
    // Returned (not void) so EventBus.emit() awaits this same-request reaction.
    return tenantContext.run({ tenantId: event.tenantId }, async () => {
      try {
        await this.engine.resumeDue(); // advance any due WAITs
        const defs = await this.workflows.publishedFor(eventName);
        const p = (event.payload ?? {}) as any;
        const context = { event: eventName, subjects: { contactId: p.contact?.id, leadId: p.lead?.id, jobId: p.job?.id }, payload: p };
        for (const def of defs) await this.engine.start(def.id, { graph: def.graph }, context);
      } catch (err) {
        this.logger.warn(`workflow router ${eventName} failed: ${(err as Error).message}`);
      }
    });
  }
}
