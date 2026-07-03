import { Injectable } from '@nestjs/common';
import { Policy } from './policy.interface';
import { RulePolicy } from './rule.policy';
import { ScoredPolicy } from './scored.policy';

/**
 * Selects the active policy. DEFAULT and only active policy = RulePolicy, so the
 * system behaves exactly as before. ScoredPolicy is held but never returned by
 * active() — flipping to autonomous decisioning later is a change confined to
 * this one method.
 */
@Injectable()
export class PolicyRegistry {
  constructor(
    private readonly rule: RulePolicy,
    private readonly scored: ScoredPolicy,
  ) {}

  active(): Policy {
    return this.rule; // RulePolicy only — do NOT activate ScoredPolicy yet.
  }

  list(): string[] {
    return [this.rule.name, this.scored.name];
  }
}
