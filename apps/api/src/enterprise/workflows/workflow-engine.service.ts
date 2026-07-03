import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBus } from '../../automation/event-bus';
import { DomainEvents } from '../../automation/events';
import { matches, interpolate } from '../../automation/rule-engine';
import { tenantContext, TenantStore } from '../../common/tenancy/tenant-context';
import { CommsService } from '../../integrations/comms.service';
import { AgentOrchestrator } from '../../employees/framework/agent-orchestrator.service';

interface GraphNode {
  id: string;
  type: 'trigger' | 'condition' | 'action' | 'ai' | 'wait' | 'end';
  config?: any;
}
interface GraphEdge {
  from: string;
  to: string;
  when?: 'true' | 'false';
}

/**
 * Executes a visual workflow graph. Supports trigger, condition (branch via the
 * existing rule-engine), action (reuses Comms + CRM), AI (reuses the AI Workforce
 * orchestrator), durable WAIT (run suspends with resumeAt, resumed on tick), and
 * end. One interpreter — no per-workflow code generation, fully multi-tenant.
 */
@Injectable()
export class WorkflowEngine {
  private readonly logger = new Logger(WorkflowEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
    private readonly comms: CommsService,
    private readonly orchestrator: AgentOrchestrator,
  ) {}

  /** Start a run for a definition with a triggering context. */
  async start(workflowId: string, def: { graph: any }, context: Record<string, any>) {
    const run = await this.prisma.db.workflowRun.create({ data: { workflowId, status: 'RUNNING', context: context as any } as any });
    await this.bus.emit({ name: DomainEvents.WORKFLOW_RUN_STARTED, tenantId: tenantContext.tenantId, payload: { run: { id: run.id, workflowId } } });
    const start = this.firstNext(def.graph, this.triggerNode(def.graph)?.id);
    await this.execute(run.id, def.graph, start, context, []);
    return run.id;
  }

  /**
   * Resume any WAITING runs whose timer has elapsed (called on event ticks).
   * Found via load testing: this runs as a side effect of EVERY trigger
   * event (WorkflowRouter.onEvent calls it unconditionally), so concurrent
   * events legitimately call it concurrently. Without a claim, two
   * overlapping calls both read the same due run via `findMany` before
   * either updates it, and both execute the post-WAIT action — 6 duplicate
   * Activity rows from a single resume in a 10-concurrent-event test. The
   * atomic `updateMany` below (status WAITING -> RUNNING, conditioned on the
   * row still being WAITING) is a compare-and-swap: only the caller whose
   * update actually matched a row proceeds to execute it.
   */
  async resumeDue() {
    const due = await this.prisma.db.workflowRun.findMany({ where: { status: 'WAITING', resumeAt: { lte: new Date() } }, take: 25, include: { workflow: true } });
    let resumed = 0;
    for (const run of due as any[]) {
      const claim = await this.prisma.db.workflowRun.updateMany({ where: { id: run.id, status: 'WAITING' }, data: { status: 'RUNNING' } });
      if (claim.count === 0) continue; // another concurrent call already claimed this run
      resumed++;
      await this.execute(run.id, run.workflow.graph, run.currentNodeId, (run.context as any) ?? {}, (run.log as any[]) ?? []);
    }
    return resumed;
  }

  /**
   * Background-timer variant of resumeDue(). Called from a setInterval with no
   * active tenant context. The Prisma extension guard (`if (!tenantId) return
   * query(args)`) lets the findMany and updateMany run globally — finding due
   * runs across ALL tenants. Each execute() call is then wrapped in its own
   * tenantContext.run so bus.emit (which calls tenantContext.tenantId) doesn't
   * throw.
   */
  async resumeDueGlobal() {
    const due = await this.prisma.db.workflowRun.findMany({ where: { status: 'WAITING', resumeAt: { lte: new Date() } }, take: 25, include: { workflow: true } });
    let resumed = 0;
    for (const run of due as any[]) {
      const claim = await this.prisma.db.workflowRun.updateMany({ where: { id: run.id, status: 'WAITING' }, data: { status: 'RUNNING' } });
      if (claim.count === 0) continue;
      resumed++;
      await tenantContext.run({ tenantId: (run as any).tenantId }, () =>
        this.execute(run.id, run.workflow.graph, run.currentNodeId, (run.context as any) ?? {}, (run.log as any[]) ?? []),
      );
    }
    return resumed;
  }

  private async execute(runId: string, graph: { nodes: GraphNode[]; edges: GraphEdge[] }, startNodeId: string | undefined, context: Record<string, any>, log: any[]) {
    const byId = new Map((graph.nodes ?? []).map((n) => [n.id, n]));
    let nodeId = startNodeId;
    let guard = 0;

    while (nodeId && guard++ < 100) {
      const node = byId.get(nodeId);
      if (!node) break;
      log.push({ node: nodeId, type: node.type, at: new Date().toISOString() });

      if (node.type === 'end') break;

      if (node.type === 'wait') {
        const next = this.firstNext(graph, nodeId);
        await this.prisma.db.workflowRun.update({ where: { id: runId }, data: { status: 'WAITING', resumeAt: new Date(Date.now() + this.toMs(node.config)), currentNodeId: next ?? null, context: context as any, log: log as any } });
        return;
      }

      let label: 'true' | 'false' | undefined;
      try {
        if (node.type === 'condition') {
          label = matches(node.config?.conditions ?? [], context) ? 'true' : 'false';
        } else if (node.type === 'action') {
          await this.runAction(node.config, context);
        } else if (node.type === 'ai') {
          const r = await this.orchestrator.run(node.config?.agentKey, { type: node.config?.taskType ?? 'run', subjects: context.subjects, params: node.config?.params }).catch(() => null);
          context.lastAi = r?.summary ?? null;
        }
      } catch (err) {
        await this.prisma.db.workflowRun.update({ where: { id: runId }, data: { status: 'FAILED', error: (err as Error).message, endedAt: new Date(), log: log as any } });
        return;
      }
      nodeId = this.firstNext(graph, nodeId, label);
    }

    await this.prisma.db.workflowRun.update({ where: { id: runId }, data: { status: 'DONE', endedAt: new Date(), context: context as any, log: log as any } });
    await this.bus.emit({ name: DomainEvents.WORKFLOW_RUN_COMPLETED, tenantId: tenantContext.tenantId, payload: { run: { id: runId } } });
  }

  private async runAction(config: any, context: Record<string, any>) {
    const type = config?.action?.type ?? config?.type;
    const params = config?.action?.params ?? config?.params ?? {};
    switch (type) {
      case 'SEND_SMS':
        if (params.to) await this.comms.sendSms(tenantContext.tenantId, { to: String(params.to), body: interpolate(String(params.template ?? ''), context) });
        break;
      case 'SEND_EMAIL':
        if (params.to) await this.comms.sendEmail(tenantContext.tenantId, { to: String(params.to), subject: String(params.subject ?? 'Update'), body: interpolate(String(params.template ?? ''), context) });
        break;
      case 'UPDATE_STAGE':
        if (context.subjects?.leadId) await this.prisma.db.lead.update({ where: { id: context.subjects.leadId }, data: { stage: params.stage } });
        break;
      case 'CREATE_ACTIVITY':
        await this.prisma.db.activity.create({ data: { type: 'SYSTEM', actor: 'SYSTEM', title: interpolate(String(params.title ?? 'Workflow step'), context), contactId: context.subjects?.contactId ?? null, leadId: context.subjects?.leadId ?? null } as any });
        break;
      default:
        this.logger.debug(`workflow action no-op: ${type}`);
    }
  }

  private triggerNode(graph: { nodes: GraphNode[] }) {
    return (graph.nodes ?? []).find((n) => n.type === 'trigger');
  }

  private firstNext(graph: { edges: GraphEdge[] }, fromId?: string, label?: 'true' | 'false'): string | undefined {
    if (!fromId) return undefined;
    const edges = graph.edges ?? [];
    if (label) {
      const match = edges.find((e) => e.from === fromId && e.when === label);
      if (match) return match.to;
    }
    return edges.find((e) => e.from === fromId && !e.when)?.to ?? edges.find((e) => e.from === fromId)?.to;
  }

  private toMs(config: any): number {
    if (config?.minutes) return Number(config.minutes) * 60_000;
    if (config?.hours) return Number(config.hours) * 3_600_000;
    if (config?.days) return Number(config.days) * 86_400_000;
    return Number(config?.ms ?? 0);
  }
}
