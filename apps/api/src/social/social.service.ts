import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SocialPostStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProviderFactory } from '../integrations/provider-factory.service';
import { EventBus } from '../automation/event-bus';
import { DomainEvents } from '../automation/events';
import { tenantContext } from '../common/tenancy/tenant-context';

export const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'google_business'] as const;

/**
 * Social Media V1 (Sprint 2): a REAL content planning + approval system.
 *
 * HONEST BOUNDARY: no social platform publishing API is connected. Therefore:
 *  • Posts move DRAFT → PENDING_APPROVAL → APPROVED → SCHEDULED.
 *  • PUBLISHED is only ever set by markPublished(), which records an explicit
 *    human confirmation ("I posted this manually") in publishNote — the system
 *    never claims it published anything itself.
 *  • There are NO analytics: no provider data exists, so none is shown.
 * The status machine is the clean seam for a future publishing provider.
 */
@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderFactory,
    private readonly bus: EventBus,
  ) {}

  list(filter: { status?: string; platform?: string; from?: string; to?: string }) {
    const where: any = {};
    if (filter.status) where.status = filter.status as SocialPostStatus;
    if (filter.platform) where.platform = filter.platform;
    if (filter.from || filter.to)
      where.scheduledFor = {
        ...(filter.from ? { gte: new Date(filter.from) } : {}),
        ...(filter.to ? { lte: new Date(filter.to) } : {}),
      };
    return this.prisma.db.socialPost.findMany({ where, orderBy: [{ scheduledFor: 'asc' }, { createdAt: 'desc' }], take: 300 });
  }

  async get(id: string) {
    const post = await this.prisma.db.socialPost.findFirst({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async create(input: {
    platform: string;
    caption?: string;
    mediaRefs?: string[];
    scheduledFor?: string;
    campaignId?: string;
    goalId?: string;
    assignedToId?: string;
    agentKey?: string;
  }) {
    if (!SOCIAL_PLATFORMS.includes(input.platform as any))
      throw new BadRequestException(`platform must be one of: ${SOCIAL_PLATFORMS.join(', ')}`);
    return this.prisma.db.socialPost.create({
      data: {
        platform: input.platform,
        caption: input.caption ?? '',
        mediaRefs: (input.mediaRefs ?? []) as any,
        scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
        campaignId: input.campaignId ?? null,
        goalId: input.goalId ?? null,
        assignedToId: input.assignedToId ?? null,
        agentKey: input.agentKey ?? null,
        createdById: tenantContext.get()?.userId ?? null,
      } as any,
    });
  }

  async update(id: string, input: Partial<{ caption: string; mediaRefs: string[]; scheduledFor: string | null; platform: string; assignedToId: string | null; agentKey: string | null; campaignId: string | null; goalId: string | null }>) {
    const post = await this.get(id);
    if (post.status === 'PUBLISHED') throw new BadRequestException('Published posts are immutable history');
    const data: any = {};
    if (input.caption !== undefined) data.caption = input.caption;
    if (input.mediaRefs !== undefined) data.mediaRefs = input.mediaRefs as any;
    if (input.platform !== undefined) {
      if (!SOCIAL_PLATFORMS.includes(input.platform as any)) throw new BadRequestException('Unknown platform');
      data.platform = input.platform;
    }
    if (input.scheduledFor !== undefined) data.scheduledFor = input.scheduledFor ? new Date(input.scheduledFor) : null;
    for (const k of ['assignedToId', 'agentKey', 'campaignId', 'goalId'] as const) if (input[k] !== undefined) data[k] = input[k];
    // Any edit to an approved/scheduled post sends it back for re-approval.
    if (['APPROVED', 'SCHEDULED'].includes(post.status) && (input.caption !== undefined || input.mediaRefs !== undefined))
      data.status = 'PENDING_APPROVAL';
    return this.prisma.db.socialPost.update({ where: { id }, data });
  }

  async submitForApproval(id: string) {
    const post = await this.get(id);
    if (post.status !== 'DRAFT') throw new BadRequestException(`Only drafts can be submitted (post is ${post.status})`);
    if (!post.caption?.trim()) throw new BadRequestException('Write the caption before submitting for approval');
    return this.prisma.db.socialPost.update({ where: { id }, data: { status: 'PENDING_APPROVAL' } });
  }

  /** ADMIN+ (enforced at controller). */
  async approve(id: string) {
    const post = await this.get(id);
    if (post.status !== 'PENDING_APPROVAL') throw new BadRequestException(`Post is ${post.status}, not pending approval`);
    return this.prisma.db.socialPost.update({
      where: { id },
      data: {
        status: post.scheduledFor ? 'SCHEDULED' : 'APPROVED',
        approvedById: tenantContext.get()?.userId ?? null,
        approvedAt: new Date(),
      },
    });
  }

  async reject(id: string) {
    const post = await this.get(id);
    if (post.status !== 'PENDING_APPROVAL') throw new BadRequestException(`Post is ${post.status}, not pending approval`);
    return this.prisma.db.socialPost.update({ where: { id }, data: { status: 'DRAFT' } });
  }

  async schedule(id: string, scheduledFor: string) {
    const post = await this.get(id);
    if (!['APPROVED', 'SCHEDULED'].includes(post.status))
      throw new BadRequestException('Only approved posts can be scheduled');
    const when = new Date(scheduledFor);
    if (Number.isNaN(when.getTime())) throw new BadRequestException('Invalid date');
    return this.prisma.db.socialPost.update({ where: { id }, data: { status: 'SCHEDULED', scheduledFor: when } });
  }

  /**
   * The honest publish step: a human confirms THEY posted it on the platform.
   * Records who confirmed and when — never claims automated publishing.
   */
  async markPublished(id: string, note?: string) {
    const post = await this.get(id);
    if (!['APPROVED', 'SCHEDULED'].includes(post.status))
      throw new BadRequestException('Only approved/scheduled posts can be marked published');
    const userId = tenantContext.get()?.userId ?? null;
    const updated = await this.prisma.db.socialPost.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishNote: note?.trim() || 'Marked as published manually (no platform integration — human confirmation)',
      },
    });
    await this.bus.emit({
      name: DomainEvents.SOCIAL_POST_PUBLISHED,
      tenantId: tenantContext.tenantId,
      payload: { post: { id, platform: post.platform }, manual: true, byUserId: userId },
    });
    return updated;
  }

  async cancel(id: string) {
    const post = await this.get(id);
    if (post.status === 'PUBLISHED') throw new BadRequestException('Published posts are history — they cannot be cancelled');
    return this.prisma.db.socialPost.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  /** Plain-text export of approved/scheduled content for manual posting. */
  async exportContent(filter: { from?: string; to?: string }) {
    const posts = await this.list({ ...filter, status: undefined });
    const exportable = posts.filter((p) => ['APPROVED', 'SCHEDULED'].includes(p.status));
    return {
      count: exportable.length,
      posts: exportable.map((p) => ({
        platform: p.platform,
        scheduledFor: p.scheduledFor,
        caption: p.caption,
        mediaRefs: p.mediaRefs,
      })),
    };
  }

  /** AI caption draft grounded in the company profile. Draft only. */
  async aiDraft(input: { platform: string; topic?: string; notes?: string }) {
    const llm = this.providers.llm();
    if (llm.provider === 'stub') return { available: false, reason: 'AI drafting requires the platform AI to be configured.', draft: null };
    const profile = await this.prisma.db.companyProfile.findFirst({
      select: { tenantId: true, brandName: true, legalName: true, tagline: true, brandVoice: true, targetMarket: true },
    });
    const name = profile?.brandName ?? profile?.legalName ?? 'the business';
    const { text } = await llm.complete({
      system: `You draft ONE social media post caption for ${name}${profile?.tagline ? ` — ${profile.tagline}` : ''}, for ${input.platform}.${profile?.brandVoice ? ` Voice: ${profile.brandVoice}.` : ''}${profile?.targetMarket ? ` Audience: ${profile.targetMarket}.` : ''} Rules: no fabricated offers, testimonials or statistics; concrete and local; 1–3 relevant hashtags max; plain text.`,
      messages: [{ role: 'user', content: `Topic: ${input.topic ?? 'showcase our work and invite people to get in touch'}. ${input.notes ?? ''}` }],
      maxTokens: 350,
    });
    return { available: true, draft: text.trim(), note: 'Draft only — review, approve, then post.' };
  }

  /** Honest platform-connection state for the UI. */
  connections() {
    return SOCIAL_PLATFORMS.map((p) => ({
      platform: p,
      connected: false,
      note: 'Publishing integration not connected — plan, approve and export here; post on the platform manually.',
    }));
  }
}
