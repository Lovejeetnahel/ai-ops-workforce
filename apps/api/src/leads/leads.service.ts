import { Injectable } from '@nestjs/common';
import { LeadStage } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { EventBus } from '../automation/event-bus';
import { DomainEvents } from '../automation/events';
import { tenantContext } from '../common/tenancy/tenant-context';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: EventBus,
  ) {}

  list(stage?: string) {
    return this.prisma.db.lead.findMany({
      where: stage ? { stage: stage as LeadStage } : undefined,
      include: { contact: true, assignedTo: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Pipeline board: leads grouped by stage in canonical order. */
  async board() {
    const leads = await this.prisma.db.lead.findMany({
      include: { contact: true, assignedTo: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    const order: LeadStage[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'BOOKED', 'COMPLETED', 'LOST'];
    return order.map((stage) => ({ stage, leads: leads.filter((l) => l.stage === stage) }));
  }

  /** Manual lead entry from the dashboard — still flows through the event bus. */
  async createManual(dto: any) {
    const contact = await this.prisma.db.contact.create({
      data: { name: dto.contactName, phone: dto.phone ?? null, email: dto.email ?? null } as any,
    });
    const lead = await this.prisma.db.lead.create({
      data: {
        contactId: contact.id,
        entityType: 'lead',
        source: 'manual',
        serviceType: dto.serviceType ?? null,
        urgency: (dto.urgency as any) ?? 'NORMAL',
        location: dto.location ?? null,
      } as any,
    });
    await this.bus.emit({
      name: DomainEvents.LEAD_CREATED,
      tenantId: tenantContext.tenantId,
      payload: { lead: { id: lead.id, urgency: lead.urgency, serviceType: lead.serviceType }, contact },
    });
    return lead;
  }

  async moveStage(id: string, stage: string) {
    const lead = await this.prisma.db.lead.update({ where: { id }, data: { stage: stage as LeadStage } });
    await this.bus.emit({
      name: stage === 'LOST' ? DomainEvents.LEAD_LOST : DomainEvents.LEAD_STAGE_CHANGED,
      tenantId: tenantContext.tenantId,
      payload: { lead: { id: lead.id, stage } },
    });
    return lead;
  }
}
