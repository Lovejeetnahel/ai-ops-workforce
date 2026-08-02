import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { EventBusModule } from '../automation/event-bus.module';
import { OperationsModule } from '../operations/operations.module';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController, PublicBookingController } from './appointments.controller';

/** Appointments V1 (Sprint 3) — the APPOINTMENT core on the existing engine. */
@Module({
  imports: [PrismaModule, EventBusModule, OperationsModule],
  providers: [AppointmentsService],
  controllers: [AppointmentsController, PublicBookingController],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
