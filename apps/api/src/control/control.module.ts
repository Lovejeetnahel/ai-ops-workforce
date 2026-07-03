import { Global, Module } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module';
import { DecisionService } from './decision.service';
import { OutcomePredictor } from './outcome-predictor';
import { OutcomeEvaluator } from './outcome-evaluator.service';
import { ValueLedgerService } from './value-ledger.service';
import { ControlPlaneService } from './control-plane.service';
import { ControlController } from './control.controller';
import { RulePolicy } from './policy/rule.policy';
import { ScoredPolicy } from './policy/scored.policy';
import { PolicyRegistry } from './policy/policy.registry';

/**
 * The Control Layer — the accountable decision/outcome/feedback loop.
 *
 * @Global so the automation worker can inject ControlPlaneService + PolicyRegistry
 * WITHOUT AutomationModule importing this module — that one-way edge
 * (Control → Automation, for RulePolicy wrapping AutomationService) keeps the
 * graph acyclic. Nothing existing is modified; this only adds.
 */
@Global()
@Module({
  imports: [AutomationModule], // RulePolicy wraps the existing AutomationService
  controllers: [ControlController],
  providers: [
    DecisionService,
    OutcomePredictor,
    OutcomeEvaluator,
    ValueLedgerService,
    ControlPlaneService,
    RulePolicy,
    ScoredPolicy,
    PolicyRegistry,
  ],
  exports: [ControlPlaneService, PolicyRegistry, DecisionService, ValueLedgerService],
})
export class ControlModule {}
