import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { BillingService } from './billing.service';

@Controller('billing')
@UseGuards(RolesGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  @Roles('STAFF')
  plans() {
    return this.billing.plans();
  }

  @Get('subscription')
  @Roles('ADMIN')
  subscription() {
    return this.billing.current();
  }

  @Post('subscribe')
  @Roles('OWNER')
  subscribe(@Body() body: { planKey: string; seats?: number }) {
    return this.billing.subscribe(body.planKey, body.seats);
  }

  @Get('summary')
  @Roles('ADMIN')
  summary() {
    return this.billing.summary();
  }

  /** Sprint 3: live usage vs plan limits (all real counts). */
  @Get('usage')
  @Roles('ADMIN')
  usage() {
    return this.billing.usage();
  }

  /** Sprint 3: feature-gate check (honest warnings, never silent). */
  @Get('gate/:feature')
  @Roles('STAFF')
  gate(@Param('feature') feature: string) {
    if (feature !== 'staff_seat' && feature !== 'ai_task') throw new BadRequestException('Unknown feature gate');
    return this.billing.gate(feature);
  }
}
