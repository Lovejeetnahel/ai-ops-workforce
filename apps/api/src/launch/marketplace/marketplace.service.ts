import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { EmployeeRegistry } from '../../employees/framework/employee-registry.service';

/**
 * Marketplace backend. Listings are a GLOBAL catalog (base Prisma client);
 * installs + reviews are tenant-scoped. Installing an AGENT listing reuses the
 * AI-workforce AgentInstallation pathway — no parallel install system.
 */
@Injectable()
export class MarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: EmployeeRegistry,
  ) {}

  catalog(filter: { type?: string; q?: string } = {}) {
    return this.prisma.marketplaceListing.findMany({
      where: {
        status: 'published',
        ...(filter.type ? { type: filter.type } : {}),
        ...(filter.q ? { name: { contains: filter.q, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ downloads: 'desc' }, { ratingAvg: 'desc' }],
      take: 100,
    });
  }

  get(id: string) {
    return this.prisma.marketplaceListing.findUniqueOrThrow({ where: { id } });
  }

  publish(input: { key: string; type: string; name: string; description?: string; version?: string; priceCents?: number; metadata?: unknown }) {
    return this.prisma.marketplaceListing.upsert({
      where: { key: input.key },
      update: { type: input.type, name: input.name, description: input.description ?? null, version: input.version ?? '1.0.0', priceCents: input.priceCents ?? 0, metadata: (input.metadata ?? {}) as any, authorTenantId: tenantContext.tenantId, status: 'published' },
      create: { key: input.key, type: input.type, name: input.name, description: input.description ?? null, version: input.version ?? '1.0.0', priceCents: input.priceCents ?? 0, metadata: (input.metadata ?? {}) as any, authorTenantId: tenantContext.tenantId, status: 'published' },
    });
  }

  async install(listingId: string) {
    const listing = await this.get(listingId);
    if (listing.type === 'agent') {
      await this.registry.install(listing.key, { enabled: true });
    }

    const tenantId = tenantContext.tenantId;
    // Found via concurrency load testing: every call to install() — including
    // redundant re-installs by a tenant that already has this listing —
    // unconditionally incremented `downloads`. 5 concurrent install calls
    // from ONE tenant inflated `downloads` by 5 for a single real install.
    // An advisory lock keyed on (tenantId, listingId) serializes the
    // existence check against the upsert so `downloads` increments exactly
    // once per tenant, on the genuinely first install, while still letting a
    // legitimate re-install bump `version` without double-counting.
    const { install, isNew } = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `${tenantId}:${listingId}`);
      const existing = await tx.marketplaceInstall.findUnique({ where: { tenantId_listingId: { tenantId, listingId } } });
      const install = await tx.marketplaceInstall.upsert({
        where: { tenantId_listingId: { tenantId, listingId } },
        update: { version: listing.version },
        create: { tenantId, listingId, listingKey: listing.key, version: listing.version } as any,
      });
      return { install, isNew: !existing };
    });
    if (isNew) {
      await this.prisma.marketplaceListing.update({ where: { id: listingId }, data: { downloads: { increment: 1 } } });
    }
    return { installed: true, listingKey: listing.key, type: listing.type, install };
  }

  installs() {
    return this.prisma.db.marketplaceInstall.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async review(listingId: string, rating: number, comment?: string) {
    await this.prisma.db.marketplaceReview.upsert({
      where: { tenantId_listingId: { tenantId: tenantContext.tenantId, listingId } },
      update: { rating, comment: comment ?? null },
      create: { listingId, rating, comment: comment ?? null } as any,
    });
    // Recompute aggregate across all tenants (base client, unscoped read).
    const all = await this.prisma.marketplaceReview.findMany({ where: { listingId }, select: { rating: true } });
    const avg = all.reduce((s, r) => s + r.rating, 0) / (all.length || 1);
    return this.prisma.marketplaceListing.update({ where: { id: listingId }, data: { ratingAvg: Math.round(avg * 10) / 10, ratingCount: all.length } });
  }
}
