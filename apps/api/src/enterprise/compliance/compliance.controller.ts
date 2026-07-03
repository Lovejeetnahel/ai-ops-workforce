import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { Roles } from '../../common/rbac/roles.decorator';
import { ComplianceService } from './compliance.service';

@Controller('compliance')
@UseGuards(RolesGuard)
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Post('consent/:contactId')
  @Roles('STAFF')
  consent(@Param('contactId') contactId: string, @Body() body: { type: string; granted: boolean; source?: string }) {
    return this.compliance.recordConsent(contactId, body.type, body.granted, body.source);
  }

  @Get('consent/:contactId')
  @Roles('STAFF')
  consentStatus(@Param('contactId') contactId: string) {
    return this.compliance.consentStatus(contactId);
  }

  @Get('audit')
  @Roles('ADMIN')
  audit(@Query('entity') entity?: string, @Query('actorId') actorId?: string) {
    return this.compliance.auditLog({ entity, actorId });
  }

  @Get('export/:contactId')
  @Roles('ADMIN')
  exportSubject(@Param('contactId') contactId: string) {
    return this.compliance.exportSubject(contactId);
  }

  @Post('erase/:contactId')
  @Roles('OWNER')
  erase(@Param('contactId') contactId: string) {
    return this.compliance.eraseSubject(contactId);
  }

  @Get('report')
  @Roles('ADMIN')
  report() {
    return this.compliance.report();
  }
}
