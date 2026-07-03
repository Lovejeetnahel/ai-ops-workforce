import { Injectable } from '@nestjs/common';
import { Agent, AgentContext, AgentResult } from '../agent.interface';
import { DomainEvents } from '../../automation/events';
import { DispatchService } from '../../operations/dispatch/dispatch.service';

/**
 * DISPATCH AGENT — the event-driven face of the assignment engine. The actual
 * scoring + conflict-free scheduling lives in the shared DispatchService
 * (Operations engine), so there is ONE implementation used by both the agent
 * (on `lead.created`) and the manual dispatch API. The agent keeps its Agent
 * contract and emits no logic of its own beyond translating the event.
 */
@Injectable()
export class DispatchAgent implements Agent {
  readonly name = 'dispatch';

  constructor(private readonly dispatch: DispatchService) {}

  async run(ctx: AgentContext): Promise<AgentResult> {
    const leadId = (ctx.event!.payload as any).lead?.id;
    if (!leadId) return { agent: this.name, ok: false, summary: 'no lead to dispatch' };

    const result = await this.dispatch.dispatchLead(leadId);
    return {
      agent: this.name,
      ok: true,
      summary: result.reason,
      emitted: [DomainEvents.JOB_ASSIGNED],
    };
  }
}
