import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { DispatchService } from './dispatch.service';

/**
 * Manual trigger for the auto-assignment engine (the same engine the Dispatch
 * agent invokes on `lead.created`). Lets an operator dispatch a lead on demand.
 */
@Controller('dispatch')
@UseGuards(RolesGuard)
export class DispatchController {
  constructor(private readonly dispatch: DispatchService) {}

  @Post('lead/:leadId')
  @Roles('STAFF')
  dispatchLead(@Param('leadId') leadId: string) {
    return this.dispatch.dispatchLead(leadId);
  }
}
