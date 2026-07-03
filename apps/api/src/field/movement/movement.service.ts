import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBus } from '../../automation/event-bus';
import { DomainEvents } from '../../automation/events';
import { tenantContext } from '../../common/tenancy/tenant-context';

/**
 * Field movement: GPS breadcrumbs (live location), a per-staff daily route, and
 * turn-by-turn navigation deep links. Route stops are ordered by scheduled time
 * (deterministic, no geocoding dependency) — a real, swappable baseline for a
 * future distance-optimized planner.
 */
@Injectable()
export class MovementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
  ) {}

  async ping(userId: string, lat: number, lng: number, jobId?: string) {
    const ping = await this.prisma.db.locationPing.create({ data: { userId, lat, lng, jobId: jobId ?? null } as any });
    await this.bus.emit({ name: DomainEvents.LOCATION_UPDATED, tenantId: tenantContext.tenantId, payload: { user: { id: userId }, lat, lng, jobId } });
    return ping;
  }

  lastLocation(userId: string) {
    return this.prisma.db.locationPing.findFirst({ where: { userId }, orderBy: { recordedAt: 'desc' } });
  }

  /** Latest known location per staff member — supervisor live map. */
  teamLocations() {
    return this.prisma.db.locationPing.findMany({ distinct: ['userId'], orderBy: { recordedAt: 'desc' }, take: 200 });
  }

  /** A staff member's ordered route for a day, with navigation deep links. */
  async route(userId: string, date: Date) {
    const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const jobs = await this.prisma.db.job.findMany({
      where: { assignedToId: userId, scheduledStart: { gte: dayStart, lt: dayEnd } },
      orderBy: { scheduledStart: 'asc' },
      select: { id: true, title: true, location: true, scheduledStart: true, status: true },
    });
    return jobs.map((j, i) => ({
      stop: i + 1,
      jobId: j.id,
      title: j.title,
      location: j.location,
      scheduledStart: j.scheduledStart,
      status: j.status,
      navigationUrl: j.location ? this.mapsLink(j.location) : null,
    }));
  }

  async navigationLink(jobId: string) {
    const job = await this.prisma.db.job.findUnique({ where: { id: jobId }, select: { location: true } });
    if (!job?.location) throw new NotFoundException('Job has no location');
    return { url: this.mapsLink(job.location) };
  }

  private mapsLink(destination: string) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  }
}
