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

  async moveStage(id: string, stage: string, extra?: { lostReason?: string; actualValue?: number }) {
    const data: any = { stage: stage as LeadStage };
    // Sprint 2: honest outcome capture — a won opportunity records when it was
    // won (and optionally its real value); a lost one records why.
    if (stage === 'COMPLETED') {
      data.wonAt = new Date();
      if (extra?.actualValue !== undefined) data.actualValue = extra.actualValue;
    }
    if (stage === 'LOST' && extra?.lostReason) data.lostReason = extra.lostReason;
    const lead = await this.prisma.db.lead.update({ where: { id }, data });
    await this.bus.emit({
      name: stage === 'LOST' ? DomainEvents.LEAD_LOST : DomainEvents.LEAD_STAGE_CHANGED,
      tenantId: tenantContext.tenantId,
      payload: { lead: { id: lead.id, stage, campaignId: lead.campaignId ?? null } },
    });
    return lead;
  }

  /**
   * Sprint 2: full opportunity view — the lead plus its 360° context
   * (activities, conversations, documents, payments via the contact).
   */
  async detail(id: string) {
    const lead = await this.prisma.db.lead.findFirst({
      where: { id },
      include: {
        contact: true,
        company: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        campaign: { select: { id: true, name: true, channel: true } },
        activities: { orderBy: { createdAt: 'desc' }, take: 50 },
        conversations: { select: { id: true, channel: true, status: true, lastMessageAt: true }, orderBy: { updatedAt: 'desc' }, take: 20 },
        documents: { select: { id: true, type: true, status: true, title: true, amount: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 },
        jobs: { select: { id: true, title: true, status: true, scheduledStart: true }, orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!lead) return null;
    const payments = lead.contactId
      ? await this.prisma.db.payment.findMany({
          where: { contactId: lead.contactId },
          select: { id: true, amount: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      : [];
    return { ...lead, payments };
  }

  /** Sprint 2: opportunity fields — values, attribution, ownership, outcome. */
  async patch(id: string, input: Partial<{
    serviceType: string;
    urgency: string;
    location: string;
    source: string;
    estimatedValue: number | null;
    actualValue: number | null;
    lostReason: string | null;
    assignedToId: string | null;
    campaignId: string | null;
  }>) {
    const data: any = {};
    for (const k of ['serviceType', 'urgency', 'location', 'source', 'lostReason'] as const)
      if (input[k] !== undefined) data[k] = input[k];
    if (input.estimatedValue !== undefined) data.estimatedValue = input.estimatedValue;
    if (input.actualValue !== undefined) data.actualValue = input.actualValue;
    if (input.assignedToId !== undefined) {
      if (input.assignedToId) {
        const user = await this.prisma.db.user.findFirst({ where: { id: input.assignedToId }, select: { id: true, tenantId: true } });
        if (!user) throw new Error('Unknown team member');
      }
      data.assignedToId = input.assignedToId;
    }
    if (input.campaignId !== undefined) {
      if (input.campaignId) {
        const campaign = await this.prisma.db.campaign.findFirst({ where: { id: input.campaignId }, select: { id: true, tenantId: true } });
        if (!campaign) throw new Error('Unknown campaign');
      }
      data.campaignId = input.campaignId;
    }
    return this.prisma.db.lead.update({ where: { id }, data });
  }
}
