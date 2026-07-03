import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { ScheduleService } from './schedule.service';

class WindowDto {
  @IsInt() @Min(0) @Max(6) weekday: number;
  @IsInt() @Min(0) @Max(1440) startMinute: number;
  @IsInt() @Min(0) @Max(1440) endMinute: number;
}
class SetWorkingHoursDto {
  @IsArray() @Type(() => WindowDto) windows: WindowDto[];
}
class TimeOffDto {
  @IsISO8601() start: string;
  @IsISO8601() end: string;
  @IsOptional() @IsString() reason?: string;
}
class BookDto {
  @IsString() userId: string;
  @IsISO8601() start: string;
  @IsISO8601() end: string;
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsString() leadId?: string;
  @IsOptional() @IsString() jobId?: string;
  @IsOptional() @IsString() notes?: string;
}

const parseDate = (s: string): Date => {
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new BadRequestException(`Invalid date: ${s}`);
  return d;
};

/** Universal scheduling API: availability, slots, calendar, manual booking. */
@Controller('schedule')
@UseGuards(RolesGuard)
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Get('working-hours/:userId')
  @Roles('STAFF')
  getHours(@Param('userId') userId: string) {
    return this.schedule.getWorkingHours(userId);
  }

  @Put('working-hours/:userId')
  @Roles('ADMIN')
  setHours(@Param('userId') userId: string, @Body() dto: SetWorkingHoursDto) {
    return this.schedule.setWorkingHours(userId, dto.windows);
  }

  @Get('time-off/:userId')
  @Roles('STAFF')
  listTimeOff(@Param('userId') userId: string) {
    return this.schedule.listTimeOff(userId);
  }

  @Post('time-off/:userId')
  @Roles('STAFF')
  addTimeOff(@Param('userId') userId: string, @Body() dto: TimeOffDto) {
    return this.schedule.addTimeOff(userId, new Date(dto.start), new Date(dto.end), dto.reason);
  }

  @Delete('time-off/:id')
  @Roles('STAFF')
  removeTimeOff(@Param('id') id: string) {
    return this.schedule.removeTimeOff(id);
  }

  /** Conflict-free slots for a staff member. */
  @Get('availability/:userId')
  @Roles('STAFF')
  availability(
    @Param('userId') userId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('duration') duration = '120',
  ) {
    return this.schedule.findSlots(userId, parseDate(from), parseDate(to), Number(duration));
  }

  /** Calendar view (global, or per-staff via ?userId=). */
  @Get('calendar')
  @Roles('STAFF')
  calendar(@Query('from') from: string, @Query('to') to: string, @Query('userId') userId?: string) {
    return this.schedule.calendar(parseDate(from), parseDate(to), { userId });
  }

  @Post('book')
  @Roles('STAFF')
  book(@Body() dto: BookDto) {
    return this.schedule.book({
      userId: dto.userId,
      start: new Date(dto.start),
      end: new Date(dto.end),
      contactId: dto.contactId,
      leadId: dto.leadId,
      jobId: dto.jobId,
      notes: dto.notes,
    });
  }
}
