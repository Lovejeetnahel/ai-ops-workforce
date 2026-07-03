import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBus } from '../../automation/event-bus';
import { DomainEvents } from '../../automation/events';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { WorkflowEngine } from './workflow-engine.service';

/**
 * Workflow authoring: create/update graphs, version, publish/rollback,
 * import/export, test-run, and run analytics. Execution is delegated to the
 * shared WorkflowEngine; triggering is handled by WorkflowRouter.
 */
@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
    private readonly engine: WorkflowEngine,
  ) {}

  create(input: { key: string; name: string; triggerEvent?: string; graph?: unknown }) {
    return this.prisma.db.workflowDefinition.create({
      data: { key: input.key, name: input.name, version: 1, status: 'DRAFT', triggerEvent: input.triggerEvent ?? null, graph: (input.graph ?? { nodes: [], edges: [] }) as any } as any,
    });
  }

  update(id: string, input: { name?: string; triggerEvent?: string; graph?: unknown; enabled?: boolean }) {
    return this.prisma.db.workflowDefinition.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.triggerEvent !== undefined ? { triggerEvent: input.triggerEvent } : {}),
        ...(input.graph !== undefined ? { graph: input.graph as any } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      },
    });
  }

  list() {
    return this.prisma.db.workflowDefinition.findMany({ orderBy: [{ key: 'asc' }, { version: 'desc' }] });
  }

  get(id: string) {
    return this.prisma.db.workflowDefinition.findUniqueOrThrow({ where: { id } });
  }

  async publish(id: string) {
    const wf = await this.prisma.db.workflowDefinition.update({ where: { id }, data: { status: 'PUBLISHED', enabled: true } });
    await this.bus.emit({ name: DomainEvents.WORKFLOW_PUBLISHED, tenantId: tenantContext.tenantId, payload: { workflow: { id, key: wf.key, version: wf.version } } });
    return wf;
  }

  /** Create the next DRAFT version from an existing definition. */
  async newVersion(id: string) {
    const prev = await this.get(id);
    const latest = await this.prisma.db.workflowDefinition.findFirst({ where: { key: prev.key }, orderBy: { version: 'desc' } });
    return this.prisma.db.workflowDefinition.create({
      data: { key: prev.key, name: prev.name, version: (latest?.version ?? prev.version) + 1, status: 'DRAFT', triggerEvent: prev.triggerEvent, graph: prev.graph as any } as any,
    });
  }

  /** Published, enabled workflows that listen to a given trigger event. */
  publishedFor(triggerEvent: string) {
    return this.prisma.db.workflowDefinition.findMany({ where: { status: 'PUBLISHED', enabled: true, triggerEvent } });
  }

  async testRun(id: string, context: Record<string, unknown> = {}) {
    const def = await this.get(id);
    const runId = await this.engine.start(def.id, { graph: def.graph }, context as any);
    return { runId };
  }

  listRuns(workflowId: string) {
    return this.prisma.db.workflowRun.findMany({ where: { workflowId }, orderBy: { startedAt: 'desc' }, take: 100 });
  }

  async analytics(workflowId: string) {
    const grouped = await this.prisma.db.workflowRun.groupBy({ by: ['status'], where: { workflowId }, _count: { _all: true } });
    return grouped.reduce((acc, g) => ({ ...acc, [g.status]: g._count._all }), {} as Record<string, number>);
  }

  async export(id: string) {
    const def = await this.get(id);
    return { key: def.key, name: def.name, version: def.version, triggerEvent: def.triggerEvent, graph: def.graph };
  }

  import(input: { key: string; name: string; triggerEvent?: string; graph: unknown }) {
    return this.create(input);
  }
}
