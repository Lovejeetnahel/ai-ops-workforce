import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { LeadStage, JobStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { ApiScopeGuard, RequireScopes } from './api-scope.guard';

const VALID_LEAD_STAGES = Object.values(LeadStage);
const VALID_JOB_STATUSES = Object.values(JobStatus);

/**
 * The versioned public REST API (`/api/v1`), authenticated by API key + scopes
 * and rate-limited. It reads the same tenant-scoped data as the internal app —
 * a thin, governed surface for developers/integrations (SDK target).
 */
@Controller('v1')
@UseGuards(ApiScopeGuard)
export class PublicApiController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  @RequireScopes('read:account')
  me() {
    return this.prisma.tenant.findUnique({
      where: { id: tenantContext.tenantId },
      select: { id: true, name: true, slug: true, industryModule: true },
    });
  }

  @Get('leads')
  @RequireScopes('read:leads')
  leads(@Query('stage') stage?: string) {
    if (stage && !VALID_LEAD_STAGES.includes(stage as LeadStage))
      throw new BadRequestException(`Invalid stage: ${stage}`);
    return this.prisma.db.lead.findMany({ where: { ...(stage ? { stage: stage as LeadStage } : {}) }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  @Get('jobs')
  @RequireScopes('read:jobs')
  jobs(@Query('status') status?: string) {
    if (status && !VALID_JOB_STATUSES.includes(status as JobStatus))
      throw new BadRequestException(`Invalid status: ${status}`);
    return this.prisma.db.job.findMany({ where: { ...(status ? { status: status as JobStatus } : {}) }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  @Get('invoices')
  @RequireScopes('read:invoices')
  invoices() {
    return this.prisma.db.document.findMany({ where: { type: 'INVOICE' }, orderBy: { createdAt: 'desc' }, take: 100 });
  }
}
