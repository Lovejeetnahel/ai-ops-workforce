import { Injectable, NotFoundException } from '@nestjs/common';
import { AttachmentKind, ApprovalStatus, ApprovalType, FieldFormType, IndustryModule, MemoryKind, MemorySubject } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBus } from '../../automation/event-bus';
import { DomainEvents } from '../../automation/events';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { ProviderFactory } from '../../integrations/provider-factory.service';
import { BusinessBrainService } from '../../brain/business-brain.service';
import { JobsService } from '../../operations/jobs/jobs.service';

const REPORT_TYPES: FieldFormType[] = ['INCIDENT', 'SAFETY', 'DAMAGE', 'INSPECTION'];

/**
 * On-site job execution: media attachments (with Vision/OCR enrichment), dynamic
 * forms/checklists/reports (industry-config aware, AI-summarized, persisted to
 * Business Brain memory), and the approval/rework workflow. Approvals drive the
 * existing Operations job lifecycle — no duplicated state machine.
 */
@Injectable()
export class ExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
    private readonly providers: ProviderFactory,
    private readonly brain: BusinessBrainService,
    private readonly jobs: JobsService,
  ) {}

  // ── Attachments ──────────────────────────────────────────────────────────
  async addAttachment(userId: string, input: { jobId: string; kind: AttachmentKind; url: string; mimeType?: string; metadata?: any }) {
    let metadata = input.metadata ?? {};
    const isImage = ['PHOTO', 'PHOTO_BEFORE', 'PHOTO_AFTER', 'OCR_SCAN'].includes(input.kind);
    if (isImage) {
      try {
        const vision = await this.providers.vision().analyze({ url: input.url, hint: input.kind });
        metadata = { ...metadata, ocrText: vision.ocrText, aiLabels: vision.labels, aiSummary: vision.summary };
      } catch {
        /* vision best-effort */
      }
    }
    const attachment = await this.prisma.db.jobAttachment.create({
      data: { jobId: input.jobId, userId, kind: input.kind, url: input.url, mimeType: input.mimeType ?? null, metadata } as any,
    });
    await this.bus.emit({
      name: DomainEvents.JOB_ATTACHMENT_ADDED,
      tenantId: tenantContext.tenantId,
      payload: { job: { id: input.jobId }, attachment: { id: attachment.id, kind: input.kind } },
    });
    return attachment;
  }

  listAttachments(jobId: string) {
    return this.prisma.db.jobAttachment.findMany({ where: { jobId }, orderBy: { createdAt: 'desc' } });
  }

  // ── Form templates (industry-config aware) ───────────────────────────────
  createTemplate(input: { key: string; name: string; type: FieldFormType; schema: unknown[]; industryModule?: IndustryModule }) {
    return this.prisma.db.fieldFormTemplate.create({
      data: { key: input.key, name: input.name, type: input.type, schema: input.schema as any, industryModule: input.industryModule ?? null } as any,
    });
  }

  async listTemplates() {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantContext.tenantId }, select: { industryModule: true } });
    return this.prisma.db.fieldFormTemplate.findMany({
      where: { active: true, OR: [{ industryModule: null }, { industryModule: tenant.industryModule }] },
      orderBy: { name: 'asc' },
    });
  }

  // ── Form submissions (checklists, inspections, reports) ──────────────────
  async submitForm(userId: string, input: { templateKey?: string; templateId?: string; type: FieldFormType; jobId?: string; answers: Record<string, unknown> }) {
    const score = this.scoreChecklist(input.type, input.answers);
    const aiSummary = REPORT_TYPES.includes(input.type) ? await this.summarizeReport(input.type, input.answers) : null;

    const submission = await this.prisma.db.fieldFormSubmission.create({
      data: {
        templateId: input.templateId ?? null,
        templateKey: input.templateKey ?? null,
        type: input.type,
        jobId: input.jobId ?? null,
        userId,
        answers: input.answers as any,
        score,
        aiSummary,
      } as any,
    });

    // Persist reports to Business Brain as property/customer memory.
    if (input.jobId && REPORT_TYPES.includes(input.type)) {
      await this.rememberReport(input.jobId, input.type, aiSummary ?? JSON.stringify(input.answers).slice(0, 400));
    }

    await this.bus.emit({
      name: DomainEvents.FIELD_FORM_SUBMITTED,
      tenantId: tenantContext.tenantId,
      payload: { form: { id: submission.id, type: input.type }, job: input.jobId ? { id: input.jobId } : undefined },
    });
    if (['INCIDENT', 'SAFETY', 'DAMAGE'].includes(input.type)) {
      await this.bus.emit({ name: DomainEvents.INCIDENT_REPORTED, tenantId: tenantContext.tenantId, payload: { form: { id: submission.id, type: input.type }, job: input.jobId ? { id: input.jobId } : undefined } });
    }
    return submission;
  }

  listForms(filter: { jobId?: string; type?: FieldFormType } = {}) {
    return this.prisma.db.fieldFormSubmission.findMany({
      where: { ...(filter.jobId ? { jobId: filter.jobId } : {}), ...(filter.type ? { type: filter.type } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // ── Approvals / rework ───────────────────────────────────────────────────
  async requestApproval(jobId: string, type: ApprovalType, requestedById: string) {
    const approval = await this.prisma.db.jobApproval.create({ data: { jobId, type, requestedById, status: 'PENDING' } as any });
    await this.bus.emit({ name: DomainEvents.JOB_APPROVAL_REQUESTED, tenantId: tenantContext.tenantId, payload: { job: { id: jobId }, approval: { id: approval.id, type } } });
    return approval;
  }

  async decideApproval(approvalId: string, status: ApprovalStatus, reviewerId: string, notes?: string) {
    const approval = await this.prisma.db.jobApproval.update({ where: { id: approvalId }, data: { status, reviewerId, notes: notes ?? null } });

    if (status === 'APPROVED') {
      if (approval.type === 'QUALITY') await this.jobs.updateStatus(approval.jobId, 'COMPLETED');
      await this.bus.emit({ name: DomainEvents.JOB_APPROVED, tenantId: tenantContext.tenantId, payload: { job: { id: approval.jobId }, approval: { id: approval.id } } });
    } else if (status === 'REWORK') {
      await this.jobs.updateStatus(approval.jobId, 'IN_PROGRESS');
      await this.bus.emit({ name: DomainEvents.JOB_REWORK_REQUESTED, tenantId: tenantContext.tenantId, payload: { job: { id: approval.jobId }, approval: { id: approval.id }, notes } });
    }
    return approval;
  }

  listApprovals(status?: ApprovalStatus) {
    return this.prisma.db.jobApproval.findMany({ where: { ...(status ? { status } : {}) }, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  // ── internals ──────────────────────────────────────────────────────────
  private scoreChecklist(type: FieldFormType, answers: Record<string, unknown>): number | null {
    if (type !== 'CHECKLIST' && type !== 'QUALITY' && type !== 'INSPECTION') return null;
    const keys = Object.keys(answers ?? {});
    if (keys.length === 0) return null;
    const passed = keys.filter((k) => answers[k] === true || (typeof answers[k] === 'string' && answers[k] !== '')).length;
    return Math.round((passed / keys.length) * 100);
  }

  private async summarizeReport(type: FieldFormType, answers: Record<string, unknown>): Promise<string | null> {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    try {
      const res = await this.providers.llm().complete({
        system: `Summarize this ${type.toLowerCase()} report in 1-2 factual sentences for the office. Note any safety or follow-up concern.`,
        messages: [{ role: 'user', content: JSON.stringify(answers).slice(0, 800) }],
        maxTokens: 120,
      });
      return res.text?.trim() || null;
    } catch {
      return null;
    }
  }

  private async rememberReport(jobId: string, type: FieldFormType, content: string) {
    try {
      const job = await this.prisma.db.job.findUnique({ where: { id: jobId }, select: { contactId: true } });
      if (job?.contactId) {
        await this.brain.remember({ subjectType: MemorySubject.CUSTOMER, subjectId: job.contactId, kind: MemoryKind.FACT, content: `[${type}] ${content}` });
      }
    } catch {
      /* memory best-effort */
    }
  }
}
