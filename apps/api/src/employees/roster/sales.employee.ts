import { Injectable } from '@nestjs/common';
import { BaseEmployeeAgent } from '../framework/base-employee.agent';
import { EmployeeKit } from '../framework/employee-kit.service';
import { AgentDefinition, EmployeeResult, ExecuteContext } from '../framework/employee.types';

/**
 * Sales AI — qualifies and scores leads, advances the pipeline, and generates
 * quotes/follow-ups. Reuses the CRM Lead model, Revenue DocumentsService, and
 * the Control Layer (its score becomes a DecisionRecord expecting job.assigned).
 */
@Injectable()
export class SalesEmployee extends BaseEmployeeAgent {
  readonly definition: AgentDefinition = {
    key: 'sales',
    name: 'Sales AI',
    department: 'Sales',
    description: 'Lead qualification, scoring, quoting, follow-up and pipeline movement.',
    defaultAuthority: 'AUTONOMOUS',
    tools: ['llm', 'generate_quote', 'send_document', 'sms', 'email', 'search_knowledge'],
    triggers: ['lead.created'],
  };

  constructor(kit: EmployeeKit) {
    super(kit);
  }

  protected execute(ctx: ExecuteContext): Promise<EmployeeResult> {
    switch (ctx.input.type) {
      case 'qualify_score':
        return this.qualifyScore(ctx);
      case 'generate_quote':
        return this.generateQuote(ctx);
      case 'followup':
        return this.followup(ctx);
      default:
        return Promise.resolve({ ok: false, summary: `Sales AI: unknown task ${ctx.input.type}` });
    }
  }

  private async qualifyScore(ctx: ExecuteContext): Promise<EmployeeResult> {
    const leadId = ctx.input.subjects?.leadId;
    if (!leadId) return { ok: false, summary: 'no lead to score' };
    const lead = await this.kit.prisma.db.lead.findUnique({ where: { id: leadId } });
    if (!lead) return { ok: false, summary: 'lead not found' };

    let score = 30;
    if (lead.urgency === 'EMERGENCY') score += 30;
    else if (lead.urgency === 'HIGH') score += 20;
    if (lead.serviceType) score += 15;
    if (lead.estimatedValue && Number(lead.estimatedValue) > 0) score += 15;
    if (lead.source === 'portal' || lead.source === 'voice') score += 10;
    score = Math.min(100, score);

    await this.kit.prisma.db.lead.update({
      where: { id: leadId },
      data: { stage: score >= 50 ? 'QUALIFIED' : 'CONTACTED', intake: { ...(lead.intake as any), salesScore: score } as any },
    });
    await this.activity({ type: 'AI_ACTION', title: `Sales AI qualified lead — score ${score}/100`, leadId, contactId: lead.contactId });
    await this.logDecision(ctx.taskId, 'qualify_score', {
      reason: `Scored ${score}/100 from urgency, service, value and source`,
      confidence: score / 100,
      expectedSignal: 'job.assigned',
      expectedValue: lead.estimatedValue ? Number(lead.estimatedValue) : undefined,
      deadlineHours: 168,
      subjects: { leadId, contactId: lead.contactId },
    });

    if (score >= 70 && ctx.autonomous) this.handoff('operations_manager', { type: 'monitor' });
    return { ok: true, summary: `Lead scored ${score}/100`, output: { score } };
  }

  private async generateQuote(ctx: ExecuteContext): Promise<EmployeeResult> {
    const p = ctx.input.params ?? {};
    const quote = await this.kit.documents.createQuote({
      leadId: ctx.input.subjects?.leadId ?? undefined,
      jobId: ctx.input.subjects?.jobId ?? undefined,
      contactId: ctx.input.subjects?.contactId ?? undefined,
      title: (p.title as string) ?? 'Proposal',
      lineItems: (p.lineItems as any[]) ?? [],
    });
    await this.activity({ type: 'DOCUMENT', title: 'Sales AI generated a quote', contactId: ctx.input.subjects?.contactId, leadId: ctx.input.subjects?.leadId });
    await this.logDecision(ctx.taskId, 'generate_quote', { reason: 'Proposal sent to qualified lead', expectedSignal: 'quote.accepted', deadlineHours: 336, subjects: ctx.input.subjects });
    return { ok: true, summary: 'Quote generated', output: { documentId: (quote as any).id } };
  }

  private async followup(ctx: ExecuteContext): Promise<EmployeeResult> {
    const p = ctx.input.params ?? {};
    const contactId = ctx.input.subjects?.contactId;
    const contact = contactId ? await this.kit.prisma.db.contact.findUnique({ where: { id: contactId } }) : null;
    const message = (p.message as string) ?? (await this.think('You are a concise, friendly sales rep writing a follow-up SMS under 300 chars.', `Write a follow-up to ${contact?.name ?? 'the customer'} about their inquiry.`, contactId));
    if (ctx.autonomous && contact?.phone) await this.useTool(ctx, 'sms', { to: contact.phone, body: message }, { reason: 'Lead follow-up' });
    await this.activity({ type: 'SMS', title: 'Sales AI follow-up', body: message, contactId });
    return { ok: true, summary: 'Follow-up sent', output: { message } };
  }
}
