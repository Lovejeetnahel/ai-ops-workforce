import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { EventBusModule } from '../automation/event-bus.module';
import { WorkspaceService } from './workspace.service';
import { StaffNotificationsService } from './staff-notifications.service';
import { StaffNotificationsController, LocationsController, SearchController } from './workspace.controller';

/** Sprint 3: staff notifications, multi-location, global search. */
@Module({
  imports: [PrismaModule, EventBusModule],
  providers: [WorkspaceService, StaffNotificationsService],
  controllers: [StaffNotificationsController, LocationsController, SearchController],
  exports: [WorkspaceService, StaffNotificationsService],
})
export class WorkspaceModule {}
