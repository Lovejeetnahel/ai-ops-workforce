import { Injectable } from '@nestjs/common';
import { Agent, AgentContext, AgentResult } from '../agent.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBus } from '../../automation/event-bus';
import { DomainEvents } from '../../automation/events';
import { ModuleConfigService } from '../../common/module-config/module-config.service';
import { ProviderFactory } from '../../integrations/provider-factory.service';
import { PaymentsService } from '../../revenue/payments.service';

/**
 * DOCUMENT & ADMIN AGENT — generates invoices, quotes, forms and contracts from
 * the tenant's industry-module templates, renders the body, stores a Document
 * record (PDF URL would come from a render service / object storage), and — for
 * invoices — attaches a Stripe payment link. Replaces the admin assistant's
 * paperwork.
 */
@Injectable()
export class DocumentAgent implements Agent {
  readonly name = 'document';

  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
    private readonly moduleConfig: ModuleConfigService,
    private readonly providers: ProviderFactory,
    private readonly payments: PaymentsService,
  ) {}

  async run(ctx: AgentContext): Promise<AgentResult> {
    const tenantId = ctx.event!.tenantId;
    const templateKey = (ctx.params?.template as string) ?? 'invoice';
    const payload = ctx.event!.payload as any;

    const config = await this.moduleConfig.forTenant(tenantId);
    const template = config.templates.find((t) => t.key === templateKey);
    if (!template) return { agent: this.name, ok: false, summary: `no template "${templateKey}"` };

    // Gather render context from the related job/contact.
    const jobId = payload.job?.id ?? (ctx.params?.jobId as string);
    const job = jobId ? await this.prisma.db.job.findUnique({ where: { id: jobId }, include: { contact: true } }) : null;
    const renderCtx = {
      contact: job?.contact ?? payload.contact ?? {},
      job: job ?? payload.job ?? {},
      document: { number: `${Date.now()}`.slice(-6) },
      total: (ctx.params?.amount as number) ?? (job?.metadata as any)?.['total'] ?? 0,
      lineItems: (ctx.params?.lineItems as unknown[]) ?? [],
      checklist: (ctx.params?.checklist as string[]) ?? [],
    };

    const rendered = this.render(template.body, renderCtx);
    const amount = Number(renderCtx.total) || null;

    const doc = await this.prisma.db.document.create({
      data: {
        contactId: job?.contactId ?? null,
        jobId: job?.id ?? null,
        leadId: job?.leadId ?? null,
        type: template.type,
        status: 'DRAFT',
        templateKey,
        title: template.label,
        amount: amount as any,
        data: { rendered } as any,
      } as any,
    });

    // Invoices get a tracked payment link via the shared PaymentsService
    // (single implementation; also creates the PENDING Payment row).
    let payUrl: string | undefined;
    if (template.type === 'INVOICE' && amount && amount > 0) {
      const link = await this.payments.createPaymentLink(doc.id);
      payUrl = link.url;
    }

    await this.bus.emit({
      name: DomainEvents.DOCUMENT_GENERATED,
      tenantId,
      payload: { document: { id: doc.id, type: doc.type, payUrl }, contact: renderCtx.contact },
    });

    return { agent: this.name, ok: true, summary: `generated ${template.label} (${doc.id})`, emitted: [DomainEvents.DOCUMENT_GENERATED] };
  }

  /** Minimal Handlebars-style renderer: {{path}}, {{#each list}}…{{/each}}. */
  private render(tpl: string, ctx: any): string {
    let out = tpl.replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_m, key, inner) => {
      const list = ctx[key] ?? [];
      return list
        .map((item: any) =>
          inner.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_mm: string, p: string) =>
            p === 'this' ? String(item) : String(this.path(item, p) ?? ''),
          ),
        )
        .join('');
    });
    out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, p) => String(this.path(ctx, p) ?? ''));
    return out;
  }

  private path(obj: any, p: string) {
    return p.split('.').reduce((a, k) => (a == null ? a : a[k]), obj);
  }
}
