import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { AnalyticsService, Range } from '../analytics/analytics.service';

/**
 * Multi-company management (franchises/branches/groups). Organization is a
 * GLOBAL model (no tenantId) so it uses the base Prisma client. Cross-company
 * rollups reuse the Analytics engine, executed inside each child tenant's
 * context — so tenant isolation holds even while aggregating across companies.
 */
@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  /** Create an organization and attach the current tenant as a member. */
  async create(name: string, type = 'company') {
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Math.random().toString(36).slice(2, 7)}`;
    const org = await this.prisma.organization.create({ data: { name, slug, type } });
    await this.prisma.tenant.update({ where: { id: tenantContext.tenantId }, data: { organizationId: org.id } });
    return org;
  }

  /** Attach the current tenant to an existing organization (by slug). */
  async join(slug: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { slug } });
    await this.prisma.tenant.update({ where: { id: tenantContext.tenantId }, data: { organizationId: org.id } });
    return org;
  }

  /** Cross-company KPI rollup for the caller's organization. */
  async rollup(days = 30) {
    const range = AnalyticsService.defaultRange(days);
    const me = await this.prisma.tenant.findUnique({ where: { id: tenantContext.tenantId }, select: { organizationId: true } });

    const tenants = me?.organizationId
      ? await this.prisma.tenant.findMany({ where: { organizationId: me.organizationId }, select: { id: true, name: true } })
      : [await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantContext.tenantId }, select: { id: true, name: true } })];

    const companies = await Promise.all(tenants.map((t) => this.companyKpis(t.id, t.name, range)));
    const totals = companies.reduce(
      (acc, c) => ({ revenue: acc.revenue + c.revenue, jobsCompleted: acc.jobsCompleted + c.jobsCompleted, leadsNew: acc.leadsNew + c.leadsNew }),
      { revenue: 0, jobsCompleted: 0, leadsNew: 0 },
    );
    return { organizationId: me?.organizationId ?? null, companies, totals };
  }

  private companyKpis(tenantId: string, name: string, range: Range) {
    return tenantContext.run({ tenantId }, async () => ({
      tenantId,
      name,
      revenue: await this.analytics.metric('revenue', range),
      jobsCompleted: await this.analytics.metric('jobs_completed', range),
      leadsNew: await this.analytics.metric('leads_new', range),
    }));
  }
}
