import { Body, Controller, Get, Header, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { ReportService } from './report.service';

@Controller('reports')
@UseGuards(RolesGuard)
export class ReportingController {
  constructor(private readonly reports: ReportService) {}

  @Get('definitions')
  @Roles('ADMIN')
  definitions() {
    return this.reports.listDefinitions();
  }

  @Post('definitions')
  @Roles('ADMIN')
  create(@Body() body: any) {
    return this.reports.createDefinition(body);
  }

  @Get('generate/:type')
  @Roles('ADMIN')
  generate(@Param('type') type: string, @Query('days') days?: string) {
    return this.reports.generate(type, days ? Math.max(1, Math.min(365, parseInt(days, 10) || 30)) : 30);
  }

  @Get('generate/:type/csv')
  @Header('Content-Type', 'text/csv')
  @Roles('ADMIN')
  async csv(@Param('type') type: string, @Query('days') days?: string) {
    const report = await this.reports.generate(type, days ? Math.max(1, Math.min(365, parseInt(days, 10) || 30)) : 30);
    return this.reports.toCsv(report);
  }
}
