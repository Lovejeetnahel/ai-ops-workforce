import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { FieldCommsService } from './field-comms.service';

class SosDto {
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsString() note?: string;
}
class InternalMessageDto {
  @IsString() text: string;
  @IsOptional() @IsString() conversationId?: string;
}

@Controller('field/comms')
@UseGuards(RolesGuard)
@Roles('STAFF')
export class FieldCommsController {
  constructor(private readonly comms: FieldCommsService) {}
  private uid() {
    return tenantContext.get()!.userId!;
  }

  @Post('sos')
  sos(@Body() dto: SosDto) {
    return this.comms.sos(this.uid(), dto);
  }
  @Post('internal')
  postInternal(@Body() dto: InternalMessageDto) {
    return this.comms.postInternal(this.uid(), dto.text, dto.conversationId);
  }
  @Get('internal')
  listInternal() {
    return this.comms.listInternal();
  }
}
