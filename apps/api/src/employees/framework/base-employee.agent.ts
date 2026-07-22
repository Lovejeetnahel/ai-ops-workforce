import { MemorySubject, MemoryKind } from '@prisma/client';
import { DomainEvents } from '../../automation/events';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { EmployeeKit } from './employee-kit.service';
import { EmployeeConfig, parseEmployeeConfig } from './employee-config';
import { AgentDefinition, Authority, EmployeeResult, EmployeeTaskInput, ExecuteContext } from './employee.types';

/**
 * Base class for every AI employee. Implements the universal work loop —
 * observe → plan → execute → reflect — plus the cross-cutting concerns every
 * employee shares: Brain-grounded reasoning, Decision logging (Control Layer),
 * Value Ledger entries, memory writes, activity writes, and event-based handoff
 * to other employees. Concrete employees implement `execute()` (and may override
 * observe/plan). They never re-implement infrastructure.
 */
export abstract class BaseEmployeeAgent {
  abstract readonly definition: AgentDefinition;

  constructor(protected readonly kit: EmployeeKit) {}

  /** The work loop, driven by the orchestrator. */
  async handle(input: EmployeeTaskInput, taskId: string, authority: Authority): Promise<EmployeeResult> {
    const observed = await this.observe(input);
    const plan = await this.plan(input, observed);
    const result = await this.execute({ input, observed, plan, taskId, autonomous: authority === 'AUTONOMOUS', authority });
    await this.reflect(input, result);
    return result;
  }

  protected observe(_input: EmployeeTaskInput): Promise<Record<string, unknown>> {
    return Promise.resolve({});
  }
  protected plan(_input: EmployeeTaskInput, _observed: Record<string, unknown>): Promise<string> {
    return Promise.resolve('');
  }
  protected abstract execute(ctx: ExecuteContext): Promise<EmployeeResult>;

  /** Default reflection: book generated value to the Value Ledger. */
  protected async reflect(input: EmployeeTaskInput, result: EmployeeResult): Promise<void> {
    if (result.value && result.value !== 0) {
      await this.kit.ledger.record({
        valueType: 'CONVERSION',
        amount: result.value,
        agent: this.definition.key,
        actionType: input.type,
        source: `agent:${this.definition.key}`,
      });
    }
  }

  // ── Shared helpers ────────────────────────────────────────────────────────

  /**
   * Execute a tool through the single enforced gateway (permission check →
   * argument validation → authority×risk verdict → run, hold for approval, or
   * deny). Employees never touch the raw ToolRegistry.
   */
  protected useTool(ctx: ExecuteContext, toolName: string, args: Record<string, unknown>, opts: { reason?: string; confidence?: number } = {}) {
    return this.kit.gateway.execute(this.definition.key, toolName, args, {
      defaultTools: this.definition.tools,
      authority: ctx.authority,
      taskId: ctx.taskId,
      reason: opts.reason,
      confidence: opts.confidence,
    });
  }

  /** Brain-grounded LLM reasoning (INTERNAL knowledge + optional customer memory). */
  protected async think(persona: string, prompt: string, contactId?: string | null): Promise<string> {
    const config = await this.employeeConfig();
    const identity = [
      persona,
      config.personality ? `\n## Your personality\n${config.personality}` : '',
      config.goal ? `\n## Your goal\n${config.goal}` : '',
      config.instructions ? `\n## Standing instructions from the business owner\n${config.instructions}` : '',
    ].join('');
    const system = await this.kit.brainContext.composeAgentContext({
      persona: identity,
      query: prompt.slice(0, 400),
      role: 'STAFF',
      subject: contactId ? { type: MemorySubject.CUSTOMER, id: contactId } : undefined,
    });
    return this.kit.complete(system, prompt, 400, { agentKey: this.definition.key });
  }

  /** This tenant's validated per-employee config (personality/instructions/goal/kpis/schedule). */
  protected async employeeConfig(): Promise<EmployeeConfig> {
    const row = await this.kit.prisma.db.agentInstallation.findUnique({
      where: { tenantId_agentKey: { tenantId: tenantContext.tenantId, agentKey: this.definition.key } },
      select: { config: true },
    });
    return parseEmployeeConfig(row?.config);
  }

  /** Record an accountable decision (Control Layer). */
  protected logDecision(taskId: string, actionType: string, opts: {
    reason?: string;
    confidence?: number;
    expectedSignal?: string;
    expectedValue?: number;
    deadlineHours?: number;
    subjects?: { contactId?: string | null; leadId?: string | null; jobId?: string | null };
  }) {
    return this.kit.decisions.recordAgentDecision({ agentKey: this.definition.key, taskId, actionType, ...opts });
  }

  /** Write a CRM activity to the timeline. */
  protected activity(input: { type: any; title: string; body?: string; contactId?: string | null; leadId?: string | null; jobId?: string | null }) {
    return this.kit.prisma.db.activity.create({
      data: {
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        actor: 'SYSTEM',
        contactId: input.contactId ?? null,
        leadId: input.leadId ?? null,
        jobId: input.jobId ?? null,
        metadata: { agent: this.definition.key },
      } as any,
    });
  }

  /** Persist a durable learning into long-term/customer memory. */
  protected remember(subjectId: string, content: string, subjectType: MemorySubject = MemorySubject.CUSTOMER, key?: string) {
    return this.kit.brain.remember({ subjectType, subjectId, kind: MemoryKind.FACT, content, key });
  }

  /** Hand work to another employee via the EventBus (cooperation). */
  protected handoff(targetAgentKey: string, input: EmployeeTaskInput) {
    return this.kit.bus.emit({
      name: DomainEvents.AGENT_HANDOFF,
      tenantId: tenantContext.tenantId,
      payload: { target: { agentKey: targetAgentKey, input } },
    });
  }
}
