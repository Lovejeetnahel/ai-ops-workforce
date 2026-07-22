import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBus } from '../../automation/event-bus';
import { DomainEvents } from '../../automation/events';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { EmployeeRegistry } from './employee-registry.service';
import { EmployeeResult, EmployeeTaskInput } from './employee.types';

/**
 * The orchestration engine. Runs an AI employee against a task with full
 * lifecycle: creates an AgentTask (working memory), enforces install/enabled +
 * authority, executes the employee, persists the result, and emits task events.
 * Delegation/handoff between employees is event-based (agent.handoff), so the
 * roster cooperates without a hard dependency graph.
 */
@Injectable()
export class AgentOrchestrator {
  private readonly logger = new Logger(AgentOrchestrator.name);

  constructor(
    private readonly registry: EmployeeRegistry,
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
  ) {}

  async run(agentKey: string, input: EmployeeTaskInput, opts: { parentTaskId?: string } = {}): Promise<EmployeeResult & { taskId: string }> {
    const agent = this.registry.get(agentKey);
    if (!agent) throw new NotFoundException(`Unknown AI employee: ${agentKey}`);
    const install = await this.registry.installation(agentKey);
    if (!install.enabled) throw new BadRequestException(`AI employee "${agentKey}" is disabled`);

    const task = await this.prisma.db.agentTask.create({
      data: {
        agentKey,
        type: input.type,
        status: 'RUNNING',
        parentTaskId: opts.parentTaskId ?? null,
        contactId: input.subjects?.contactId ?? null,
        leadId: input.subjects?.leadId ?? null,
        jobId: input.subjects?.jobId ?? null,
        input: input as any,
      } as any,
    });
    await this.bus.emit({ name: DomainEvents.AGENT_TASK_CREATED, tenantId: tenantContext.tenantId, payload: { task: { id: task.id, agentKey, type: input.type } } });

    try {
      const result = await agent.handle(input, task.id, install.authority);
      await this.prisma.db.agentTask.update({
        where: { id: task.id },
        data: {
          status: 'DONE',
          output: (result.output ?? { summary: result.summary }) as any,
          reason: result.summary,
          confidence: typeof result.confidence === 'number' ? Math.max(0, Math.min(1, result.confidence)) : undefined,
          endedAt: new Date(),
        },
      });
      await this.bus.emit({ name: DomainEvents.AGENT_TASK_COMPLETED, tenantId: tenantContext.tenantId, payload: { task: { id: task.id, agentKey }, value: result.value ?? 0 } });
      return { ...result, taskId: task.id };
    } catch (err) {
      await this.prisma.db.agentTask.update({ where: { id: task.id }, data: { status: 'FAILED', error: (err as Error).message, endedAt: new Date() } });
      await this.bus.emit({ name: DomainEvents.AGENT_TASK_FAILED, tenantId: tenantContext.tenantId, payload: { task: { id: task.id, agentKey }, error: (err as Error).message } });
      throw err;
    }
  }

  /** Delegate a subtask to another employee (records parent linkage). */
  delegate(parentTaskId: string, agentKey: string, input: EmployeeTaskInput) {
    return this.run(agentKey, input, { parentTaskId });
  }
}
