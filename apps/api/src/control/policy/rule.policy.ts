import { Injectable } from '@nestjs/common';
import { DomainEvent } from '../../automation/events';
import { AutomationService } from '../../automation/automation.service';
import { Policy, PolicyDecision } from './policy.interface';

/**
 * The DEFAULT policy — a thin wrapper over the existing AutomationService. It
 * returns exactly the rules the engine already resolves, so behavior is
 * byte-for-byte identical to before the control layer existed. The only
 * difference is that the decision now flows through a named, swappable seam.
 */
@Injectable()
export class RulePolicy implements Policy {
  readonly name = 'rule';

  constructor(private readonly automation: AutomationService) {}

  async decide(event: DomainEvent): Promise<PolicyDecision> {
    return { policy: this.name, rules: await this.automation.resolve(event) };
  }
}
