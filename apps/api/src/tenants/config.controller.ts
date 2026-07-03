import { Controller, Get, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../common/rbac/roles.guard';
import { Roles } from '../common/rbac/roles.decorator';
import { ModuleConfigService } from '../common/module-config/module-config.service';
import { tenantContext } from '../common/tenancy/tenant-context';

/**
 * The endpoint the frontend calls to learn how to render itself. Returns the
 * resolved Industry Module Config (vocabulary, pipeline columns, intake fields,
 * templates) for the current tenant — this is what makes the SAME React code
 * show "Service Request" for HVAC and "Case" for an immigration firm.
 */
@Controller('config')
@UseGuards(RolesGuard)
export class ConfigController {
  constructor(private readonly moduleConfig: ModuleConfigService) {}

  @Get('module')
  @Roles('CUSTOMER')
  module() {
    return this.moduleConfig.forTenant(tenantContext.tenantId);
  }
}
