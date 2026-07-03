import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
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
}
