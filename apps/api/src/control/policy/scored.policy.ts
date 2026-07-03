import { Injectable } from '@nestjs/common';
import { DomainEvent } from '../../automation/events';
import { Policy, PolicyDecision } from './policy.interface';

/**
 * FUTURE policy — would rank candidate actions by expected value toward the
 * tenant's objectives (using the ValueLedger as the reward signal). It is
 * intentionally INERT: registered for the interface but never selected as the
 * active policy. No LLM, no scoring logic yet. Activating it is a later phase
 * and a one-line change in PolicyRegistry — agents stay untouched.
 */
@Injectable()
export class ScoredPolicy implements Policy {
  readonly name = 'scored';

  async decide(_event: DomainEvent): Promise<PolicyDecision> {
    throw new Error('ScoredPolicy is not activated yet. Active policy is "rule".');
  }
}
