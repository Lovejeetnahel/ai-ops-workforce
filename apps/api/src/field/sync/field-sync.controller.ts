import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsArray } from 'class-validator';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { FieldSyncService, SyncAction } from './field-sync.service';

class SyncDto {
  @IsArray() actions: SyncAction[];
}

@Controller('field/sync')
@UseGuards(RolesGuard)
@Roles('STAFF')
export class FieldSyncController {
  constructor(private readonly sync: FieldSyncService) {}

  @Post()
  run(@Body() dto: SyncDto) {
    return this.sync.sync(tenantContext.get()!.userId!, dto.actions);
  }
}
