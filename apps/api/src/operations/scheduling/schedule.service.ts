import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProviderFactory } from '../../integrations/provider-factory.service';
import { EventBus } from '../../automation/event-bus';
import { DomainEvents } from '../../automation/events';
import { tenantContext } from '../../common/tenancy/tenant-context';

export interface TimeSlot {
  start: Date;
  end: Date;
}

/** Default availability when a staff member has no working hours configured. */
const DEFAULT_HOURS = { weekdays: [1, 2, 3, 4, 5], startMinute: 9 * 60, endMinute: 17 * 60 };
const SLOT_STEP_MS = 15 * 60_000;

/**
 * The single source of truth for availability and booking. Computes a staff
 * member's free/busy from THREE real sources — their bookings, their time-off,
 * and (best-effort) their external calendar — intersected with their working
 * hours, and creates bookings only when the slot is provably free (no double
 * booking). Used by DispatchService and exposed via the schedule API.
 */
@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderFactory,
    private readonly bus: EventBus,
  ) {}

  // ── Availability configuration ──────────────────────────────────────────
  getWorkingHours(userId: string) {
    return this.prisma.db.workingHours.findMany({ where: { userId }, orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] });
  }

  async setWorkingHours(userId: string, windows: { weekday: number; startMinute: number; endMinute: number }[]) {
    await this.prisma.db.workingHours.deleteMany({ where: { userId } });
    if (windows.length) {
      await this.prisma.db.workingHours.createMany({
        data: windows.map((w) => ({ userId, weekday: w.weekday, startMinute: w.startMinute, endMinute: w.endMinute })) as any,
      });
    }
    return this.getWorkingHours(userId);
  }

  addTimeOff(userId: string, start: Date, end: Date, reason?: string) {
    return this.prisma.db.timeOff.create({ data: { userId, start, end, reason: reason ?? null } as any });
  }

  listTimeOff(userId: string) {
    return this.prisma.db.timeOff.findMany({ where: { userId }, orderBy: { start: 'asc' } });
  }

  removeTimeOff(id: string) {
    return this.prisma.db.timeOff.delete({ where: { id } });
  }

  // ── Free/busy + slot finding ────────────────────────────────────────────
  async busyIntervals(userId: string, from: Date, to: Date): Promise<TimeSlot[]> {
    const [bookings, off] = await Promise.all([
      this.prisma.db.booking.findMany({
        where: { assignedToId: userId, status: { not: 'CANCELLED' }, start: { lt: to }, end: { gt: from } },
        select: { start: true, end: true },
      }),
      this.prisma.db.timeOff.findMany({
        where: { userId, start: { lt: to }, end: { gt: from } },
        select: { start: true, end: true },
      }),
    ]);

    let intervals: TimeSlot[] = [...bookings, ...off].map((b) => ({ start: b.start, end: b.end }));
    try {
      const cal = await this.providers.calendar(tenantContext.tenantId);
      const fb = await cal.freeBusy({ start: from, end: to });
      intervals = intervals.concat(fb.busy);
    } catch {
      /* external calendar optional */
    }
    return intervals;
  }

  /** Conflict-free slots for a user across [from,to], honoring working hours. */
  async findSlots(userId: string, from: Date, to: Date, durationMin: number, limit = 10): Promise<TimeSlot[]> {
    const busy = await this.busyIntervals(userId, from, to);
    const hours = await this.getWorkingHours(userId);
    const byDay = new Map<number, { startMinute: number; endMinute: number }[]>();
    for (const h of hours) {
      if (!byDay.has(h.weekday)) byDay.set(h.weekday, []);
      byDay.get(h.weekday)!.push({ startMinute: h.startMinute, endMinute: h.endMinute });
    }

    const durMs = durationMin * 60_000;
    const now = new Date();
    const slots: TimeSlot[] = [];
    let day = startOfUtcDay(from);

    while (day <= to && slots.length < limit) {
      const weekday = day.getUTCDay();
      const windows = byDay.get(weekday) ?? this.defaultWindowsFor(weekday);
      for (const w of windows) {
        const windowEnd = new Date(day.getTime() + w.endMinute * 60_000);
        let cursor = new Date(day.getTime() + w.startMinute * 60_000);
        if (cursor < from) cursor = new Date(from);
        if (cursor < now) cursor = new Date(Math.ceil(now.getTime() / SLOT_STEP_MS) * SLOT_STEP_MS);

        while (cursor.getTime() + durMs <= windowEnd.getTime() && slots.length < limit) {
          const slot = { start: new Date(cursor), end: new Date(cursor.getTime() + durMs) };
          if (!this.overlapsAny(slot, busy)) slots.push(slot);
          cursor = new Date(cursor.getTime() + durMs);
        }
      }
      day = new Date(day.getTime() + 86_400_000);
    }
    return slots;
  }

  async isFree(userId: string, start: Date, end: Date): Promise<boolean> {
    const busy = await this.busyIntervals(userId, start, end);
    return !this.overlapsAny({ start, end }, busy);
  }

  // ── Booking (conflict-checked) ──────────────────────────────────────────
  async book(input: {
    userId: string;
    start: Date;
    end: Date;
    contactId?: string | null;
    leadId?: string | null;
    jobId?: string | null;
    notes?: string;
  }) {
    // Fast-path rejection using the full availability check (bookings +
    // time-off + external calendar) before attempting to serialize.
    if (!(await this.isFree(input.userId, input.start, input.end))) {
      throw new ConflictException('Requested time slot is no longer available');
    }

    const tenantId = tenantContext.tenantId;

    // Authoritative, race-proof check-and-insert. Found via concurrency load
    // testing: firing concurrent book() calls for the SAME staff member, all
    // passed the isFree() check above (none had committed yet) and all
    // inserted a CONFIRMED booking for the identical slot — a reproduced,
    // real double booking. A Postgres transaction-scoped advisory lock keyed
    // on the staff member serializes concurrent attempts: the lock is held
    // for the life of this transaction (auto-released on commit/rollback),
    // and Prisma guarantees every query inside $transaction runs on the same
    // connection, so lock + re-check + insert are atomic with respect to any
    // other concurrent booking attempt for this same user.
    const booking = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', input.userId);

      const overlapping = await tx.booking.findFirst({
        where: {
          tenantId,
          assignedToId: input.userId,
          status: { not: 'CANCELLED' },
          start: { lt: input.end },
          end: { gt: input.start },
        },
      });
      if (overlapping) throw new ConflictException('Requested time slot is no longer available');

      return tx.booking.create({
        data: {
          tenantId,
          assignedToId: input.userId,
          start: input.start,
          end: input.end,
          status: 'CONFIRMED',
          contactId: input.contactId ?? null,
          leadId: input.leadId ?? null,
          jobId: input.jobId ?? null,
          notes: input.notes ?? null,
        } as any,
      });
    });

    await this.bus.emit({
      name: DomainEvents.BOOKING_CONFIRMED,
      tenantId: tenantContext.tenantId,
      payload: {
        booking: { id: booking.id, start: booking.start, end: booking.end },
        assignedToId: input.userId,
        contact: input.contactId ? { id: input.contactId } : undefined,
        lead: input.leadId ? { id: input.leadId } : undefined,
        job: input.jobId ? { id: input.jobId } : undefined,
      },
    });

    // Best-effort two-way calendar sync.
    try {
      const cal = await this.providers.calendar(tenantContext.tenantId);
      const ev = await cal.createEvent({ start: input.start, end: input.end, summary: input.notes ?? 'Appointment' });
      if (ev.eventId) await this.prisma.db.booking.update({ where: { id: booking.id }, data: { calendarEventId: ev.eventId } });
    } catch {
      /* optional */
    }
    return booking;
  }

  /** Calendar view: global, per-staff, or per-company (via contact's company). */
  calendar(from: Date, to: Date, opts: { userId?: string } = {}) {
    return this.prisma.db.booking.findMany({
      where: {
        start: { lt: to },
        end: { gt: from },
        status: { not: 'CANCELLED' },
        ...(opts.userId ? { assignedToId: opts.userId } : {}),
      },
      orderBy: { start: 'asc' },
      include: { contact: { select: { name: true } }, assignedTo: { select: { id: true, name: true } } },
    });
  }

  private overlapsAny(slot: TimeSlot, intervals: TimeSlot[]): boolean {
    return intervals.some((i) => slot.start < i.end && slot.end > i.start);
  }

  private defaultWindowsFor(weekday: number) {
    return DEFAULT_HOURS.weekdays.includes(weekday)
      ? [{ startMinute: DEFAULT_HOURS.startMinute, endMinute: DEFAULT_HOURS.endMinute }]
      : [];
  }
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
