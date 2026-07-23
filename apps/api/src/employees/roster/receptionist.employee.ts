import { Injectable } from '@nestjs/common';
import { BaseEmployeeAgent } from '../framework/base-employee.agent';
import { EmployeeKit } from '../framework/employee-kit.service';
import { AgentDefinition, EmployeeResult, ExecuteContext } from '../framework/employee.types';

/**
 * AI Receptionist — answers questions from Business Brain knowledge and
 * summarizes conversations. Omnichannel intake itself reuses the existing Voice
 * and Chat agents via the AgentRegistry, so there is no duplicate intake logic.
 */
@Injectable()
export class ReceptionistEmployee extends BaseEmployeeAgent {
  readonly definition: AgentDefinition = {
    key: 'receptionist',
    name: 'AI Receptionist',
    department: 'Front Office',
    description: 'Answers, qualifies, routes and books across voice/chat/SMS/email/portal; conversation summaries.',
    defaultAuthority: 'APPROVE', // owner can raise to AUTONOMOUS per employee — approval-first is the published default
    tools: ['llm', 'search_knowledge'],
    triggers: ['customer.booking.requested'],
  };

  constructor(kit: EmployeeKit) {
    super(kit);
  }

  protected execute(ctx: ExecuteContext): Promise<EmployeeResult> {
    switch (ctx.input.type) {
      case 'answer':
        return this.answer(ctx);
      case 'summarize_conversation':
        return this.summarize(ctx);
      default:
        return Promise.resolve({ ok: false, summary: `AI Receptionist: unknown task ${ctx.input.type}` });
    }
  }

  private async answer(ctx: ExecuteContext): Promise<EmployeeResult> {
    const question = String(ctx.input.params?.question ?? '');
    const answer = await this.think('You are a helpful, professional receptionist. Answer using company knowledge only; offer to connect them to the team if unsure.', question, ctx.input.subjects?.contactId);
    await this.activity({ type: 'NOTE', title: 'AI Receptionist answered a question', body: question, contactId: ctx.input.subjects?.contactId });
    return { ok: true, summary: 'Answered', output: { answer } };
  }

  private async summarize(ctx: ExecuteContext): Promise<EmployeeResult> {
    const conversationId = String(ctx.input.params?.conversationId ?? '');
    const messages = await this.kit.prisma.db.message.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' }, take: 50 });
    if (messages.length === 0) return { ok: false, summary: 'no messages' };
    const transcript = messages.map((m) => `${m.author}: ${m.body}`).join('\n');
    const summary = await this.kit.complete('Summarize this conversation in 2-3 sentences with any action items.', transcript.slice(0, 2000), 200);
    await this.activity({ type: 'NOTE', title: 'AI Receptionist conversation summary', body: summary });
    return { ok: true, summary: 'Conversation summarized', output: { summary } };
  }
}
