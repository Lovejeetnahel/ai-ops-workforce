import { Injectable } from '@nestjs/common';
import { JobStatus, Lead } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EventBus } from '../../automation/event-bus';
import { DomainEvents } from '../../automation/events';
import { tenantContext } from '../../common/tenancy/tenant-context';

/**
 * Universal job / work-order lifecycle. Every transition emits an event so the
 * timeline (Activity projector), control loop (Outcome evaluator), and
 * automations all react without coupling. Industry vocabulary comes from the
 * module config via `entityType`; the model stays generic.
 */
@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
  ) {}

  async createFromLead(lead: Lead, opts: { assigneeId?: string | null; teamId?: string | null; title?: string; entityType?: string } = {}) {
    const job = await this.prisma.db.job.create({
      data: {
        leadId: lead.id,
        contactId: lead.contactId,
        entityType: opts.entityType ?? 'job',
        title: opts.title ?? lead.serviceType ?? 'Service visit',
        description: (lead.intake as any)?.issue ?? null,
        location: lead.location,
        priority: lead.urgency === 'EMERGENCY' ? 'EMERGENCY' : 'NORMAL',
        status: opts.assigneeId ? 'SCHEDULED' : 'UNSCHEDULED',
        assignedToId: opts.assigneeId ?? null,
        teamId: opts.teamId ?? null,
      } as any,
    });

    await this.bus.emit({
      name: DomainEvents.JOB_CREATED,
      tenantId: tenantContext.tenantId,
      payload: { job: { id: job.id }, lead: { id: lead.id }, contact: { id: lead.contactId } },
    });
    return job;
  }

  async updateStatus(id: string, status: JobStatus) {
    const job = await this.prisma.db.job.update({
      where: { id },
      data: { status, ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}) },
    });

    const subject = {
      job: { id: job.id, status },
      lead: job.leadId ? { id: job.leadId } : undefined,
      contact: job.contactId ? { id: job.contactId } : undefined,
    };
    await this.bus.emit({ name: DomainEvents.JOB_STATUS_CHANGED, tenantId: tenantContext.tenantId, payload: subject });
    if (status === 'COMPLETED') {
      await this.bus.emit({ name: DomainEvents.JOB_COMPLETED, tenantId: tenantContext.tenantId, payload: subject });
    }
    return job;
  }

  list(filter: { status?: JobStatus; assignedToId?: string } = {}) {
    return this.prisma.db.job.findMany({
      where: {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.assignedToId ? { assignedToId: filter.assignedToId } : {}),
      },
      orderBy: { scheduledStart: 'asc' },
      include: { contact: { select: { name: true, phone: true } }, assignedTo: { select: { id: true, name: true } } },
      take: 200,
    });
  }

  get(id: string) {
    return this.prisma.db.job.findUniqueOrThrow({
      where: { id },
      include: {
        contact: true,
        assignedTo: { select: { id: true, name: true } },
        bookings: true,
        documents: true,
        activities: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
  }
}
