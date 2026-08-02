import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CampaignChannel, CampaignStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProviderFactory } from '../integrations/provider-factory.service';
import { CommsService } from '../integrations/comms.service';
import { EventBus } from '../automation/event-bus';
import { DomainEvents } from '../automation/events';
import { tenantContext } from '../common/tenancy/tenant-context';

/** Max recipients per campaign start — keeps V1 sends inline and accountable. */
const MAX_RECIPIENTS = 500;

export interface AudienceFilter {
  tags?: string[];
  /** Contacts whose latest lead sits in one of these stages. */
  stages?: string[];
  q?: string;
}

/**
 * Marketing V1 (Sprint 2). Campaigns over the REAL contact base with an
 * auditable per-recipient send trail.
 *
 * HONESTY CONTRACT:
 *  • start() refuses without a really-configured provider (no stub sends).
 *  • A recipient is SENT only when the provider accepted the message; FAILED
 *    stores a sanitized error; SKIPPED means no usable phone/email.
 *  • Metrics expose sends/failures/attributed leads — never opens/clicks/
 *    conversions we cannot measure (no tracking pixels exist in V1).
 *  • Attributed revenue is labeled ESTIMATED (contact-level heuristic).
 */
@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderFactory,
    private readonly comms: CommsService,
    private readonly bus: EventBus,
  ) {}

  list(filter?: { status?: string; templates?: boolean }) {
    return this.prisma.db.campaign.findMany({
      where: {
        isTemplate: filter?.templates ?? false,
        ...(filter?.status ? { status: filter.status as CampaignStatus } : {}),
      },
      include: { _count: { select: { recipients: true, leads: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
  }

  async get(id: string) {
    const campaign = await this.prisma.db.campaign.findFirst({
      where: { id },
      include: {
        recipients: {
          include: { contact: { select: { id: true, name: true, phone: true, email: true } } },
          orderBy: { createdAt: 'asc' },
          take: MAX_RECIPIENTS,
        },
        _count: { select: { leads: true } },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async create(input: {
    name: string;
    description?: string;
    channel: string;
    subject?: string;
    content?: string;
    audience?: AudienceFilter;
    goalId?: string;
    isTemplate?: boolean;
    scheduledAt?: string;
  }) {
    if (!input.name?.trim()) throw new BadRequestException('name is required');
    if (input.channel !== 'SMS' && input.channel !== 'EMAIL') throw new BadRequestException('channel must be SMS or EMAIL');
    if (input.goalId) {
      const goal = await this.prisma.db.goal.findFirst({ where: { id: input.goalId }, select: { id: true, tenantId: true } });
      if (!goal) throw new BadRequestException('Unknown goal');
    }
    return this.prisma.db.campaign.create({
      data: {
        name: input.name.trim(),
        description: input.description ?? null,
        channel: input.channel as CampaignChannel,
        subject: input.subject ?? null,
        content: input.content ?? '',
        audience: (input.audience ?? {}) as any,
        goalId: input.goalId ?? null,
        isTemplate: input.isTemplate ?? false,
        createdById: tenantContext.get()?.userId ?? null,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        status: input.scheduledAt ? 'SCHEDULED' : 'DRAFT',
      } as any,
    });
  }

  async update(id: string, input: Partial<{ name: string; description: string; subject: string; content: string; audience: AudienceFilter; goalId: string | null; scheduledAt: string | null }>) {
    const campaign = await this.getBare(id);
    if (['ACTIVE', 'COMPLETED'].includes(campaign.status))
      throw new BadRequestException(`A ${campaign.status.toLowerCase()} campaign can no longer be edited`);
    const data: any = {};
    for (const k of ['name', 'description', 'subject', 'content'] as const) if (input[k] !== undefined) data[k] = input[k];
    if (input.audience !== undefined) data.audience = input.audience as any;
    if (input.goalId !== undefined) data.goalId = input.goalId;
    if (input.scheduledAt !== undefined) {
      data.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
      data.status = input.scheduledAt ? 'SCHEDULED' : 'DRAFT';
    }
    return this.prisma.db.campaign.update({ where: { id }, data });
  }

  async setStatus(id: string, status: 'PAUSED' | 'CANCELLED' | 'DRAFT') {
    const campaign = await this.getBare(id);
    if (campaign.status === 'COMPLETED') throw new BadRequestException('Campaign already completed');
    return this.prisma.db.campaign.update({ where: { id }, data: { status } });
  }

  /** Approval step (ADMIN+, enforced at the controller). */
  async approve(id: string) {
    await this.getBare(id);
    return this.prisma.db.campaign.update({
      where: { id },
      data: { approvedById: tenantContext.get()?.userId ?? null, approvedAt: new Date() },
    });
  }

  /** Resolve the audience against REAL contacts — count + sample, no sends. */
  async previewAudience(audience: AudienceFilter, channel: string) {
    const where = this.audienceWhere(audience);
    const [total, sample] = await Promise.all([
      this.prisma.db.contact.count({ where }),
      this.prisma.db.contact.findMany({ where, select: { id: true, name: true, phone: true, email: true }, take: 10 }),
    ]);
    const reachableWhere = { ...where, ...(channel === 'EMAIL' ? { email: { not: null } } : { phone: { not: null } }) };
    const reachable = await this.prisma.db.contact.count({ where: reachableWhere });
    return { total, reachable, unreachable: total - reachable, sample };
  }

  /**
   * Start the campaign: materialize recipients, send through the real
   * provider, record per-recipient truth. Requires prior approval.
   */
  async start(id: string) {
    const campaign = await this.getBare(id);
    if (campaign.isTemplate) throw new BadRequestException('Templates cannot be started — create a campaign from it first');
    if (!['DRAFT', 'SCHEDULED', 'PAUSED'].includes(campaign.status))
      throw new BadRequestException(`Campaign is ${campaign.status} — only draft/scheduled/paused campaigns can start`);
    if (!campaign.content?.trim()) throw new BadRequestException('Campaign has no message content');
    if (!campaign.approvedAt) throw new BadRequestException('Campaign needs admin approval before sending');

    const comms = await this.providers.commsStatus(tenantContext.tenantId);
    const configured = campaign.channel === 'EMAIL' ? comms.email.configured : comms.sms.configured;
    if (!configured)
      throw new ServiceUnavailableException(
        `Sending requires a connected ${campaign.channel === 'EMAIL' ? 'SendGrid' : 'Twilio'} integration — Settings → Integrations.`,
      );

    const where = this.audienceWhere((campaign.audience ?? {}) as AudienceFilter);
    const contacts = await this.prisma.db.contact.findMany({
      where,
      select: { id: true, name: true, phone: true, email: true },
      take: MAX_RECIPIENTS,
    });
    if (contacts.length === 0) throw new BadRequestException('The audience filter matches no contacts');

    await this.prisma.db.campaign.update({ where: { id }, data: { status: 'ACTIVE', startedAt: campaign.startedAt ?? new Date() } });
    await this.bus.emit({
      name: DomainEvents.CAMPAIGN_STARTED,
      tenantId: tenantContext.tenantId,
      payload: { campaign: { id, name: campaign.name, channel: campaign.channel }, audienceSize: contacts.length },
    });

    let sent = 0, failed = 0, skipped = 0;
    for (const contact of contacts) {
      // Idempotent per contact: re-starting a paused campaign never re-sends.
      const existing = await this.prisma.db.campaignRecipient.findFirst({
        where: { campaignId: id, contactId: contact.id },
        select: { id: true, tenantId: true, status: true },
      });
      if (existing && existing.status !== 'PENDING') continue;
      const recipient =
        existing ??
        (await this.prisma.db.campaignRecipient.create({ data: { campaignId: id, contactId: contact.id } as any }));

      const to = campaign.channel === 'EMAIL' ? contact.email : contact.phone;
      if (!to) {
        await this.prisma.db.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: 'SKIPPED', error: `No ${campaign.channel === 'EMAIL' ? 'email' : 'phone'} on file` },
        });
        skipped++;
        continue;
      }
      try {
        const body = campaign.content.replace(/\{\{\s*name\s*\}\}/gi, contact.name.split(' ')[0]);
        if (campaign.channel === 'EMAIL')
          await this.comms.sendEmail(tenantContext.tenantId, { to, subject: campaign.subject ?? campaign.name, body });
        else await this.comms.sendSms(tenantContext.tenantId, { to, body });
        await this.prisma.db.campaignRecipient.update({ where: { id: recipient.id }, data: { status: 'SENT', sentAt: new Date() } });
        sent++;
      } catch (err) {
        await this.prisma.db.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: 'FAILED', error: `Send failed: ${(err as Error).message?.slice(0, 200) ?? 'provider error'}` },
        });
        failed++;
      }
    }

    const done = await this.prisma.db.campaign.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    await this.bus.emit({
      name: DomainEvents.CAMPAIGN_COMPLETED,
      tenantId: tenantContext.tenantId,
      payload: { campaign: { id, name: campaign.name }, sent, failed, skipped },
    });
    return { campaign: done, sent, failed, skipped, audience: contacts.length };
  }

  /**
   * Real performance numbers only. Delivery beyond provider acceptance,
   * opens and clicks are NOT tracked in V1 and are reported as unavailable.
   */
  async metrics(id: string) {
    const campaign = await this.getBare(id);
    const [byStatus, attributedLeads, wonLeads] = await Promise.all([
      this.prisma.db.campaignRecipient.groupBy({ by: ['status'], where: { campaignId: id }, _count: true }),
      this.prisma.db.lead.count({ where: { campaignId: id } }),
      this.prisma.db.lead.findMany({ where: { campaignId: id, stage: 'COMPLETED' }, select: { actualValue: true, estimatedValue: true } }),
    ]);
    const count = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
    const attributedRevenue = wonLeads.reduce((sum, l) => sum + Number(l.actualValue ?? 0), 0);
    return {
      campaignId: id,
      status: campaign.status,
      recipients: { sent: count('SENT'), failed: count('FAILED'), skipped: count('SKIPPED'), pending: count('PENDING') },
      attributedLeads,
      attributedRevenue: { amount: attributedRevenue, attribution: 'ESTIMATED', note: 'Sum of actual value on won leads tagged with this campaign.' },
      unavailable: ['opens', 'clicks', 'deliveryConfirmations'],
    };
  }

  /**
   * AI campaign draft grounded in the company profile. Draft only — the human
   * edits, an admin approves, then it can send.
   */
  async aiDraft(input: { channel: string; goal?: string; notes?: string }) {
    const llm = this.providers.llm();
    if (llm.provider === 'stub') return { available: false, reason: 'AI drafting requires the platform AI to be configured.', draft: null };
    const profile = await this.prisma.db.companyProfile.findFirst({
      select: { tenantId: true, brandName: true, legalName: true, tagline: true, brandVoice: true, targetMarket: true },
    });
    const name = profile?.brandName ?? profile?.legalName ?? 'the business';
    const { text } = await llm.complete({
      system: `You draft ONE ${input.channel === 'EMAIL' ? 'short marketing email (subject line on the first line, then a blank line, then the body)' : 'SMS marketing message (max 320 characters)'} for ${name}${profile?.tagline ? ` — ${profile.tagline}` : ''}.${profile?.brandVoice ? ` Voice: ${profile.brandVoice}.` : ''}${profile?.targetMarket ? ` Audience: ${profile.targetMarket}.` : ''} Rules: no fabricated discounts/claims, include a clear call to action, use {{name}} where the customer's first name belongs, plain text only.`,
      messages: [{ role: 'user', content: `Campaign goal: ${input.goal ?? 'bring past customers back'}. ${input.notes ?? ''}` }],
      maxTokens: 500,
    });
    return { available: true, draft: text.trim(), note: 'Draft only — edit, get approval, then send.' };
  }

  private audienceWhere(audience: AudienceFilter) {
    const where: any = {};
    if (audience.tags?.length) where.tags = { hasSome: audience.tags };
    if (audience.q) where.name = { contains: audience.q, mode: 'insensitive' };
    if (audience.stages?.length) where.leads = { some: { stage: { in: audience.stages as any[] } } };
    return where;
  }

  private async getBare(id: string) {
    const campaign = await this.prisma.db.campaign.findFirst({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }
}
