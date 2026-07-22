import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBus } from '../../automation/event-bus';
import { ProviderFactory } from '../../integrations/provider-factory.service';
import { BusinessBrainService } from '../../brain/business-brain.service';
import { BrainContextService } from '../../brain/brain-context.service';
import { DecisionService } from '../../control/decision.service';
import { ValueLedgerService } from '../../control/value-ledger.service';
import { AgentRegistry } from '../../agents/agent.registry';
import { JobsService } from '../../operations/jobs/jobs.service';
import { DispatchService } from '../../operations/dispatch/dispatch.service';
import { DocumentsService } from '../../revenue/documents.service';
import { PaymentsService } from '../../revenue/payments.service';
import { ToolRegistry } from './tool-registry.service';
import { ToolGateway } from './tool-gateway.service';
import { AiUsageService } from './ai-usage.service';

/**
 * A single injectable that bundles every shared dependency an AI employee needs,
 * so concrete employees have a one-argument constructor (`super(kit)`). This is
 * the "company infrastructure" all employees share — Brain, Control Layer,
 * Operations, Revenue, the tool registry, and the existing agent registry (so
 * employees can delegate to the original Voice/Chat/CRM/Dispatch agents).
 */
@Injectable()
export class EmployeeKit {
  constructor(
    public readonly prisma: PrismaService,
    public readonly bus: EventBus,
    public readonly providers: ProviderFactory,
    public readonly brain: BusinessBrainService,
    public readonly brainContext: BrainContextService,
    public readonly decisions: DecisionService,
    public readonly ledger: ValueLedgerService,
    public readonly agents: AgentRegistry,
    public readonly jobs: JobsService,
    public readonly dispatch: DispatchService,
    public readonly documents: DocumentsService,
    public readonly payments: PaymentsService,
    public readonly tools: ToolRegistry,
    public readonly gateway: ToolGateway,
    public readonly usage: AiUsageService,
  ) {}

  async complete(system: string, user: string, maxTokens = 400, attribution?: { agentKey?: string; taskId?: string }): Promise<string> {
    const res = await this.llmCall({ system, messages: [{ role: 'user', content: user }], maxTokens }, attribution);
    return res.text;
  }

  /**
   * The one LLM entry point for the workforce: every call is usage-accounted
   * (exact provider + model + token facts per call, rolled up to the owning
   * AgentTask) and feeds the honest provider-readiness state. Supports the
   * tools/toolCalls contract for the planner loop.
   */
  async llmCall(
    input: { system: string; messages: { role: 'user' | 'assistant'; content: string }[]; tools?: { name: string; description: string; input_schema: object }[]; maxTokens?: number },
    attribution?: { agentKey?: string; taskId?: string },
  ) {
    const llm = this.providers.llm();
    try {
      const res = await llm.complete(input);
      this.usage.noteProviderSuccess();
      if (res.usage) {
        const recorded = await this.usage.record({
          provider: llm.provider,
          model: llm.model,
          inputTokens: res.usage.inputTokens,
          outputTokens: res.usage.outputTokens,
          agentKey: attribution?.agentKey,
          taskId: attribution?.taskId,
        });
        if (attribution?.taskId) await this.usage.addToTask(attribution.taskId, recorded);
      }
      return res;
    } catch (err) {
      // Classify without leaking provider response bodies.
      const msg = (err as Error).message ?? '';
      this.usage.noteProviderError(msg.includes('429') ? 'rate_limited' : msg.includes('Anthropic 5') ? 'temporarily_unavailable' : 'request_failed');
      throw err;
    }
  }
}
