import { Injectable } from '@nestjs/common';
import { DomainEvent } from '../automation/events';

export interface ExpectedOutcome {
  /**
   * Immediate = structural action with no external signal (resolved MET on
   * successful execution). Deferred = waits for a business signal.
   */
  immediate: boolean;
  /** Downstream event whose occurrence satisfies this action's intent. */
  signal?: string;
  /** Hours until the outcome is considered MISSED. */
  deadlineHours?: number;
  /** Kind of value realized if the outcome is MET. */
  valueType?: 'REVENUE_BOOKED' | 'REVENUE_COLLECTED' | 'LEAD_RECOVERED' | 'CONVERSION' | 'ENGAGEMENT';
  /** Best-effort expected $ value known at decision time (from the event). */
  expectedValue?: number | null;
}

interface ActionLike {
  type: string;
  params?: Record<string, unknown>;
}

/**
 * Maps an automation action to the business outcome it is SUPPOSED to produce —
 * the hypothesis recorded before the action executes. Pure + deterministic; no
 * side effects. This is the table that turns "fire and forget" into "predict
 * then verify".
 */
@Injectable()
export class OutcomePredictor {
  predict(action: ActionLike, event: DomainEvent): ExpectedOutcome {
    const params = (action.params ?? {}) as any;
    const payload = (event.payload ?? {}) as any;
    const leadValue = num(payload.lead?.estimatedValue);

    switch (action.type) {
      case 'SEND_SMS':
      case 'SEND_WHATSAPP':
        return { immediate: false, signal: 'message.inbound', deadlineHours: 24, valueType: 'ENGAGEMENT' };

      case 'SEND_EMAIL':
        return { immediate: false, signal: 'message.inbound', deadlineHours: 72, valueType: 'ENGAGEMENT' };

      case 'ASSIGN_STAFF':
      case 'CREATE_BOOKING':
        return { immediate: false, signal: 'job.assigned', deadlineHours: 168, valueType: 'REVENUE_BOOKED', expectedValue: leadValue };

      case 'GENERATE_DOCUMENT':
        return params.template === 'invoice'
          ? { immediate: false, signal: 'payment.succeeded', deadlineHours: 720, valueType: 'REVENUE_COLLECTED' }
          : { immediate: true };

      case 'TRIGGER_AGENT':
        return this.predictAgent(String(params.agent ?? ''), leadValue);

      // Structural actions: success == executed.
      case 'UPDATE_STAGE':
      case 'CREATE_TASK':
      case 'WAIT':
        return { immediate: true };

      default:
        return { immediate: true };
    }
  }

  private predictAgent(agent: string, leadValue: number | null): ExpectedOutcome {
    switch (agent) {
      case 'crm':
        return { immediate: false, signal: 'lead.created', deadlineHours: 1, valueType: 'LEAD_RECOVERED', expectedValue: leadValue };
      case 'dispatch':
        return { immediate: false, signal: 'job.assigned', deadlineHours: 168, valueType: 'REVENUE_BOOKED', expectedValue: leadValue };
      case 'chat':
        return { immediate: false, signal: 'lead.created', deadlineHours: 24, valueType: 'CONVERSION', expectedValue: leadValue };
      case 'followup':
        return { immediate: false, signal: 'message.inbound', deadlineHours: 72, valueType: 'ENGAGEMENT' };
      default:
        return { immediate: true };
    }
  }
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
