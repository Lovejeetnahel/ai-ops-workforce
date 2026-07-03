import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, IsISO8601 } from 'class-validator';
import { ActivityStatus, ActivityType } from '@prisma/client';

const VALID_ACTIVITY_STATUSES = Object.values(ActivityStatus);
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { ActivitiesService } from './activities.service';

class CreateActivityDto {
  @IsEnum(ActivityType) type: ActivityType;
  @IsString() title: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsISO8601() dueAt?: string;
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsString() leadId?: string;
  @IsOptional() @IsString() jobId?: string;
}

class UpdateActivityDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsISO8601() dueAt?: string;
  @IsOptional() @IsEnum(ActivityStatus) status?: ActivityStatus;
}

/**
 * Universal timeline + tasks API. Works identically for every industry; the UI
 * (later phase) renders one component against this for contacts, companies,
 * leads, and jobs.
 */
@Controller('activities')
@UseGuards(RolesGuard)
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Post()
  @Roles('STAFF')
  create(@Body() dto: CreateActivityDto) {
    return this.activities.create({ ...dto, actor: 'STAFF', authorUserId: tenantContext.get()?.userId });
  }

  @Get()
  @Roles('STAFF')
  timeline(
    @Query('contactId') contactId?: string,
    @Query('companyId') companyId?: string,
    @Query('leadId') leadId?: string,
    @Query('jobId') jobId?: string,
  ) {
    return this.activities.timeline({ contactId, companyId, leadId, jobId });
  }

  @Get('tasks')
  @Roles('STAFF')
  tasks(@Query('status') status?: string, @Query('assigneeId') assigneeId?: string) {
    if (status && !VALID_ACTIVITY_STATUSES.includes(status as ActivityStatus))
      throw new BadRequestException(`Invalid status: ${status}`);
    return this.activities.tasks({ status: status as ActivityStatus, assigneeId });
  }

  @Patch(':id')
  @Roles('STAFF')
  update(@Param('id') id: string, @Body() dto: UpdateActivityDto) {
    return this.activities.update(id, dto);
  }

  @Post(':id/complete')
  @Roles('STAFF')
  complete(@Param('id') id: string) {
    return this.activities.completeTask(id);
  }
}
