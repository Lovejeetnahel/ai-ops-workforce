import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Read-only field performance analytics from time, job, approval & form data. */
@Injectable()
export class FieldAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async employeeDashboard(userId: string) {
    const now = new Date();
    const dayStart = startOfUtcDay(now);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const weekStart = new Date(now.getTime() - 7 * 86_400_000);

    const [todaysJobs, openShift, pendingApprovals, completedThisWeek, shiftEntries] = await Promise.all([
      this.prisma.db.job.findMany({
        where: { assignedToId: userId, scheduledStart: { gte: dayStart, lt: dayEnd } },
        orderBy: { scheduledStart: 'asc' },
        select: { id: true, title: true, status: true, location: true, scheduledStart: true, priority: true },
      }),
      this.prisma.db.timeEntry.findFirst({ where: { userId, type: 'SHIFT', endedAt: null } }),
      this.prisma.db.jobApproval.count({ where: { status: 'PENDING', requestedById: userId } }),
      this.prisma.db.job.count({ where: { assignedToId: userId, completedAt: { gte: weekStart } } }),
      this.prisma.db.timeEntry.findMany({ where: { userId, type: 'SHIFT', startedAt: { gte: dayStart } }, select: { durationMinutes: true, startedAt: true, endedAt: true } }),
    ]);

    let minutesToday = shiftEntries.reduce((s, e) => s + (e.durationMinutes ?? 0), 0);
    if (openShift) minutesToday += Math.round((now.getTime() - openShift.startedAt.getTime()) / 60_000);

    return {
      clockedIn: !!openShift,
      hoursToday: Math.round((minutesToday / 60) * 10) / 10,
      todaysJobs,
      pendingApprovals,
      completedThisWeek,
    };
  }

  async supervisorDashboard() {
    const weekStart = new Date(Date.now() - 7 * 86_400_000);
    const [clockedIn, jobsByStatus, pendingApprovals, recentIncidents] = await Promise.all([
      this.prisma.db.timeEntry.findMany({ where: { type: 'SHIFT', endedAt: null }, distinct: ['userId'], select: { userId: true } }),
      this.prisma.db.job.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.db.jobApproval.count({ where: { status: 'PENDING' } }),
      this.prisma.db.fieldFormSubmission.count({ where: { type: { in: ['INCIDENT', 'SAFETY', 'DAMAGE'] }, createdAt: { gte: weekStart } } }),
    ]);
    return {
      staffOnShift: clockedIn.length,
      jobsByStatus: jobsByStatus.reduce((acc, g) => ({ ...acc, [g.status]: g._count._all }), {} as Record<string, number>),
      pendingApprovals,
      incidentsThisWeek: recentIncidents,
    };
  }

  async employeeKpis(userId: string, from: Date, to: Date) {
    const [completed, entries, forms] = await Promise.all([
      this.prisma.db.job.count({ where: { assignedToId: userId, completedAt: { gte: from, lte: to } } }),
      this.prisma.db.timeEntry.findMany({ where: { userId, startedAt: { gte: from, lte: to }, endedAt: { not: null } }, select: { type: true, durationMinutes: true } }),
      this.prisma.db.fieldFormSubmission.count({ where: { userId, createdAt: { gte: from, lte: to } } }),
    ]);
    const minutes: Record<string, number> = {};
    for (const e of entries) minutes[e.type] = (minutes[e.type] ?? 0) + (e.durationMinutes ?? 0);
    const shiftMin = minutes['SHIFT'] ?? 0;
    const jobMin = minutes['JOB'] ?? 0;
    return {
      jobsCompleted: completed,
      minutesByType: minutes,
      utilization: shiftMin ? Math.round((jobMin / shiftMin) * 100) : 0,
      avgJobMinutes: completed ? Math.round(jobMin / completed) : 0,
      formsSubmitted: forms,
    };
  }

  async attendance(from: Date, to: Date) {
    const grouped = await this.prisma.db.timeEntry.groupBy({
      by: ['userId'],
      where: { type: 'SHIFT', startedAt: { gte: from, lte: to }, endedAt: { not: null } },
      _sum: { durationMinutes: true },
      _count: { _all: true },
    });
    return grouped.map((g) => ({ userId: g.userId, shifts: g._count._all, hours: Math.round(((g._sum.durationMinutes ?? 0) / 60) * 10) / 10 }));
  }
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
