import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { FieldAnalyticsService } from './field-analytics.service';

const parseDate = (s: string): Date => {
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new BadRequestException(`Invalid date: ${s}`);
  return d;
};

@Controller('field/analytics')
@UseGuards(RolesGuard)
export class FieldAnalyticsController {
  constructor(private readonly analytics: FieldAnalyticsService) {}
  private uid() {
    return tenantContext.get()!.userId!;
  }

  @Get('dashboard')
  @Roles('STAFF')
  dashboard() {
    return this.analytics.employeeDashboard(this.uid());
  }
  @Get('supervisor')
  @Roles('ADMIN')
  supervisor() {
    return this.analytics.supervisorDashboard();
  }
  @Get('kpis')
  @Roles('STAFF')
  kpis(@Query('from') from: string, @Query('to') to: string) {
    const fromDate = from ? parseDate(from) : new Date(new Date().setHours(0, 0, 0, 0));
    const toDate = to ? parseDate(to) : new Date(new Date().setHours(23, 59, 59, 999));
    return this.analytics.employeeKpis(this.uid(), fromDate, toDate);
  }
  @Get('attendance')
  @Roles('ADMIN')
  attendance(@Query('from') from: string, @Query('to') to: string) {
    const fromDate = from ? parseDate(from) : new Date(new Date().setHours(0, 0, 0, 0));
    const toDate = to ? parseDate(to) : new Date(new Date().setHours(23, 59, 59, 999));
    return this.analytics.attendance(fromDate, toDate);
  }
}
