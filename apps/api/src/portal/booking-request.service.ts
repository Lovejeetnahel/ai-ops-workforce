import { Injectable, Logger } from '@nestjs/common';
import { Urgency } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { EventBus } from '../automation/event-bus';
import { DomainEvents } from '../automation/events';
import { tenantContext } from '../common/tenancy/tenant-context';
import { DispatchService } from '../operations/dispatch/dispatch.service';

export interface BookingRequestInput {
  serviceType?: string;
  urgency?: string;
  preferredAt?: string;
  notes?: string;
}

/**
 * Customer-initiated service requests. Reuses the full pipeline: a request
 * becomes a CRM Lead (source=portal) and is run through the existing
 * DispatchService (scoring + conflict-free scheduling). No scheduling logic is
 * duplicated here — the portal is purely the external entry point.
 */
@Injectable()
export class BookingRequestService {
  private readonly logger = new Logger(BookingRequestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
    private readonly dispatch: DispatchService,
  ) {}

  async create(contactId: string, input: BookingRequestInput) {
    const urgency = this.mapUrgency(input.urgency);

    const request = await this.prisma.db.bookingRequest.create({
      data: {
        contactId,
        serviceType: input.serviceType ?? null,
        urgency,
        preferredAt: input.preferredAt ? new Date(input.preferredAt) : null,
        notes: input.notes ?? null,
        status: 'PENDING',
      } as any,
    });

    await this.bus.emit({
      name: DomainEvents.CUSTOMER_BOOKING_REQUESTED,
      tenantId: tenantContext.tenantId,
      payload: { request: { id: request.id }, contact: { id: contactId }, serviceType: input.serviceType },
    });

    // Reuse the CRM pipeline: create a Lead, then dispatch it.
    const lead = await this.prisma.db.lead.create({
      data: {
        contactId,
        entityType: 'service_request',
        source: 'portal',
        serviceType: input.serviceType ?? null,
        urgency,
        location: input.notes?.slice(0, 120) ?? null,
        stage: 'NEW',
        intake: { notes: input.notes, preferredAt: input.preferredAt } as any,
      } as any,
    });
    await this.bus.emit({
      name: DomainEvents.LEAD_CREATED,
      tenantId: tenantContext.tenantId,
      payload: { lead: { id: lead.id, urgency: lead.urgency, serviceType: lead.serviceType }, contact: { id: contactId } },
    });

    let jobId: string | undefined;
    try {
      const result = await this.dispatch.dispatchLead(lead.id);
      jobId = result.jobId;
    } catch (err) {
      this.logger.warn(`auto-dispatch failed for request ${request.id}: ${(err as Error).message}`);
    }

    const updated = await this.prisma.db.bookingRequest.update({
      where: { id: request.id },
      data: { status: 'CONVERTED', leadId: lead.id, jobId: jobId ?? null },
    });
    return { request: updated, leadId: lead.id, jobId };
  }

  list(contactId: string) {
    return this.prisma.db.bookingRequest.findMany({ where: { contactId }, orderBy: { createdAt: 'desc' } });
  }

  private mapUrgency(raw?: string): Urgency {
    const v = (raw ?? '').toLowerCase();
    if (v.includes('emerg')) return 'EMERGENCY';
    if (v.includes('urgent') || v.includes('asap')) return 'HIGH';
    if (v.includes('flex') || v.includes('low')) return 'LOW';
    return 'NORMAL';
  }
}
