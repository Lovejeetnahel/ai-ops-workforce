import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProviderFactory } from '../../integrations/provider-factory.service';
import { CommsService } from '../../integrations/comms.service';
import { BusinessBrainService } from '../../brain/business-brain.service';
import { JobsService } from '../../operations/jobs/jobs.service';
import { DispatchService } from '../../operations/dispatch/dispatch.service';
import { DocumentsService } from '../../revenue/documents.service';
import { PaymentsService } from '../../revenue/payments.service';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { AiUsageService } from './ai-usage.service';

type ToolFn = (args: any) => Promise<any>;

/**
 * The shared AI tool registry. Every employee acts through these named tools,
 * each of which wraps an EXISTING production service (comms, revenue, dispatch,
 * brain, LLM/vision). One implementation, reused by all agents — no duplicated
 * integration logic. Permission checks are enforced by the caller against the
 * employee's `tools` allowlist.
 */
@Injectable()
export class ToolRegistry {
  private readonly tools: Record<string, ToolFn>;

  constructor(
    prisma: PrismaService,
    providers: ProviderFactory,
    comms: CommsService,
    brain: BusinessBrainService,
    jobs: JobsService,
    dispatch: DispatchService,
    documents: DocumentsService,
    payments: PaymentsService,
    usage: AiUsageService,
  ) {
    const tid = () => tenantContext.tenantId;
    this.tools = {
      email: (a) => comms.sendEmail(tid(), { to: a.to, subject: a.subject, body: a.body }),
      sms: (a) => comms.sendSms(tid(), { to: a.to, body: a.body }),
      generate_quote: (a) => documents.createQuote(a),
      generate_invoice: (a) => documents.createInvoiceFromJob(a.jobId, a.lineItems),
      send_document: (a) => documents.send(a.id),
      payment_link: (a) => payments.createPaymentLink(a.documentId),
      dispatch_lead: (a) => dispatch.dispatchLead(a.leadId),
      update_job_status: (a) => jobs.updateStatus(a.jobId, a.status),
      search_knowledge: (a) => brain.search(a.query, { role: a.role ?? 'STAFF', topK: a.topK ?? 6 }),
      recall_memory: (a) => brain.recall(a.subjectType, a.subjectId),
      remember: (a) => brain.remember(a),
      ingest_knowledge: (a) => brain.ingest(a),
      llm: async (a) => {
        const llm = providers.llm();
        const res = await llm.complete({ system: a.system, messages: [{ role: 'user', content: a.user }], maxTokens: a.maxTokens ?? 400 });
        if (res.usage) await usage.record({ provider: llm.provider, model: llm.model, inputTokens: res.usage.inputTokens, outputTokens: res.usage.outputTokens, agentKey: a._agentKey, taskId: a._taskId });
        return { text: res.text };
      },
      vision: (a) => providers.vision().analyze({ url: a.url, hint: a.hint }),
      // ── SAFE read tools (Phase 3): real data for planner/Command Center ──
      business_snapshot: async () => {
        const [leadsByStage, overdueInvoices, bookingsToday, openConversations] = await Promise.all([
          prisma.db.lead.groupBy({ by: ['stage'], _count: { _all: true } } as any),
          prisma.db.document.count({ where: { type: 'INVOICE', status: 'SENT', createdAt: { lt: new Date(Date.now() - 7 * 86_400_000) } } }),
          prisma.db.booking.count({ where: { start: { gte: new Date(new Date().setHours(0, 0, 0, 0)), lt: new Date(new Date().setHours(24, 0, 0, 0)) } } }),
          prisma.db.conversation.count({ where: { status: 'OPEN' } }),
        ]);
        return { leadsByStage: (leadsByStage as any[]).map((g) => ({ stage: g.stage, count: g._count._all })), overdueInvoices, bookingsToday, openConversations };
      },
      list_leads: async (a) => {
        const leads = await prisma.db.lead.findMany({
          where: a.stage ? { stage: a.stage } : undefined,
          include: { contact: { select: { name: true, phone: true, email: true } } },
          orderBy: { updatedAt: 'desc' },
          take: Math.min(Number(a.take ?? 20), 50),
        });
        return leads.map((l) => ({ id: l.id, stage: l.stage, contact: l.contact?.name ?? null, phone: l.contact?.phone ?? null, email: l.contact?.email ?? null, updatedAt: l.updatedAt }));
      },
      list_overdue_invoices: async (a) => {
        const days = Math.min(Number(a.olderThanDays ?? 7), 365);
        const invoices = await prisma.db.document.findMany({
          where: { type: 'INVOICE', status: 'SENT', createdAt: { lt: new Date(Date.now() - days * 86_400_000) } },
          orderBy: { createdAt: 'asc' },
          take: 50,
          select: { id: true, title: true, amount: true, contactId: true, createdAt: true },
        });
        return invoices.map((i) => ({ ...i, daysOutstanding: Math.floor((Date.now() - new Date(i.createdAt).getTime()) / 86_400_000) }));
      },
    };
  }

  has(name: string): boolean {
    return !!this.tools[name];
  }

  list(): string[] {
    return Object.keys(this.tools);
  }

  /**
   * Raw execution. INTERNAL ONLY — no permission, risk or approval checks
   * happen here. Every agent/controller-facing path must go through
   * ToolGateway.execute(), which is the single enforced entry point. Marked
   * with an underscore + doc rather than `private` only because ToolGateway
   * (a sibling class) needs it; nothing else may call it.
   * @internal
   */
  _rawRun(name: string, args: Record<string, unknown>): Promise<any> {
    const tool = this.tools[name];
    if (!tool) return Promise.reject(new Error(`Unknown tool: ${name}`));
    return tool(args);
  }
}
