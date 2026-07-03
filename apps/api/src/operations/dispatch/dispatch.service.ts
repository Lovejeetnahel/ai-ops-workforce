import { Injectable, Logger } from '@nestjs/common';
import { Lead, MemorySubject, User } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBus } from '../../automation/event-bus';
import { DomainEvents } from '../../automation/events';
import { tenantContext } from '../../common/tenancy/tenant-context';
import { BusinessBrainService } from '../../brain/business-brain.service';
import { ScheduleService } from '../scheduling/schedule.service';

export interface DispatchResult {
  jobId: string;
  assigneeId?: string;
  bookingId?: string;
  scheduledStart?: Date;
  reason: string;
}

/**
 * The auto-assignment engine. Consolidates the scoring + scheduling logic that
 * previously lived inline in the Dispatch agent (single source of truth, no
 * duplication). Scores every eligible staff member by skill match, service
 * zone, current workload, and the customer's Brain-remembered preferred staff,
 * then books the earliest conflict-free slot via ScheduleService. Emits
 * job.assigned so the Control Layer books REVENUE_BOOKED and the timeline updates.
 */
@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
    private readonly brain: BusinessBrainService,
    private readonly schedule: ScheduleService,
  ) {}

  async dispatchLead(leadId: string): Promise<DispatchResult> {
    const tenantId = tenantContext.tenantId;

    // Idempotent claim: exactly one Job is ever created per dispatchLead
    // call for a given lead. Found via concurrency load testing: 5
    // concurrent dispatch calls for the SAME lead each independently read
    // the lead and raced past every check, creating 5 separate jobs AND 5
    // separate bookings (the latter all double-booking the same technician
    // for the identical slot). An advisory lock keyed on the lead
    // serializes dispatch attempts: the first caller to acquire it creates
    // the job inside the same transaction, so every other caller — including
    // ones that were blocked waiting for the lock — sees that job already
    // exists once it's their turn, and returns it instead of duplicating it.
    const claim = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', leadId);
      const existingJob = await tx.job.findFirst({ where: { leadId, tenantId }, orderBy: { createdAt: 'desc' } });
      if (existingJob) return { alreadyDispatched: true as const, job: existingJob, lead: null };

      const lead = await tx.lead.findUniqueOrThrow({ where: { id: leadId } });
      const job = await tx.job.create({
        data: {
          tenantId,
          leadId: lead.id,
          contactId: lead.contactId,
          entityType: 'job',
          title: lead.serviceType ?? 'Service visit',
          description: (lead.intake as any)?.issue ?? null,
          location: lead.location,
          priority: lead.urgency === 'EMERGENCY' ? 'EMERGENCY' : 'NORMAL',
          status: 'UNSCHEDULED',
        } as any,
      });
      return { alreadyDispatched: false as const, job, lead };
    });

    if (claim.alreadyDispatched) {
      const booking = await this.prisma.db.booking.findFirst({ where: { jobId: claim.job.id }, orderBy: { createdAt: 'desc' } });
      const reason = 'already dispatched (idempotent no-op)';
      this.logger.debug(`dispatch lead ${leadId}: ${reason}, job=${claim.job.id}`);
      return {
        jobId: claim.job.id,
        assigneeId: claim.job.assignedToId ?? undefined,
        bookingId: booking?.id,
        scheduledStart: booking?.start ?? claim.job.scheduledStart ?? undefined,
        reason,
      };
    }

    const { job, lead } = claim;
    await this.bus.emit({
      name: DomainEvents.JOB_CREATED,
      tenantId,
      payload: { job: { id: job.id }, lead: { id: lead.id }, contact: { id: lead.contactId } },
    });

    const emergency = lead.urgency === 'EMERGENCY';
    const assignee = await this.pickAssignee(lead);

    // Earliest conflict-free slot (emergencies start sooner, default 2h visit).
    let slot = null as { start: Date; end: Date } | null;
    if (assignee) {
      const from = new Date(Date.now() + (emergency ? 15 : 60) * 60_000);
      const to = new Date(Date.now() + 14 * 86_400_000);
      slot = (await this.schedule.findSlots(assignee.id, from, to, 120, 1))[0] ?? null;
    }

    if (assignee) {
      await this.prisma.db.job.update({ where: { id: job.id }, data: { assignedToId: assignee.id, teamId: assignee.teamId ?? null, status: 'SCHEDULED' } });
    }

    let bookingId: string | undefined;
    let scheduledStart: Date | undefined;
    if (assignee && slot) {
      const booking = await this.schedule.book({
        userId: assignee.id,
        start: slot.start,
        end: slot.end,
        contactId: lead.contactId,
        leadId: lead.id,
        jobId: job.id,
        notes: lead.serviceType ?? undefined,
      });
      bookingId = booking.id;
      scheduledStart = booking.start;
      await this.prisma.db.job.update({ where: { id: job.id }, data: { status: 'DISPATCHED', scheduledStart: booking.start, scheduledEnd: booking.end } });
      await this.prisma.db.lead.update({ where: { id: lead.id }, data: { stage: 'BOOKED', assignedToId: assignee.id } });
    }

    await this.bus.emit({
      name: DomainEvents.JOB_ASSIGNED,
      tenantId: tenantContext.tenantId,
      payload: {
        job: { id: job.id, assignedToId: assignee?.id },
        lead: { id: lead.id, estimatedValue: lead.estimatedValue ? Number(lead.estimatedValue) : null },
        contact: { id: lead.contactId },
        bookingId,
      },
    });

    const reason = !assignee
      ? 'no eligible staff — job queued unscheduled'
      : slot
        ? `assigned to ${assignee.name} at ${scheduledStart?.toISOString()}`
        : `assigned to ${assignee.name}; no open slot in window`;
    this.logger.debug(`dispatch lead ${leadId}: ${reason}`);
    return { jobId: job.id, assigneeId: assignee?.id, bookingId, scheduledStart, reason };
  }

  /** Score eligible staff: skill + zone + workload + Brain preference. */
  async pickAssignee(lead: Lead): Promise<User | null> {
    const staff = await this.prisma.db.user.findMany({ where: { role: 'STAFF', status: 'ACTIVE' } });
    if (staff.length === 0) return null;

    const preferredId = await this.preferredStaffId(lead.contactId);

    const scored = await Promise.all(
      staff.map(async (s) => {
        let score = 0;
        if (lead.serviceType && s.skills.some((sk) => lead.serviceType!.toLowerCase().includes(sk.toLowerCase()))) score += 3;
        if (lead.location && s.serviceZones.some((z) => lead.location!.toLowerCase().includes(z.toLowerCase()))) score += 2;
        const openJobs = await this.prisma.db.job.count({
          where: { assignedToId: s.id, status: { in: ['SCHEDULED', 'DISPATCHED', 'IN_PROGRESS'] } },
        });
        score += Math.max(0, 3 - openJobs); // load balancing
        if (preferredId && s.id === preferredId) score += 5; // remembered preference wins
        return { s, score };
      }),
    );
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.s ?? null;
  }

  /** Read the customer's preferred staff from Business Brain memory. */
  private async preferredStaffId(contactId: string | null): Promise<string | null> {
    if (!contactId) return null;
    try {
      const memory = await this.brain.recall(MemorySubject.CUSTOMER, contactId);
      return (memory as any[]).find((m) => m.key === 'preferred_staff_id')?.content ?? null;
    } catch {
      return null;
    }
  }
}
