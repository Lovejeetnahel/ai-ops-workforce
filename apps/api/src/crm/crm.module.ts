import { Module } from '@nestjs/common';
import { ActivitiesService } from './activities/activities.service';
import { ActivitiesController } from './activities/activities.controller';
import { CompaniesService } from './companies/companies.service';
import { CompaniesController } from './companies/companies.controller';
import { ActivityProjector } from './activity-projector.service';

/**
 * Universal CRM core (Phase 1): Companies/Accounts + the universal Activity
 * timeline (notes, tasks, and auto-projected touchpoints). Depends only on
 * global modules (Prisma, EventBus, Brain), so it adds no coupling and no cycles.
 */
@Module({
  controllers: [ActivitiesController, CompaniesController],
  providers: [ActivitiesService, CompaniesService, ActivityProjector],
  exports: [ActivitiesService, CompaniesService],
})
export class CrmModule {}
