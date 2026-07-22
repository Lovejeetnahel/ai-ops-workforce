import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { AgentOrchestrator } from './agent-orchestrator.service';
import { EmployeeSchedule, parseSchedule } from './employee-config';

/**
 * Scheduled AI-employee runs. Mirrors the proven WorkflowRouter sweep design:
 * a 60s interval scans due AgentInstallations and CLAIMS each one via a
 * compare-and-swap updateMany on the exact previous nextRunAt — only the
 * instance whose CAS matched (count === 1) runs the task, so concurrent API
 * instances can never double-fire a scheduled run, and a restart simply
 * resumes at the next sweep (nextRunAt is durable in Postgres).
 *
 * - next-run computation happens in the TENANT's own timezone
 * - missed runs collapse to one (nextRunAt advances from NOW, no backfill storm)
 * - disabled installations are never armed or claimed
 * - non-ACTIVE tenants are skipped (their nextRunAt still advances quietly)
 * - execution history is the ordinary AgentTask trail via the orchestrator
 */

/**
 * Next occurrence of `schedule` strictly after `from`, in `timeZone`. Walks
 * hour boundaries with Intl (no date library, DST-safe) — bounded to 8 days.
 * Exported for unit tests.
 */
export function computeNextRun(schedule: EmployeeSchedule, timeZone: string, from: Date): Date {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false, weekday: 'short' });
  const dayIndex: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  // Start at the next top-of-hour after `from`.
  const cursor = new Date(from);
  cursor.setMinutes(0, 0, 0);
  cursor.setHours(cursor.getHours() + 1);
  for (let i = 0; i < 24 * 8; i++) {
    const parts = fmt.formatToParts(cursor);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value) % 24;
    const weekday = dayIndex[parts.find((p) => p.type === 'weekday')?.value ?? ''] ?? -1;
    const hourMatch = hour === schedule.hour;
    const dayMatch = schedule.frequency === 'daily' || weekday === schedule.dayOfWeek;
    if (hourMatch && dayMatch) return new Date(cursor);
    cursor.setHours(cursor.getHours() + 1);
  }
  // Defensive fallback (invalid tz etc.): try again in 24h rather than never.
  return new Date(from.getTime() + 24 * 60 * 60 * 1000);
}

const SWEEP_MS = 60_000;
const BATCH = 20;

@Injectable()
export class EmployeeSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmployeeSchedulerService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: AgentOrchestrator,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.sweep().catch((e) => this.logger.error(`sweep failed: ${e.message}`)), SWEEP_MS);
    this.logger.log('AI employee scheduler armed (60s sweep, CAS-claimed runs)');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass: arm newly-scheduled installations, then claim + run due ones. */
  async sweep(): Promise<{ armed: number; ran: number }> {
    const armed = await this.armPass();
    const ran = await this.runPass();
    return { armed, ran };
  }

  /**
   * Arm pass: installations with a valid schedule in config but no nextRunAt
   * (new schedule, or cleared after a config change) get their first nextRunAt
   * computed in their tenant's timezone. Also disarms rows whose schedule was
   * removed. Runs with no ambient tenant context (global system scan) — the
   * same precedent as WorkflowEngine.resumeDueGlobal.
   */
  private async armPass(): Promise<number> {
    const candidates = await this.prisma.db.agentInstallation.findMany({
      where: { enabled: true, nextRunAt: null },
      take: 200,
      select: { id: true, tenantId: true, config: true },
    });
    let armed = 0;
    for (const row of candidates) {
      const schedule = parseSchedule((row.config as any)?.schedule);
      if (!schedule) continue;
      const tenant = await this.prisma.tenant.findUnique({ where: { id: row.tenantId }, select: { timezone: true, status: true } });
      if (!tenant) continue;
      const next = computeNextRun(schedule, tenant.timezone || 'America/New_York', new Date());
      // CAS on nextRunAt still being null so two instances can't both arm it.
      const claimed = await this.prisma.db.agentInstallation.updateMany({ where: { id: row.id, nextRunAt: null }, data: { nextRunAt: next } });
      if (claimed.count === 1) armed += 1;
    }
    return armed;
  }

  /** Claim + execute due schedules. */
  private async runPass(): Promise<number> {
    const now = new Date();
    const due = await this.prisma.db.agentInstallation.findMany({
      where: { enabled: true, nextRunAt: { lte: now } },
      take: BATCH,
      select: { id: true, tenantId: true, agentKey: true, config: true, nextRunAt: true },
    });

    let ran = 0;
    for (const row of due) {
      const schedule = parseSchedule((row.config as any)?.schedule);
      const tenant = await this.prisma.tenant.findUnique({ where: { id: row.tenantId }, select: { timezone: true, status: true } });

      // Schedule removed since arming → disarm (CAS so we never stomp a newer value).
      if (!schedule || !tenant) {
        await this.prisma.db.agentInstallation.updateMany({ where: { id: row.id, nextRunAt: row.nextRunAt }, data: { nextRunAt: null } });
        continue;
      }

      // Missed-run collapse: however overdue, advance from NOW to the single
      // next occurrence — never a backfill storm after downtime.
      const next = computeNextRun(schedule, tenant.timezone || 'America/New_York', now);

      // THE claim: only the instance whose CAS matches the exact previous
      // nextRunAt wins this run.
      const claimed = await this.prisma.db.agentInstallation.updateMany({
        where: { id: row.id, nextRunAt: row.nextRunAt },
        data: { nextRunAt: next, lastRunAt: now },
      });
      if (claimed.count !== 1) continue;

      // Suspended/inactive tenants: schedule advanced above, work skipped.
      if (tenant.status !== 'ACTIVE') continue;

      ran += 1;
      try {
        await tenantContext.run({ tenantId: row.tenantId }, () =>
          this.orchestrator.run(row.agentKey, { type: schedule.taskType, params: { scheduled: true } }),
        );
      } catch (err) {
        // The AgentTask row records the failure; the schedule stays armed.
        this.logger.warn(`scheduled run failed: ${row.agentKey}@${row.tenantId}: ${(err as Error).message}`);
      }
    }
    return ran;
  }
}
