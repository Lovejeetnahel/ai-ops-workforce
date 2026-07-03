import { Injectable, Logger } from '@nestjs/common';
import { DomainEvent } from '../automation/events';
import { OutcomePredictor, ExpectedOutcome } from './outcome-predictor';
import { DecisionService, DecisionMeta } from './decision.service';
import { OutcomeEvaluator } from './outcome-evaluator.service';
import { ValueLedgerService } from './value-ledger.service';

/**
 * The control-loop facade the automation worker calls. Two entry points:
 *
 *  • observe(event)      — feedback half: resolve open decisions this event
 *                          satisfies, then sweep expired ones to MISSED.
 *  • aroundAction(meta,  — decision half: predict the outcome, open a
 *    exec)                 DecisionRecord BEFORE the action runs, run the real
 *                          action unchanged, then book cost / immediate result.
 *
 * GUARANTEE: the wrapped `exec()` ALWAYS runs and its errors ALWAYS propagate,
 * so wrapping cannot change existing behavior. Control-layer failures are
 * swallowed (logged) — they can never block or alter an action.
 */
@Injectable()
export class ControlPlaneService {
  private readonly logger = new Logger(ControlPlaneService.name);

  constructor(
    private readonly predictor: OutcomePredictor,
    private readonly decisions: DecisionService,
    private readonly evaluator: OutcomeEvaluator,
    private readonly ledger: ValueLedgerService,
  ) {}

  /** Feedback half of the loop — runs on every event before rules are applied. */
  async observe(event: DomainEvent): Promise<void> {
    try {
      await this.evaluator.onEvent(event);
    } catch (err) {
      this.logger.warn(`observe/evaluate failed: ${(err as Error).message}`);
    }
    try {
      await this.decisions.sweepExpired();
    } catch (err) {
      this.logger.warn(`observe/sweep failed: ${(err as Error).message}`);
    }
  }

  /** Decision half — wraps a single action execution with a DecisionRecord. */
  async aroundAction(meta: DecisionMeta, exec: () => Promise<void>): Promise<void> {
    let decisionId: string | undefined;
    let expected: ExpectedOutcome | undefined;

    try {
      expected = this.predictor.predict(meta.action, meta.event);
      const decision = await this.decisions.open(meta, expected);
      decisionId = decision.id;
    } catch (err) {
      // Never let decision-recording block the action.
      this.logger.warn(`decision.open failed: ${(err as Error).message}`);
    }

    try {
      await exec(); // the real, unchanged action
    } catch (err) {
      if (decisionId) await this.decisions.noteExecutionError(decisionId, err);
      throw err; // preserve BullMQ retry semantics exactly
    }

    if (!decisionId) return;
    try {
      await this.ledger.recordCost(meta.action.type, decisionId);
      if (expected?.immediate) await this.decisions.markImmediateMet(decisionId);
    } catch (err) {
      this.logger.warn(`post-action control failed: ${(err as Error).message}`);
    }
  }
}
