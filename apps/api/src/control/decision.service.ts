import { Injectable, Logger } from '@nestjs/common';
import { DecisionStatus, MemorySubject } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { BusinessBrainService } from '../brain/business-brain.service';
import { tenantContext } from '../common/tenancy/tenant-context';
import { DomainEvent } from '../automation/events';
import { ExpectedOutcome } from './outcome-predictor';

export interface DecisionMeta {
  event: DomainEvent;
  policy?: string;
  ruleName?: string;
  ruleIndex: number;
  actionIndex: number;
  action: { type: string; params?: Record<string, unknown> };
}

export interface SubjectRefs {
  contactId?: string | null;
  leadId?: string | null;
  jobId?: string | null;
}

/**
 * CRUD for DecisionRecords. `open` is idempotent on
 * (tenant, correlationId, ruleIndex, actionIndex) so BullMQ retries never create
 * duplicates. Context is captured cheaply from the Business Brain (structured
 * memory, no embeddings) so each decision carries why it was made.
 */
@Injectable()
export class DecisionService {
  private readonly logger = new Logger(DecisionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brain: BusinessBrainService,
  ) {}

  subjectsOf(event: DomainEvent): SubjectRefs {
    const p = (event.payload ?? {}) as any;
    return { contactId: p.contact?.id ?? null, leadId: p.lead?.id ?? null, jobId: p.job?.id ?? null };
  }

  /** Create (or no-op on retry) the OPEN decision BEFORE the action executes. */
  async open(meta: DecisionMeta, expected: ExpectedOutcome) {
    const tenantId = tenantContext.tenantId;
    const correlationId = meta.event.correlationId ?? `${meta.event.name}:${Date.now()}`;
    const subjects = this.subjectsOf(meta.event);
    const context = await this.captureContext(meta, subjects);
    const expectedBy = expected.deadlineHours
      ? new Date(Date.now() + expected.deadlineHours * 3_600_000)
      : null;

    return this.prisma.db.decisionRecord.upsert({
      where: { decision_dedupe: { tenantId, correlationId, ruleIndex: meta.ruleIndex, actionIndex: meta.actionIndex } },
      update: {}, // retry → no-op, keep the original decision
      create: {
        correlationId,
        triggerEvent: meta.event.name,
        policy: meta.policy ?? 'rule',
        ruleName: meta.ruleName ?? null,
        ruleIndex: meta.ruleIndex,
        actionIndex: meta.actionIndex,
        actionType: meta.action.type,
        actionParams: (meta.action.params ?? {}) as any,
        context: context as any,
        expectedSignal: expected.signal ?? null,
        expectedValue: expected.expectedValue ?? null,
        expectedBy,
        status: 'OPEN',
        contactId: subjects.contactId ?? null,
        leadId: subjects.leadId ?? null,
        jobId: subjects.jobId ?? null,
      } as any,
    });
  }

  /** Open OPEN decisions awaiting `signal` whose subject matches the event. */
  findOpenForSignal(signal: string, subjects: SubjectRefs) {
    const or: any[] = [];
    if (subjects.contactId) or.push({ contactId: subjects.contactId });
    if (subjects.leadId) or.push({ leadId: subjects.leadId });
    if (subjects.jobId) or.push({ jobId: subjects.jobId });
    if (or.length === 0) return Promise.resolve([]);
    return this.prisma.db.decisionRecord.findMany({
      where: { status: 'OPEN', expectedSignal: signal, OR: or },
      orderBy: { createdAt: 'asc' },
    });
  }

  resolve(id: string, status: DecisionStatus, realizedValue: number | null, note: string) {
    return this.prisma.db.decisionRecord.update({
      where: { id },
      data: { status, realizedValue: realizedValue ?? null, resolutionNote: note, resolvedAt: new Date() },
    });
  }

  /** Structural actions: success == executed. */
  markImmediateMet(id: string) {
    return this.resolve(id, 'MET', 0, 'structural action executed');
  }

  /** Record an execution failure but leave OPEN so BullMQ retry can re-run it. */
  async noteExecutionError(id: string, err: unknown) {
    try {
      await this.prisma.db.decisionRecord.update({
        where: { id },
        data: { resolutionNote: `execution error: ${(err as Error).message}` },
      });
    } catch {
      /* never mask the original error */
    }
  }

  /** Past-deadline OPEN decisions → MISSED. Cheap, idempotent. */
  async sweepExpired() {
    const res = await this.prisma.db.decisionRecord.updateMany({
      where: { status: 'OPEN', expectedBy: { lt: new Date() } },
      data: { status: 'MISSED', resolvedAt: new Date(), resolutionNote: 'deadline passed' },
    });
    if (res.count) this.logger.debug(`Swept ${res.count} expired decision(s) → MISSED`);
    return res.count;
  }

  // ── Introspection (backend truth source, not UI) ────────────────────────
  recent(limit = 50) {
    return this.prisma.db.decisionRecord.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  }

  async stats() {
    const grouped = await this.prisma.db.decisionRecord.groupBy({ by: ['status'], _count: { _all: true } });
    return grouped.reduce((acc, g) => ({ ...acc, [g.status]: g._count._all }), {} as Record<string, number>);
  }

  /**
   * Record a decision made by an AI employee (Phase 6). Reuses the DecisionRecord
   * model so agent actions are accountable through the same Control Layer: if an
   * expectedSignal is given it stays OPEN for the OutcomeEvaluator to resolve;
   * otherwise it is a structural decision marked MET immediately.
   */
  recordAgentDecision(input: {
    agentKey: string;
    taskId: string;
    actionType: string;
    reason?: string;
    confidence?: number;
    expectedSignal?: string;
    expectedValue?: number;
    deadlineHours?: number;
    subjects?: { contactId?: string | null; leadId?: string | null; jobId?: string | null };
  }) {
    const deferred = !!input.expectedSignal;
    return this.prisma.db.decisionRecord.create({
      data: {
        correlationId: `${input.taskId}:${input.actionType}:${Date.now()}`,
        triggerEvent: `agent.${input.agentKey}`,
        policy: input.agentKey,
        ruleName: input.actionType,
        ruleIndex: 0,
        actionIndex: 0,
        actionType: input.actionType,
        actionParams: {} as any,
        context: { reason: input.reason ?? null, confidence: input.confidence ?? null } as any,
        expectedSignal: input.expectedSignal ?? null,
        expectedValue: input.expectedValue ?? null,
        expectedBy: input.deadlineHours ? new Date(Date.now() + input.deadlineHours * 3_600_000) : null,
        status: deferred ? 'OPEN' : 'MET',
        resolvedAt: deferred ? null : new Date(),
        realizedValue: deferred ? null : 0,
        resolutionNote: deferred ? null : 'agent decision (structural)',
        contactId: input.subjects?.contactId ?? null,
        leadId: input.subjects?.leadId ?? null,
        jobId: input.subjects?.jobId ?? null,
      } as any,
    });
  }

  private async captureContext(meta: DecisionMeta, subjects: SubjectRefs) {
    const base = { trigger: meta.event.name, ruleName: meta.ruleName ?? null, policy: meta.policy ?? 'rule' };
    if (!subjects.contactId) return base;
    try {
      const memory = await this.brain.recall(MemorySubject.CUSTOMER, subjects.contactId);
      return { ...base, memory: memory.slice(0, 3).map((m: any) => ({ kind: m.kind, content: m.content })) };
    } catch {
      return base;
    }
  }
}
