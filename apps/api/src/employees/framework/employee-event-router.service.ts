import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventBus } from '../../automation/event-bus';
import { DomainEvent, DomainEvents } from '../../automation/events';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { AgentOrchestrator } from './agent-orchestrator.service';
import { EmployeeTaskInput } from './employee.types';

type Route = { agentKey: string; build: (e: DomainEvent) => EmployeeTaskInput };

/**
 * Wires the multi-agent workflow: business events automatically trigger the
 * right AI employee (Lead arrives → Sales scores; Job completes → Customer
 * Success + Marketing; Payment succeeds → Executive). Handoffs between employees
 * also flow through here. Disabled employees are skipped by the orchestrator.
 *
 * Each dispatch's promise is returned (not fire-and-forget) so EventBus.emit()
 * awaits it — found via live verification that NOT awaiting this allowed a
 * decision the agent creates to be logged AFTER a synchronously-chained
 * follow-up event (e.g. dispatch's job.assigned, fired moments later by a
 * direct service call) had already been processed, permanently stranding the
 * decision OPEN past the very signal meant to resolve it.
 */
@Injectable()
export class EmployeeEventRouter implements OnModuleInit {
  private readonly logger = new Logger(EmployeeEventRouter.name);

  private readonly routes: Record<string, Route[]> = {
    'lead.created': [{ agentKey: 'sales', build: (e) => ({ type: 'qualify_score', subjects: subjectsOf(e) }) }],
    'job.completed': [
      { agentKey: 'customer_success', build: (e) => ({ type: 'satisfaction_check', subjects: subjectsOf(e) }) },
      { agentKey: 'marketing', build: (e) => ({ type: 'review_request', subjects: subjectsOf(e) }) },
    ],
    'payment.succeeded': [{ agentKey: 'executive', build: () => ({ type: 'kpi_update' }) }],
  };

  constructor(
    private readonly bus: EventBus,
    private readonly orchestrator: AgentOrchestrator,
  ) {}

  onModuleInit() {
    for (const [event, routes] of Object.entries(this.routes)) {
      this.bus.on(event, (e) => Promise.all(routes.map((r) => this.dispatch(r.agentKey, r.build(e), e.tenantId))));
    }
    this.bus.on(DomainEvents.AGENT_HANDOFF, (e) => {
      const target = (e.payload as any)?.target;
      return target?.agentKey ? this.dispatch(target.agentKey, target.input, e.tenantId) : undefined;
    });
    this.logger.log(`AI workforce router wired (${Object.keys(this.routes).length} triggers + handoff)`);
  }

  private dispatch(agentKey: string, input: EmployeeTaskInput, tenantId: string) {
    return tenantContext.run({ tenantId }, () =>
      this.orchestrator.run(agentKey, input).catch((err) => this.logger.warn(`${agentKey} auto-run failed: ${(err as Error).message}`)),
    );
  }
}

function subjectsOf(e: DomainEvent) {
  const p = (e.payload ?? {}) as any;
  return { contactId: p.contact?.id, leadId: p.lead?.id, jobId: p.job?.id };
}
