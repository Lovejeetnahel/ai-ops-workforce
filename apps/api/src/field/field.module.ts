import { Module } from '@nestjs/common';
import { OperationsModule } from '../operations/operations.module';
import { TimeService } from './time/time.service';
import { TimeController } from './time/time.controller';
import { ExecutionService } from './execution/execution.service';
import { ExecutionController } from './execution/execution.controller';
import { AssetsService } from './assets/assets.service';
import { AssetsController } from './assets/assets.controller';
import { MovementService } from './movement/movement.service';
import { MovementController } from './movement/movement.controller';
import { FieldCopilotService } from './ai/field-copilot.service';
import { FieldCopilotController } from './ai/field-copilot.controller';
import { FieldAnalyticsService } from './analytics/field-analytics.service';
import { FieldAnalyticsController } from './analytics/field-analytics.controller';
import { FieldCommsService } from './comms/field-comms.service';
import { FieldCommsController } from './comms/field-comms.controller';
import { FieldSyncService } from './sync/field-sync.service';
import { FieldSyncController } from './sync/field-sync.controller';

/**
 * Employee Workforce Platform (Phase 5). Imports OperationsModule (JobsService
 * for lifecycle transitions); everything else (Prisma, EventBus, Brain, Control
 * ValueLedger, Integrations) is global. Reuses CRM/Operations/Revenue data and
 * owns no duplicated business logic.
 */
@Module({
  imports: [OperationsModule],
  controllers: [
    TimeController,
    ExecutionController,
    AssetsController,
    MovementController,
    FieldCopilotController,
    FieldAnalyticsController,
    FieldCommsController,
    FieldSyncController,
  ],
  providers: [
    TimeService,
    ExecutionService,
    AssetsService,
    MovementService,
    FieldCopilotService,
    FieldAnalyticsService,
    FieldCommsService,
    FieldSyncService,
  ],
  exports: [TimeService, ExecutionService],
})
export class FieldModule {}
