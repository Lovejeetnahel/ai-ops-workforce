import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Sprint 3 workspace services: multi-location operations and global search.
 * Locations are optional scalar refs everywhere — single-location tenants
 * never see them and lose nothing. Tenant isolation is untouched: locations
 * are a filter WITHIN a tenant, never a boundary substitute.
 */
@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Locations ──────────────────────────────────────────────────────────
  listLocations() {
    return this.prisma.db.location.findMany({ orderBy: { createdAt: 'asc' } });
  }

  createLocation(input: { name: string; address?: string; phone?: string; timezone?: string; businessHours?: any }) {
    if (!input.name?.trim()) throw new BadRequestException('name is required');
    return this.prisma.db.location.create({
      data: { name: input.name.trim(), address: input.address ?? null, phone: input.phone ?? null, timezone: input.timezone ?? null, businessHours: input.businessHours ?? {} } as any,
    });
  }

  async updateLocation(id: string, input: Partial<{ name: string; address: string; phone: string; timezone: string; businessHours: any; active: boolean }>) {
    const loc = await this.prisma.db.location.findFirst({ where: { id }, select: { id: true, tenantId: true } });
    if (!loc) throw new NotFoundException('Location not found');
    const data: any = {};
    for (const k of ['name', 'address', 'phone', 'timezone', 'businessHours', 'active'] as const) if (input[k] !== undefined) data[k] = input[k];
    return this.prisma.db.location.update({ where: { id }, data });
  }

  async assignUserLocation(userId: string, locationId: string | null) {
    const user = await this.prisma.db.user.findFirst({ where: { id: userId }, select: { id: true, tenantId: true } });
    if (!user) throw new NotFoundException('User not found');
    if (locationId) {
      const loc = await this.prisma.db.location.findFirst({ where: { id: locationId }, select: { id: true, tenantId: true } });
      if (!loc) throw new BadRequestException('Unknown location');
    }
    return this.prisma.db.user.update({ where: { id: userId }, data: { locationId }, select: { id: true, name: true, locationId: true } });
  }

  /** Cross-location executive rollup — real counts grouped by locationId. */
  async byLocation(days = 30) {
    const from = new Date(Date.now() - days * 86_400_000);
    const [locations, leads, bookings, jobs, staff, wonLeads] = await Promise.all([
      this.prisma.db.location.findMany({ where: { active: true } }),
      this.prisma.db.lead.groupBy({ by: ['locationId'], where: { createdAt: { gte: from } }, _count: true }),
      this.prisma.db.booking.groupBy({ by: ['locationId'], where: { createdAt: { gte: from } }, _count: true }),
      this.prisma.db.job.groupBy({ by: ['status'], _count: true }),
      this.prisma.db.user.groupBy({ by: ['locationId'], where: { role: { in: ['STAFF', 'ADMIN', 'OWNER'] } }, _count: true }),
      this.prisma.db.lead.findMany({ where: { wonAt: { gte: from } }, select: { locationId: true, actualValue: true } }),
    ]);
    const wonBy = new Map<string | null, number>();
    for (const l of wonLeads) wonBy.set(l.locationId, (wonBy.get(l.locationId) ?? 0) + Number(l.actualValue ?? 0));
    const rowFor = (locId: string | null, name: string) => ({
      locationId: locId,
      name,
      leads: leads.find((x) => x.locationId === locId)?._count ?? 0,
      bookings: bookings.find((x) => x.locationId === locId)?._count ?? 0,
      staff: staff.find((x) => x.locationId === locId)?._count ?? 0,
      wonValue: wonBy.get(locId) ?? 0,
    });
    return {
      windowDays: days,
      locations: [...locations.map((l) => rowFor(l.id, l.name)), rowFor(null, locations.length ? 'Unassigned / tenant-wide' : 'All (single location)')],
      jobsByStatus: jobs.map((j) => ({ status: j.status, count: j._count })),
    };
  }

  // ── Global search ──────────────────────────────────────────────────────
  async search(q: string) {
    const query = q?.trim();
    if (!query || query.length < 2) return { query: q, results: [] };
    const ci = { contains: query, mode: 'insensitive' as const };
    const [contacts, leads, conversations, campaigns, documents, pages, bookings] = await Promise.all([
      this.prisma.db.contact.findMany({ where: { OR: [{ name: ci }, { email: ci }, { phone: { contains: query } }] }, select: { id: true, name: true, phone: true, email: true }, take: 5 }),
      this.prisma.db.lead.findMany({ where: { OR: [{ serviceType: ci }, { contact: { is: { name: ci } } }] }, select: { id: true, stage: true, serviceType: true, contact: { select: { name: true } } }, take: 5 }),
      this.prisma.db.conversation.findMany({ where: { OR: [{ subject: ci }, { contact: { is: { name: ci } } }] }, select: { id: true, channel: true, status: true, subject: true, contact: { select: { name: true } } }, take: 5 }),
      this.prisma.db.campaign.findMany({ where: { name: ci }, select: { id: true, name: true, status: true }, take: 5 }),
      this.prisma.db.document.findMany({ where: { title: ci }, select: { id: true, title: true, type: true, status: true }, take: 5 }),
      this.prisma.db.sitePage.findMany({ where: { title: ci }, select: { id: true, title: true, status: true }, take: 5 }),
      this.prisma.db.booking.findMany({ where: { contact: { is: { name: ci } } }, select: { id: true, start: true, status: true, contact: { select: { name: true } } }, take: 5 }),
    ]);
    const results = [
      ...contacts.map((c) => ({ kind: 'contact', id: c.id, label: c.name, detail: c.phone ?? c.email ?? '', href: '/crm' })),
      ...leads.map((l) => ({ kind: 'opportunity', id: l.id, label: l.contact?.name ?? 'Opportunity', detail: `${l.stage}${l.serviceType ? ` · ${l.serviceType}` : ''}`, href: '/sales' })),
      ...conversations.map((c) => ({ kind: 'conversation', id: c.id, label: c.contact?.name ?? c.subject ?? 'Conversation', detail: `${c.channel} · ${c.status}`, href: '/conversations' })),
      ...campaigns.map((c) => ({ kind: 'campaign', id: c.id, label: c.name, detail: c.status, href: '/marketing' })),
      ...documents.map((d) => ({ kind: 'document', id: d.id, label: d.title, detail: `${d.type} · ${d.status}`, href: '/payments' })),
      ...pages.map((p) => ({ kind: 'page', id: p.id, label: p.title, detail: p.status, href: '/websites' })),
      ...bookings.map((b) => ({ kind: 'appointment', id: b.id, label: b.contact?.name ?? 'Appointment', detail: new Date(b.start).toLocaleString(), href: '/apps/appointments' })),
    ];
    return { query, results: results.slice(0, 25) };
  }
}
