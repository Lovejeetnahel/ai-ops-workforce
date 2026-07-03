import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { PaymentStatus } from '@prisma/client';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { PaymentsService } from './payments.service';

const VALID_PAYMENT_STATUSES = Object.values(PaymentStatus);

class RecordPaymentDto {
  @IsOptional() @IsNumber() @Min(0.01) @Max(9_999_999_999) amount?: number;
  @IsOptional() @IsString() method?: string;
}

@Controller('payments')
@UseGuards(RolesGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @Roles('STAFF')
  list(@Query('status') status?: string) {
    if (status && !VALID_PAYMENT_STATUSES.includes(status as PaymentStatus))
      throw new BadRequestException(`Invalid status: ${status}`);
    return this.payments.list({ status });
  }

  /** Record an offline (cash/check) payment and settle the invoice. */
  @Post('record/:documentId')
  @Roles('STAFF')
  record(@Param('documentId') documentId: string, @Body() dto: RecordPaymentDto) {
    return this.payments.recordOffline(documentId, dto);
  }
}
