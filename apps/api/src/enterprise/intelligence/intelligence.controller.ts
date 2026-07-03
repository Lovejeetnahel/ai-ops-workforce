import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { PredictionService } from './prediction.service';
import { BriefingService } from './briefing.service';

@Controller('intelligence')
@UseGuards(RolesGuard)
export class IntelligenceController {
  constructor(
    private readonly predictions: PredictionService,
    private readonly briefing: BriefingService,
  ) {}

  @Get('predictions')
  @Roles('ADMIN')
  list(@Query('type') type?: string) {
    return this.predictions.recent(type);
  }

  @Post('predict/revenue')
  @Roles('ADMIN')
  revenue(@Query('days') days?: string) {
    return this.predictions.revenueForecast(days ? Math.max(1, Math.min(365, parseInt(days, 10) || 30)) : 30);
  }

  @Post('predict/cash-flow')
  @Roles('ADMIN')
  cashFlow() {
    return this.predictions.cashFlowForecast();
  }

  @Post('predict/conversion')
  @Roles('ADMIN')
  conversion() {
    return this.predictions.leadConversionProbability();
  }

  @Post('predict/demand')
  @Roles('ADMIN')
  demand() {
    return this.predictions.demandForecast();
  }

  @Post('predict/anomalies')
  @Roles('ADMIN')
  anomalies() {
    return this.predictions.detectAnomalies();
  }

  @Post('predict/churn/:contactId')
  @Roles('STAFF')
  churn(@Param('contactId') contactId: string) {
    return this.predictions.churnRisk(contactId);
  }

  @Post('predict/clv/:contactId')
  @Roles('STAFF')
  clv(@Param('contactId') contactId: string) {
    return this.predictions.customerLifetimeValue(contactId);
  }

  @Get('briefing')
  @Roles('ADMIN')
  dailyBriefing() {
    return this.briefing.daily();
  }
}
