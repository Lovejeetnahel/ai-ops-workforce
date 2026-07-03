import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(RolesGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  private range(days?: string) {
    return AnalyticsService.defaultRange(days ? Math.max(1, Math.min(365, parseInt(days, 10) || 30)) : 30);
  }

  @Get('dashboard/:type')
  @Roles('STAFF')
  dashboard(@Param('type') type: string, @Query('days') days?: string) {
    return this.analytics.domainDashboard(type, this.range(days));
  }

  @Get('kpi/:key')
  @Roles('STAFF')
  kpi(@Param('key') key: string, @Query('days') days?: string) {
    return this.analytics.kpi(key, this.range(days));
  }

  @Get('timeseries/:metric')
  @Roles('STAFF')
  timeseries(@Param('metric') metric: 'revenue' | 'cost', @Query('days') days?: string) {
    return this.analytics.timeseries(metric, this.range(days));
  }

  @Get('dashboards')
  @Roles('STAFF')
  saved() {
    return this.analytics.listDashboards();
  }

  @Post('dashboards')
  @Roles('ADMIN')
  saveDashboard(@Body() body: { key: string; name: string; type?: string; layout?: unknown }) {
    return this.analytics.saveDashboard(body);
  }

  @Post('dashboards/:id/widgets')
  @Roles('ADMIN')
  addWidget(@Param('id') id: string, @Body() body: any) {
    return this.analytics.addWidget(id, body);
  }
}
