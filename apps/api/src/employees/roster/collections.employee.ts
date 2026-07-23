import { Injectable } from '@nestjs/common';
import { BaseEmployeeAgent } from '../framework/base-employee.agent';
import { EmployeeKit } from '../framework/employee-kit.service';
import { AgentDefinition, EmployeeResult, ExecuteContext } from '../framework/employee.types';

/**
 * Collections AI — finds overdue invoices, sends graduated reminders, scores
 * risk, and creates accountable decisions expecting payment.succeeded. Reuses
 * the Revenue Document/Payment data and the comms tools.
 */
@Injectable()
export class CollectionsEmployee extends BaseEmployeeAgent {
  readonly definition: AgentDefinition = {
    key: 'collections',
    name: 'Collections AI',
    department: 'Finance',
    description: 'Invoice reminders, payment follow-ups, escalation, risk scoring.',
    defaultAuthority: 'APPROVE', // owner can raise to AUTONOMOUS per employee — approval-first is the published default
    tools: ['llm', 'sms', 'email', 'payment_link'],
    triggers: [],
  };

  constructor(kit: EmployeeKit) {
    super(kit);
  }

  protected execute(ctx: ExecuteContext): Promise<EmployeeResult> {
    if (ctx.input.type === 'run') return this.run(ctx);
    return Promise.resolve({ ok: false, summary: `Collections AI: unknown task ${ctx.input.type}` });
  }

  private async run(ctx: ExecuteContext): Promise<EmployeeResult> {
    const overdueDays = Number(ctx.input.params?.overdueDays ?? 7);
    const cutoff = new Date(Date.now() - overdueDays * 86_400_000);
    const invoices = await this.kit.prisma.db.document.findMany({
      where: { type: 'INVOICE', status: { in: ['SENT', 'VIEWED'] }, createdAt: { lt: cutoff } },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    let actioned = 0;
    for (const inv of invoices) {
      const contact = inv.contactId ? await this.kit.prisma.db.contact.findUnique({ where: { id: inv.contactId } }) : null;
      const days = Math.floor((Date.now() - new Date(inv.createdAt).getTime()) / 86_400_000);
      const risk = days > 45 ? 'high' : days > 21 ? 'medium' : 'low';
      const payUrl = (inv.data as any)?.payUrl;
      const message = `Reminder: invoice "${inv.title}" for $${inv.amount ?? ''} is ${days} days past due.${payUrl ? ` Pay here: ${payUrl}` : ''}`;

      if (ctx.autonomous) {
        if (contact?.email) await this.useTool(ctx, 'email', { to: contact.email, subject: 'Payment reminder', body: message }, { reason: `Invoice ${days}d overdue` });
        else if (contact?.phone) await this.useTool(ctx, 'sms', { to: contact.phone, body: message }, { reason: `Invoice ${days}d overdue` });
      }
      await this.activity({ type: 'PAYMENT', title: `Collections AI reminder (${risk} risk, ${days}d overdue)`, body: message, contactId: inv.contactId, jobId: inv.jobId });
      await this.logDecision(ctx.taskId, 'collections_reminder', {
        reason: `Invoice ${days}d overdue, risk=${risk}`,
        confidence: risk === 'high' ? 0.5 : 0.8,
        expectedSignal: 'payment.succeeded',
        expectedValue: inv.amount ? Number(inv.amount) : undefined,
        deadlineHours: 168,
        subjects: { contactId: inv.contactId, jobId: inv.jobId },
      });
      actioned++;
    }
    return { ok: true, summary: `Collections processed ${actioned} overdue invoice(s)`, output: { actioned } };
  }
}
