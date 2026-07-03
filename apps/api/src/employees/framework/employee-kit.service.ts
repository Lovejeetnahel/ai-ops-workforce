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
  ) {}

  async complete(system: string, user: string, maxTokens = 400): Promise<string> {
    const res = await this.providers.llm().complete({ system, messages: [{ role: 'user', content: user }], maxTokens });
    return res.text;
  }
}
