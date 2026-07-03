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
      llm: async (a) => ({ text: (await providers.llm().complete({ system: a.system, messages: [{ role: 'user', content: a.user }], maxTokens: a.maxTokens ?? 400 })).text }),
      vision: (a) => providers.vision().analyze({ url: a.url, hint: a.hint }),
    };
    void prisma; // reserved for future direct-data tools
  }

  has(name: string): boolean {
    return !!this.tools[name];
  }

  list(): string[] {
    return Object.keys(this.tools);
  }

  run(name: string, args: Record<string, unknown>): Promise<any> {
    const tool = this.tools[name];
    if (!tool) return Promise.reject(new Error(`Unknown tool: ${name}`));
    return tool(args);
  }
}
