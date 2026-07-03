import { BadRequestException, Injectable } from '@nestjs/common';
import { TimeEntryType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBus } from '../../automation/event-bus';
import { DomainEvents } from '../../automation/events';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { ValueLedgerService } from '../../control/value-ledger.service';
import { JobsService } from '../../operations/jobs/jobs.service';

/**
 * Unified time tracking: clock in/out, breaks, job timer, travel timer + mileage.
 * One TimeEntry model backs all of them. Closing a shift books labor cost to the
 * Value Ledger (Control Layer), and starting a job timer advances the job to
 * IN_PROGRESS through the existing Operations JobsService (no duplicate logic).
 */
@Injectable()
export class TimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
    private readonly ledger: ValueLedgerService,
    private readonly jobs: JobsService,
  ) {}

  clockIn(userId: string) {
    return this.open(userId, 'SHIFT', null, DomainEvents.SHIFT_CLOCK_IN);
  }

  async clockOut(userId: string) {
    // Close any open break/job/travel first, then the shift.
    for (const t of ['BREAK', 'JOB', 'TRAVEL'] as TimeEntryType[]) {
      const open = await this.openEntry(userId, t);
      if (open) await this.close(open.id);
    }
    const shift = await this.openEntry(userId, 'SHIFT');
    if (!shift) throw new BadRequestException('Not clocked in');
    const closed = await this.close(shift.id);

    // Labor cost → Value Ledger (only when an hourly rate is configured).
    const user = await this.prisma.db.user.findUnique({ where: { id: userId }, select: { hourlyRate: true } });
    const rate = user?.hourlyRate ? Number(user.hourlyRate) : 0;
    if (rate > 0 && closed.durationMinutes) {
      await this.ledger.record({
        valueType: 'COST',
        direction: 'DEBIT',
        amount: Math.round((closed.durationMinutes / 60) * rate * 100) / 100,
        actionType: 'labor',
        agent: userId,
        source: 'shift',
      });
    }
    await this.emit(DomainEvents.SHIFT_CLOCK_OUT, userId, { minutes: closed.durationMinutes });
    return closed;
  }

  startBreak(userId: string) {
    return this.open(userId, 'BREAK', null, DomainEvents.TIME_BREAK_STARTED);
  }
  async endBreak(userId: string) {
    return this.closeOpen(userId, 'BREAK', DomainEvents.TIME_BREAK_ENDED);
  }

  async startJob(userId: string, jobId: string) {
    const entry = await this.open(userId, 'JOB', jobId, DomainEvents.JOB_STARTED);
    await this.jobs.updateStatus(jobId, 'IN_PROGRESS'); // reuse Operations lifecycle
    return entry;
  }
  stopJob(userId: string, jobId: string) {
    return this.closeOpen(userId, 'JOB', undefined, jobId);
  }

  startTravel(userId: string, jobId?: string) {
    return this.open(userId, 'TRAVEL', jobId ?? null, DomainEvents.JOB_TRAVELING);
  }
  async stopTravel(userId: string, miles?: number) {
    const open = await this.openEntry(userId, 'TRAVEL');
    if (!open) throw new BadRequestException('No active travel');
    return this.close(open.id, miles);
  }

  openEntries(userId: string) {
    return this.prisma.db.timeEntry.findMany({ where: { userId, endedAt: null }, orderBy: { startedAt: 'desc' } });
  }

  async timesheet(userId: string, from: Date, to: Date) {
    const entries = await this.prisma.db.timeEntry.findMany({
      where: { userId, startedAt: { gte: from, lte: to } },
      orderBy: { startedAt: 'asc' },
    });
    const totals: Record<string, number> = {};
    let miles = 0;
    for (const e of entries) {
      totals[e.type] = (totals[e.type] ?? 0) + (e.durationMinutes ?? 0);
      miles += e.miles ? Number(e.miles) : 0;
    }
    return { entries, totalsMinutes: totals, miles };
  }

  // ── internals ──────────────────────────────────────────────────────────
  /**
   * Idempotent open: found via concurrency load testing, 10 concurrent
   * clock-in calls for the SAME staff member each independently saw no open
   * shift and each created their own — 8 simultaneous open SHIFT entries for
   * one person. A Postgres transaction-scoped advisory lock keyed on
   * (userId, type) serializes attempts, the same pattern used for the
   * scheduling and payment double-booking fixes.
   */
  private async open(userId: string, type: TimeEntryType, jobId: string | null, event?: string) {
    const tenantId = tenantContext.tenantId;
    const claim = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', `${userId}:${type}`);
      const existing = await tx.timeEntry.findFirst({ where: { userId, type, tenantId, endedAt: null }, orderBy: { startedAt: 'desc' } });
      if (existing) return { alreadyOpen: true as const, entry: existing };
      const entry = await tx.timeEntry.create({ data: { tenantId, userId, type, jobId } as any });
      return { alreadyOpen: false as const, entry };
    });
    if (!claim.alreadyOpen && event) await this.emit(event, userId, { jobId, entryId: claim.entry.id });
    return claim.entry;
  }

  private openEntry(userId: string, type: TimeEntryType) {
    return this.prisma.db.timeEntry.findFirst({ where: { userId, type, endedAt: null }, orderBy: { startedAt: 'desc' } });
  }

  private async close(id: string, miles?: number) {
    const entry = await this.prisma.db.timeEntry.findUniqueOrThrow({ where: { id } });
    const endedAt = new Date();
    const durationMinutes = Math.max(0, Math.round((endedAt.getTime() - entry.startedAt.getTime()) / 60000));
    return this.prisma.db.timeEntry.update({
      where: { id },
      data: { endedAt, durationMinutes, ...(miles !== undefined ? { miles } : {}) },
    });
  }

  private async closeOpen(userId: string, type: TimeEntryType, event?: string, jobId?: string) {
    const open = await this.openEntry(userId, type);
    if (!open) throw new BadRequestException(`No active ${type.toLowerCase()}`);
    const closed = await this.close(open.id);
    if (event) await this.emit(event, userId, { jobId: jobId ?? open.jobId });
    return closed;
  }

  private emit(name: string, userId: string, extra: Record<string, unknown>) {
    return this.bus.emit({ name, tenantId: tenantContext.tenantId, payload: { user: { id: userId }, ...extra } });
  }
}
