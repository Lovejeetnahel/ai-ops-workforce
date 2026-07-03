import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface CompanyInput {
  name: string;
  domain?: string;
  phone?: string;
  email?: string;
  website?: string;
  tags?: string[];
  attributes?: Record<string, unknown>;
}

/**
 * Universal Company/Account — the B2B layer shared by all industries (property
 * companies & landlords, client organizations, commercial accounts). Contacts
 * and Leads optionally belong to one. Tenant-scoped automatically.
 */
@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CompanyInput) {
    return this.prisma.db.company.create({
      data: {
        name: input.name,
        domain: input.domain ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        website: input.website ?? null,
        tags: input.tags ?? [],
        attributes: (input.attributes ?? {}) as any,
      } as any,
    });
  }

  list(q?: string) {
    return this.prisma.db.company.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  /** Account detail with its people, pipeline, and recent activity. */
  get(id: string) {
    return this.prisma.db.company.findUniqueOrThrow({
      where: { id },
      include: {
        contacts: { select: { id: true, name: true, email: true, phone: true } },
        leads: { select: { id: true, stage: true, serviceType: true, estimatedValue: true } },
        activities: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
  }

  update(id: string, input: Partial<CompanyInput>) {
    return this.prisma.db.company.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.domain !== undefined ? { domain: input.domain } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.website !== undefined ? { website: input.website } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.attributes !== undefined ? { attributes: input.attributes as any } : {}),
      },
    });
  }
}
