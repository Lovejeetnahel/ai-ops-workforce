import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RevenueModule } from '../revenue/revenue.module';
import { CommerceService } from './commerce.service';
import { CommerceController } from './commerce.controller';

/** COMMERCE core V1 (Sprint 4) — activates the reserved core on Sales + Payments. */
@Module({
  imports: [PrismaModule, RevenueModule],
  providers: [CommerceService],
  controllers: [CommerceController],
  exports: [CommerceService],
})
export class CommerceModule {}
