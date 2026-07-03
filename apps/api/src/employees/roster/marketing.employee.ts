import { Injectable } from '@nestjs/common';
import { BaseEmployeeAgent } from '../framework/base-employee.agent';
import { EmployeeKit } from '../framework/employee-kit.service';
import { AgentDefinition, EmployeeResult, ExecuteContext } from '../framework/employee.types';

/**
 * Marketing AI — campaign/ad/email copy generation and review requests. Copy is
 * stored as Business Brain knowledge; review requests go out via the comms tools
 * and create accountable decisions.
 */
@Injectable()
export class MarketingEmployee extends BaseEmployeeAgent {
  readonly definition: AgentDefinition = {
    key: 'marketing',
    name: 'Marketing AI',
    department: 'Marketing',
    description: 'Campaigns, ad/email/SMS copy, content calendar, review generation, performance.',
    defaultAuthority: 'APPROVE',
    tools: ['llm', 'sms', 'email', 'ingest_knowledge'],
    triggers: ['job.completed'],
  };

  constructor(kit: EmployeeKit) {
    super(kit);
  }

  protected execute(ctx: ExecuteContext): Promise<EmployeeResult> {
    switch (ctx.input.type) {
      case 'campaign':
        return this.campaign(ctx);
      case 'review_request':
        return this.reviewRequest(ctx);
      default:
        return Promise.resolve({ ok: false, summary: `Marketing AI: unknown task ${ctx.input.type}` });
    }
  }

  private async campaign(ctx: ExecuteContext): Promise<EmployeeResult> {
    const topic = String(ctx.input.params?.topic ?? 'seasonal promotion');
    const channel = String(ctx.input.params?.channel ?? 'email');
    const copy = await this.think(`You are a marketing copywriter. Produce ${channel} campaign copy with a subject line and body. Persuasive, on-brand, concise.`, `Campaign topic: ${topic}.`);
    await this.kit.brain.ingest({ type: 'DOCUMENT', title: `Campaign — ${topic} (${channel})`, content: copy, visibility: 'INTERNAL', source: 'marketing-ai' });
    await this.activity({ type: 'AI_ACTION', title: `Marketing AI created a ${channel} campaign: ${topic}` });
    return { ok: true, summary: `Campaign drafted: ${topic}`, output: { channel, copy } };
  }

  private async reviewRequest(ctx: ExecuteContext): Promise<EmployeeResult> {
    const contactId = ctx.input.subjects?.contactId;
    if (!contactId) return { ok: false, summary: 'no contact' };
    const contact = await this.kit.prisma.db.contact.findUnique({ where: { id: contactId } });
    const message = `Hi ${contact?.name ?? 'there'}, we'd love a quick review of your recent service — it really helps! Thank you.`;
    if (ctx.autonomous && contact?.phone) await this.kit.tools.run('sms', { to: contact.phone, body: message });
    await this.activity({ type: 'SMS', title: 'Marketing AI requested a review', body: message, contactId, jobId: ctx.input.subjects?.jobId });
    await this.logDecision(ctx.taskId, 'review_request', { reason: 'Post-job review solicitation', expectedSignal: 'message.inbound', deadlineHours: 120, subjects: { contactId } });
    return { ok: true, summary: 'Review requested' };
  }
}
