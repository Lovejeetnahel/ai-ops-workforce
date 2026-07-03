import { Injectable } from '@nestjs/common';
import { MemorySubject } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProviderFactory } from '../../integrations/provider-factory.service';
import { BrainContextService } from '../../brain/brain-context.service';

/**
 * The field AI copilot. Every method composes Business Brain context (INTERNAL
 * SOPs/knowledge + customer memory for STAFF) and the relevant job data, then
 * asks the LLM. It owns no knowledge of its own — purely an orchestration layer
 * over the Brain + Operations data, so it works for every industry module.
 */
@Injectable()
export class FieldCopilotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderFactory,
    private readonly brainContext: BrainContextService,
  ) {}

  // ── Summaries ────────────────────────────────────────────────────────────
  async jobSummary(jobId: string) {
    const ctx = await this.jobContext(jobId);
    return this.answer('Summarize this job for the assigned worker in 3-4 short bullet points: what, where, customer notes, and any open items.', JSON.stringify(ctx).slice(0, 1500), ctx.contactId);
  }

  async dailySummary(userId: string, date: Date) {
    const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const jobs = await this.prisma.db.job.findMany({
      where: { assignedToId: userId, scheduledStart: { gte: dayStart, lt: dayEnd } },
      orderBy: { scheduledStart: 'asc' },
      select: { title: true, location: true, scheduledStart: true, status: true, priority: true },
    });
    return this.answer("Give the worker a concise plan for their day: number of jobs, order, any priorities/emergencies, and a motivating one-liner.", JSON.stringify(jobs), null);
  }

  async shiftSummary(userId: string, from: Date, to: Date) {
    const [jobs, time] = await Promise.all([
      this.prisma.db.job.count({ where: { assignedToId: userId, completedAt: { gte: from, lte: to } } }),
      this.prisma.db.timeEntry.findMany({ where: { userId, startedAt: { gte: from, lte: to } }, select: { type: true, durationMinutes: true } }),
    ]);
    const minutes = time.reduce((s, t) => s + (t.durationMinutes ?? 0), 0);
    return this.answer('Summarize this worker\'s shift in 2-3 sentences: jobs completed, hours worked, and overall productivity.', JSON.stringify({ jobsCompleted: jobs, minutes }), null);
  }

  async incidentSummary(submissionId: string) {
    const form = await this.prisma.db.fieldFormSubmission.findUniqueOrThrow({ where: { id: submissionId } });
    return this.answer('Summarize this incident/safety report for management: what happened, severity, and recommended follow-up.', JSON.stringify(form.answers), null);
  }

  // ── Assistants ───────────────────────────────────────────────────────────
  sopAssistant(query: string, jobId?: string) {
    return this.assist('You are an SOP assistant. Answer using the company\'s standard operating procedures and knowledge. Be precise and step-by-step.', query, jobId);
  }
  troubleshoot(query: string, jobId?: string) {
    return this.assist('You are a field troubleshooting assistant. Diagnose the likely cause and give safe, ordered steps. Note when to escalate.', query, jobId);
  }
  safetyAssistant(query: string, jobId?: string) {
    return this.assist('You are a field safety assistant. Prioritize worker safety, required PPE, hazards, and stop-work conditions.', query, jobId);
  }

  // ── Customer/property history + recommendations ──────────────────────────
  async customerHistory(jobId: string) {
    const ctx = await this.jobContext(jobId);
    return this.answer('Brief the worker on this customer/property history and preferences before arrival.', JSON.stringify(ctx).slice(0, 1500), ctx.contactId);
  }
  async recommendedActions(jobId: string) {
    const ctx = await this.jobContext(jobId);
    return this.answer('Recommend the next best actions for this job in priority order. Be specific and practical.', JSON.stringify(ctx).slice(0, 1500), ctx.contactId);
  }
  async upsell(jobId: string) {
    const ctx = await this.jobContext(jobId);
    return this.answer('Suggest relevant upsell and cross-sell opportunities for this customer based on the work and history. Only suggest genuinely useful services.', JSON.stringify(ctx).slice(0, 1500), ctx.contactId);
  }

  // ── internals ──────────────────────────────────────────────────────────
  private async jobContext(jobId: string) {
    const job = await this.prisma.db.job.findUniqueOrThrow({ where: { id: jobId } });
    const [activities, forms, materials] = await Promise.all([
      this.prisma.db.activity.findMany({ where: { jobId }, orderBy: { createdAt: 'desc' }, take: 15 }),
      this.prisma.db.fieldFormSubmission.findMany({ where: { jobId }, take: 10 }),
      this.prisma.db.materialUsage.findMany({ where: { jobId }, take: 20 }),
    ]);
    return { job, activities, forms, materials, contactId: job.contactId };
  }

  private async assist(persona: string, query: string, jobId?: string) {
    let contactId: string | null = null;
    if (jobId) {
      const job = await this.prisma.db.job.findUnique({ where: { id: jobId }, select: { contactId: true } });
      contactId = job?.contactId ?? null;
    }
    return this.answer(persona, query, contactId);
  }

  private async answer(persona: string, userContent: string, contactId: string | null) {
    const system = await this.brainContext.composeAgentContext({
      persona,
      query: userContent.slice(0, 400),
      role: 'STAFF',
      subject: contactId ? { type: MemorySubject.CUSTOMER, id: contactId } : undefined,
    });
    const res = await this.providers.llm().complete({ system, messages: [{ role: 'user', content: userContent }], maxTokens: 400 });
    return { answer: res.text };
  }
}
