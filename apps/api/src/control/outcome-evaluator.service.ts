import { Injectable, Logger } from '@nestjs/common';
import { ValueType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { DomainEvent } from '../automation/events';
import { DecisionService, SubjectRefs } from './decision.service';
import { ValueLedgerService } from './value-ledger.service';

/** Real business signals that can resolve an open decision (NOT logs). */
const SIGNALS = new Set([
  'lead.created',
  'job.assigned',
  'job.completed',
  'booking.confirmed',
  'payment.succeeded',
  'message.inbound',
]);

/**
 * Closes the loop. For each downstream domain event, it finds the OPEN decisions
 * whose predicted outcome this event satisfies (matched by business subject —
 * contact / lead / job), marks them MET, and computes the realized value. It
 * reads ONLY business state (leads, contacts, payments), never logs.
 *
 * NOTE on `payment.succeeded`: PaymentsService.settle() is the authoritative,
 * unconditional booker of REVENUE_COLLECTED (it runs for every successful
 * payment, with or without a matching decision — see its docstring for why).
 * So here we still resolve the matching decision to MET (AI-attribution
 * bookkeeping), but skip booking a second ledger entry for the same dollars.
 * Every other signal has no such unconditional booker, so booking here remains
 * the only place that records that value.
 */
@Injectable()
export class OutcomeEvaluator {
  private readonly logger = new Logger(OutcomeEvaluator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly decisions: DecisionService,
    private readonly ledger: ValueLedgerService,
  ) {}

  async onEvent(event: DomainEvent): Promise<number> {
    if (!SIGNALS.has(event.name)) return 0;

    const subjects = await this.subjectsForSignal(event);
    const open = await this.decisions.findOpenForSignal(event.name, subjects);
    let resolved = 0;

    for (const d of open as any[]) {
      const { valueType, amount } = await this.valueFor(d, event);
      await this.decisions.resolve(d.id, 'MET', amount, `met by ${event.name}`);
      if (event.name !== 'payment.succeeded') {
        await this.ledger.record({
          decisionId: d.id,
          actionType: d.actionType,
          agent: (d.actionParams as any)?.agent ?? d.actionType,
          valueType,
          amount,
          source: event.name,
        });
      }
      resolved++;
    }
    if (resolved) this.logger.debug(`${event.name} resolved ${resolved} decision(s)`);
    return resolved;
  }

  /** Resolve the subject ids carried by a signal (phone → contact for replies). */
  private async subjectsForSignal(event: DomainEvent): Promise<SubjectRefs> {
    const p = (event.payload ?? {}) as any;
    if (event.name === 'message.inbound') {
      let contactId: string | null = p.contact?.id ?? null;
      if (!contactId && p.from) {
        const c = await this.prisma.db.contact.findFirst({ where: { phone: p.from } });
        contactId = c?.id ?? null;
      }
      return { contactId };
    }
    return { contactId: p.contact?.id ?? null, leadId: p.lead?.id ?? null, jobId: p.job?.id ?? null };
  }

  /** Realized value, read from real business records where possible. */
  private async valueFor(d: any, event: DomainEvent): Promise<{ valueType: ValueType; amount: number }> {
    const p = (event.payload ?? {}) as any;
    switch (event.name) {
      case 'payment.succeeded':
        return { valueType: 'REVENUE_COLLECTED', amount: num(p.payment?.amount) ?? num(d.expectedValue) ?? 0 };

      case 'job.assigned':
      case 'booking.confirmed':
      case 'job.completed': {
        let amount = num(d.expectedValue) ?? 0;
        if (d.leadId) {
          const lead = await this.prisma.db.lead.findUnique({
            where: { id: d.leadId },
            select: { estimatedValue: true },
          });
          amount = num(lead?.estimatedValue) ?? amount;
        }
        return { valueType: 'REVENUE_BOOKED', amount };
      }

      case 'lead.created': {
        const agent = (d.actionParams as any)?.agent;
        return { valueType: agent === 'chat' ? 'CONVERSION' : 'LEAD_RECOVERED', amount: num(d.expectedValue) ?? 0 };
      }

      case 'message.inbound':
      default:
        return { valueType: 'ENGAGEMENT', amount: 0 };
    }
  }
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
