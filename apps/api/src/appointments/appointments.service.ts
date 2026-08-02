import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ScheduleService } from '../operations/scheduling/schedule.service';
import { EventBus } from '../automation/event-bus';
import { DomainEvents } from '../automation/events';
import { tenantContext } from '../common/tenancy/tenant-context';
import { randomBytes } from 'node:crypto';

/**
 * Appointments V1 (Sprint 3) — activates the APPOINTMENT operating core on
 * the EXISTING Booking model + ScheduleService (the single availability/
 * booking engine; no second calendar). Adds: bookable services, public
 * booking links (real free slots only), reschedule/cancel/no-show, and the
 * associations (contact/lead/conversation/location) the rest of the product
 * already understands. Reminders ride the existing automation engine via
 * booking.* domain events.
 */
@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedule: ScheduleService,
    private readonly bus: EventBus,
  ) {}

  // ── Services ───────────────────────────────────────────────────────────
  listServices() {
    return this.prisma.db.serviceOffering.findMany({ orderBy: { createdAt: 'asc' } });
  }

  createService(input: { name: string; description?: string; durationMin?: number; priceCents?: number; locationId?: string }) {
    if (!input.name?.trim()) throw new BadRequestException('name is required');
    return this.prisma.db.serviceOffering.create({
      data: {
        name: input.name.trim(),
        description: input.description ?? null,
        durationMin: Math.max(5, Math.min(480, input.durationMin ?? 60)),
        priceCents: input.priceCents ?? null,
        locationId: input.locationId ?? null,
      } as any,
    });
  }

  async updateService(id: string, input: Partial<{ name: string; description: string; durationMin: number; priceCents: number | null; active: boolean; locationId: string | null }>) {
    const svc = await this.prisma.db.serviceOffering.findFirst({ where: { id }, select: { id: true, tenantId: true } });
    if (!svc) throw new NotFoundException('Service not found');
    const data: any = {};
    for (const k of ['name', 'description', 'priceCents', 'active', 'locationId'] as const) if (input[k] !== undefined) data[k] = input[k];
    if (input.durationMin !== undefined) data.durationMin = Math.max(5, Math.min(480, input.durationMin));
    return this.prisma.db.serviceOffering.update({ where: { id }, data });
  }

  // ── Booking links ──────────────────────────────────────────────────────
  listLinks() {
    return this.prisma.db.bookingLink.findMany({ include: { service: true }, orderBy: { createdAt: 'asc' } });
  }

  async createLink(input: { name: string; serviceId?: string; staffUserId?: string }) {
    if (!input.name?.trim()) throw new BadRequestException('name is required');
    const slug = `${input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40)}-${randomBytes(3).toString('hex')}`;
    return this.prisma.db.bookingLink.create({
      data: { name: input.name.trim(), slug, serviceId: input.serviceId ?? null, staffUserId: input.staffUserId ?? null } as any,
    });
  }

  async setLinkActive(id: string, active: boolean) {
    const link = await this.prisma.db.bookingLink.findFirst({ where: { id }, select: { id: true, tenantId: true } });
    if (!link) throw new NotFoundException('Booking link not found');
    return this.prisma.db.bookingLink.update({ where: { id }, data: { active } });
  }

  // ── Public booking (no auth; tenant resolved from the link slug) ───────
  /** Resolve a public link (base client — no tenant context on public routes). */
  async publicLink(slug: string) {
    const link = await this.prisma.bookingLink.findUnique({
      where: { slug },
      include: { service: true, tenant: { select: { id: true, name: true, timezone: true } } },
    });
    if (!link || !link.active) throw new NotFoundException('This booking link is not available');
    return link;
  }

  /** Real free slots from the existing availability engine — never invented. */
  async publicSlots(slug: string, fromIso?: string, days = 7) {
    const link = await this.publicLink(slug);
    const from = fromIso ? new Date(fromIso) : new Date();
    const to = new Date(from.getTime() + Math.min(days, 14) * 86_400_000);
    const duration = link.service?.durationMin ?? 60;
    return tenantContext.run({ tenantId: link.tenantId }, async () => {
      const staffIds = link.staffUserId
        ? [link.staffUserId]
        : (await this.prisma.db.user.findMany({ where: { role: { in: ['STAFF', 'ADMIN', 'OWNER'] }, status: 'ACTIVE' }, select: { id: true }, take: 5 })).map((u) => u.id);
      const results: { userId: string; slots: any[] }[] = [];
      for (const userId of staffIds) {
        const slots = await this.schedule.findSlots(userId, from, to, duration).catch(() => []);
        if (slots.length) results.push({ userId, slots: slots.slice(0, 40) });
      }
      return {
        business: link.tenant.name,
        service: link.service ? { name: link.service.name, durationMin: link.service.durationMin, priceCents: link.service.priceCents } : null,
        timezone: link.tenant.timezone,
        staff: results,
      };
    });
  }

  /** Public booking: books a provably-free slot via the race-proof engine. */
  async publicBook(slug: string, input: { userId: string; start: string; name: string; phone?: string; email?: string; notes?: string }) {
    const link = await this.publicLink(slug);
    if (!input.name?.trim()) throw new BadRequestException('Your name is required');
    if (!input.phone && !input.email) throw new BadRequestException('A phone number or email is required so the business can reach you');
    const start = new Date(input.start);
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now()) throw new BadRequestException('Pick a future time slot');
    const duration = link.service?.durationMin ?? 60;
    const end = new Date(start.getTime() + duration * 60_000);

    return tenantContext.run({ tenantId: link.tenantId }, async () => {
      const staff = await this.prisma.db.user.findFirst({ where: { id: input.userId }, select: { id: true, tenantId: true } });
      if (!staff) throw new BadRequestException('Unknown staff member for this business');
      const contact = await this.prisma.db.contact.create({
        data: { name: input.name.trim(), phone: input.phone ?? null, email: input.email ?? null } as any,
      });
      const booking = await this.schedule.book({
        userId: input.userId,
        start,
        end,
        contactId: contact.id,
        notes: [link.service?.name ? `Service: ${link.service.name}` : null, input.notes].filter(Boolean).join(' — ') || undefined,
      });
      await this.prisma.db.booking.update({
        where: { id: booking.id },
        data: { serviceId: link.serviceId ?? null, status: 'REQUESTED' },
      });
      await this.bus.emit({
        name: DomainEvents.BOOKING_REQUESTED,
        tenantId: link.tenantId,
        payload: { booking: { id: booking.id, start: start.toISOString() }, contact: { id: contact.id, name: contact.name }, source: 'booking_link' },
      });
      return { ok: true, bookingId: booking.id, start: start.toISOString(), durationMin: duration };
    });
  }

  // ── Staff operations over existing bookings ────────────────────────────
  list(filter: { from?: string; to?: string; status?: string }) {
    const where: any = {};
    if (filter.status) where.status = filter.status as BookingStatus;
    if (filter.from || filter.to)
      where.start = { ...(filter.from ? { gte: new Date(filter.from) } : {}), ...(filter.to ? { lte: new Date(filter.to) } : {}) };
    return this.prisma.db.booking.findMany({
      where,
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true } },
        assignedTo: { select: { id: true, name: true } },
        lead: { select: { id: true, stage: true } },
      },
      orderBy: { start: 'asc' },
      take: 300,
    });
  }

  async reschedule(id: string, startIso: string) {
    const booking = await this.getBooking(id);
    const start = new Date(startIso);
    if (Number.isNaN(start.getTime())) throw new BadRequestException('Invalid start time');
    const duration = booking.end.getTime() - booking.start.getTime();
    const end = new Date(start.getTime() + duration);
    if (!booking.assignedToId) {
      // No staff attached — just move it (nothing to double-book against).
      return this.prisma.db.booking.update({ where: { id }, data: { start, end, status: 'RESCHEDULED' } });
    }
    // Free-slot check through the same engine, then move atomically.
    const free = await this.schedule.isFree(booking.assignedToId, start, end).catch(() => false);
    if (!free) throw new BadRequestException('That time is not available for the assigned staff member');
    const updated = await this.prisma.db.booking.update({ where: { id }, data: { start, end, status: 'RESCHEDULED' } });
    await this.bus.emit({
      name: DomainEvents.BOOKING_CONFIRMED,
      tenantId: tenantContext.tenantId,
      payload: { booking: { id, start: start.toISOString() }, contact: booking.contactId ? { id: booking.contactId } : null, rescheduled: true },
    });
    return updated;
  }

  async setStatus(id: string, status: string) {
    const valid = ['REQUESTED', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED', 'NO_SHOW', 'COMPLETED'];
    if (!valid.includes(status)) throw new BadRequestException(`status must be one of: ${valid.join(', ')}`);
    const booking = await this.getBooking(id);
    const updated = await this.prisma.db.booking.update({ where: { id }, data: { status: status as BookingStatus } });
    const eventName =
      status === 'CONFIRMED' ? DomainEvents.BOOKING_CONFIRMED : status === 'NO_SHOW' ? DomainEvents.BOOKING_NO_SHOW : null;
    if (eventName)
      await this.bus.emit({
        name: eventName,
        tenantId: tenantContext.tenantId,
        payload: { booking: { id, start: booking.start.toISOString() }, contact: booking.contactId ? { id: booking.contactId } : null },
      });
    return updated;
  }

  async setNotes(id: string, notes: string) {
    await this.getBooking(id);
    return this.prisma.db.booking.update({ where: { id }, data: { notes: notes?.slice(0, 2000) ?? null } });
  }

  /** Real appointment stats for the dashboard widget. */
  async stats() {
    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 86_400_000);
    const monthAgo = new Date(now.getTime() - 30 * 86_400_000);
    const [upcoming, requested, noShows30d, completed30d] = await Promise.all([
      this.prisma.db.booking.count({ where: { start: { gte: now, lte: weekAhead }, status: { in: ['REQUESTED', 'CONFIRMED', 'RESCHEDULED'] } } }),
      this.prisma.db.booking.count({ where: { status: 'REQUESTED' } }),
      this.prisma.db.booking.count({ where: { status: 'NO_SHOW', start: { gte: monthAgo } } }),
      this.prisma.db.booking.count({ where: { status: 'COMPLETED', start: { gte: monthAgo } } }),
    ]);
    return { upcoming7d: upcoming, awaitingConfirmation: requested, noShows30d, completed30d };
  }

  private async getBooking(id: string) {
    const booking = await this.prisma.db.booking.findFirst({ where: { id } });
    if (!booking) throw new NotFoundException('Appointment not found');
    return booking;
  }
}
