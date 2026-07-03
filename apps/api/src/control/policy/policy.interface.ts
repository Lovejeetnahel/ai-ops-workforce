import { DomainEvent } from '../../automation/events';
import { ResolvedRule } from '../../automation/automation.service';

export interface PolicyDecision {
  /** Which policy produced this decision (recorded on every DecisionRecord). */
  policy: string;
  /** The ordered rules/actions to execute — identical shape the worker already runs. */
  rules: ResolvedRule[];
}

/**
 * The decision-making seam. A Policy answers "given this event, what should the
 * workforce do?". This is the swap point that lets the system evolve from
 * reactive (RulePolicy) to autonomous (ScoredPolicy/PlannerPolicy) WITHOUT
 * touching agents or action handlers. Only RulePolicy is active today.
 */
export interface Policy {
  readonly name: string;
  decide(event: DomainEvent): Promise<PolicyDecision>;
}
