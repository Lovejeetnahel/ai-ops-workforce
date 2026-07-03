import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { TimeService } from './time.service';

class JobRef {
  @IsString() jobId: string;
}
class TravelStop {
  @IsOptional() @IsNumber() miles?: number;
}

const parseDate = (s: string): Date => {
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new BadRequestException(`Invalid date: ${s}`);
  return d;
};

/** Field time-clock API. `userId` is always the authenticated staff member. */
@Controller('field/time')
@UseGuards(RolesGuard)
@Roles('STAFF')
export class TimeController {
  constructor(private readonly time: TimeService) {}

  private uid() {
    return tenantContext.get()!.userId!;
  }

  @Post('clock-in')
  clockIn() {
    return this.time.clockIn(this.uid());
  }
  @Post('clock-out')
  clockOut() {
    return this.time.clockOut(this.uid());
  }
  @Post('break/start')
  startBreak() {
    return this.time.startBreak(this.uid());
  }
  @Post('break/end')
  endBreak() {
    return this.time.endBreak(this.uid());
  }
  @Post('job/start')
  startJob(@Body() b: JobRef) {
    return this.time.startJob(this.uid(), b.jobId);
  }
  @Post('job/stop')
  stopJob(@Body() b: JobRef) {
    return this.time.stopJob(this.uid(), b.jobId);
  }
  @Post('travel/start')
  startTravel(@Body() b: Partial<JobRef>) {
    return this.time.startTravel(this.uid(), b.jobId);
  }
  @Post('travel/stop')
  stopTravel(@Body() b: TravelStop) {
    return this.time.stopTravel(this.uid(), b.miles);
  }
  @Get('open')
  open() {
    return this.time.openEntries(this.uid());
  }
  @Get('timesheet')
  timesheet(@Query('from') from: string, @Query('to') to: string) {
    const fromDate = from ? parseDate(from) : new Date(new Date().setHours(0, 0, 0, 0));
    const toDate = to ? parseDate(to) : new Date(new Date().setHours(23, 59, 59, 999));
    return this.time.timesheet(this.uid(), fromDate, toDate);
  }
}
