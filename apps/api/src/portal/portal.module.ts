import { Module } from '@nestjs/common';
import { OperationsModule } from '../operations/operations.module';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';
import { PortalAuthController } from './auth/portal-auth.controller';
import { PortalAuthService } from './auth/portal-auth.service';
import { BookingRequestService } from './booking-request.service';
import { NotificationsService } from './notifications.service';
import { NotificationProjector } from './notification-projector.service';

/**
 * Customer Portal (Phase 4) — the external, self-serve interface. Imports
 * OperationsModule so booking requests reuse the real DispatchService; all other
 * dependencies (Prisma, EventBus, Brain, Integrations, Auth/JWT) are global.
 * Reads from CRM/Operations/Revenue; owns no duplicated business logic.
 */
@Module({
  imports: [OperationsModule],
  controllers: [PortalController, PortalAuthController],
  providers: [PortalService, PortalAuthService, BookingRequestService, NotificationsService, NotificationProjector],
  exports: [NotificationsService],
})
export class PortalModule {}
