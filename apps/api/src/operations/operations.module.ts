import { Module } from '@nestjs/common';
import { ScheduleService } from './scheduling/schedule.service';
import { ScheduleController } from './scheduling/schedule.controller';
import { JobsService } from './jobs/jobs.service';
import { JobsController } from './jobs/jobs.controller';
import { DispatchService } from './dispatch/dispatch.service';
import { DispatchController } from './dispatch/dispatch.controller';
import { TeamsService } from './teams/teams.service';
import { TeamsController } from './teams/teams.controller';

/**
 * Universal Operations Engine (Phase 2): scheduling/availability, conflict-free
 * booking, the consolidated dispatch engine, job lifecycle, and teams. Depends
 * only on global modules (Prisma, EventBus, Integrations, Brain) so it adds no
 * coupling. Exports the services the Dispatch agent reuses.
 */
@Module({
  controllers: [ScheduleController, JobsController, DispatchController, TeamsController],
  providers: [ScheduleService, JobsService, DispatchService, TeamsService],
  exports: [ScheduleService, JobsService, DispatchService, TeamsService],
})
export class OperationsModule {}
