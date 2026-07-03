import { BadRequestException, Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { IsEnum } from 'class-validator';
import { JobStatus } from '@prisma/client';

const VALID_JOB_STATUSES = Object.values(JobStatus);
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { JobsService } from './jobs.service';

class UpdateStatusDto {
  @IsEnum(JobStatus) status: JobStatus;
}

/** Universal job / work-order API. Status transitions emit lifecycle events. */
@Controller('jobs')
@UseGuards(RolesGuard)
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  @Roles('STAFF')
  list(@Query('status') status?: string, @Query('assignedToId') assignedToId?: string) {
    if (status && !VALID_JOB_STATUSES.includes(status as JobStatus))
      throw new BadRequestException(`Invalid status: ${status}`);
    return this.jobs.list({ status: status as JobStatus, assignedToId });
  }

  @Get(':id')
  @Roles('STAFF')
  get(@Param('id') id: string) {
    return this.jobs.get(id);
  }

  @Patch(':id/status')
  @Roles('STAFF')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.jobs.updateStatus(id, dto.status);
  }
}
