import { Injectable } from '@nestjs/common';
import { BaseEmployeeAgent } from '../framework/base-employee.agent';
import { EmployeeKit } from '../framework/employee-kit.service';
import { AgentDefinition, EmployeeResult, ExecuteContext } from '../framework/employee.types';

/**
 * Customer Success AI — post-service satisfaction checks, health scoring, and
 * churn-risk detection. Reads CRM activity history, writes findings to Brain
 * memory, and reaches out via the comms tools.
 */
@Injectable()
export class CustomerSuccessEmployee extends BaseEmployeeAgent {
  readonly definition: AgentDefinition = {
    key: 'customer_success',
    name: 'Customer Success AI',
    department: 'Customer Success',
    description: 'Onboarding, check-ins, satisfaction, health scoring, churn prediction, expansion.',
    defaultAuthority: 'AUTONOMOUS',
    tools: ['llm', 'sms', 'email', 'recall_memory', 'remember'],
    triggers: ['job.completed', 'payment.succeeded'],
  };

  constructor(kit: EmployeeKit) {
    super(kit);
  }

  protected execute(ctx: ExecuteContext): Promise<EmployeeResult> {
    switch (ctx.input.type) {
      case 'satisfaction_check':
        return this.satisfactionCheck(ctx);
      case 'health_score':
        return this.healthScore(ctx);
      default:
        return Promise.resolve({ ok: false, summary: `Customer Success AI: unknown task ${ctx.input.type}` });
    }
  }

  private async satisfactionCheck(ctx: ExecuteContext): Promise<EmployeeResult> {
    const contactId = ctx.input.subjects?.contactId;
    if (!contactId) return { ok: false, summary: 'no contact' };
    const contact = await this.kit.prisma.db.contact.findUnique({ where: { id: contactId } });
    const message = `Hi ${contact?.name ?? 'there'}, thanks for choosing us! How was your experience? Reply 1-5 (5 = excellent).`;
    if (ctx.autonomous && contact?.phone) await this.kit.tools.run('sms', { to: contact.phone, body: message });
    await this.activity({ type: 'SMS', title: 'Customer Success AI satisfaction check', body: message, contactId, jobId: ctx.input.subjects?.jobId });
    await this.logDecision(ctx.taskId, 'satisfaction_check', { reason: 'Post-service CSAT outreach', expectedSignal: 'message.inbound', deadlineHours: 72, subjects: { contactId } });
    return { ok: true, summary: 'Satisfaction check sent' };
  }

  private async healthScore(ctx: ExecuteContext): Promise<EmployeeResult> {
    const contactId = ctx.input.subjects?.contactId;
    if (!contactId) return { ok: false, summary: 'no contact' };
    const [jobs, activities] = await Promise.all([
      this.kit.prisma.db.job.findMany({ where: { contactId }, select: { status: true, completedAt: true } }),
      this.kit.prisma.db.activity.count({ where: { contactId } }),
    ]);
    const completed = jobs.filter((j) => j.status === 'COMPLETED').length;
    const lastCompleted = jobs.map((j) => j.completedAt).filter(Boolean).sort().pop() as Date | undefined;
    const daysSince = lastCompleted ? Math.round((Date.now() - new Date(lastCompleted).getTime()) / 86_400_000) : 999;
    let health = 50 + completed * 10 - Math.min(40, Math.floor(daysSince / 30) * 10) + Math.min(10, activities);
    health = Math.max(0, Math.min(100, health));
    const churnRisk = health < 40;

    await this.remember(contactId, `Health score ${health}/100 (${completed} completed jobs, ${daysSince}d since last). Churn risk: ${churnRisk}.`, undefined, 'health_score');
    await this.activity({ type: 'AI_ACTION', title: `Customer Success AI health score: ${health}/100${churnRisk ? ' (churn risk)' : ''}`, contactId });
    if (churnRisk && ctx.autonomous) this.handoff('marketing', { type: 'campaign', subjects: { contactId }, params: { topic: 're-engagement', channel: 'email' } });
    return { ok: true, summary: `Health ${health}/100`, output: { health, churnRisk } };
  }
}
