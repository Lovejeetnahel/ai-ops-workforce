import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { DecisionService } from './decision.service';
import { ValueLedgerService } from './value-ledger.service';
import { PolicyRegistry } from './policy/policy.registry';

/**
 * Read-only introspection over the control loop — the backend truth source, not
 * an analytics UI. Lets operators (and tests) verify decisions, outcomes, and
 * realized value. Owner/admin only.
 */
@Controller('control')
@UseGuards(RolesGuard)
export class ControlController {
  constructor(
    private readonly decisions: DecisionService,
    private readonly ledger: ValueLedgerService,
    private readonly policies: PolicyRegistry,
  ) {}

  @Get('decisions')
  @Roles('ADMIN')
  recent(@Query('limit') limit?: string) {
    return this.decisions.recent(limit ? Math.max(1, Math.min(500, parseInt(limit, 10) || 50)) : 50);
  }

  @Get('decisions/stats')
  @Roles('ADMIN')
  stats() {
    return this.decisions.stats();
  }

  @Get('ledger')
  @Roles('ADMIN')
  ledgerSummary() {
    return this.ledger.summary();
  }

  @Get('policy')
  @Roles('ADMIN')
  policy() {
    return { active: this.policies.active().name, available: this.policies.list() };
  }
}
