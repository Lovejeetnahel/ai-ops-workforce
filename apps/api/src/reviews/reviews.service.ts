import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Channel, ReviewResponseStatus, ReviewSource } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProviderFactory } from '../integrations/provider-factory.service';
import { CommsService } from '../integrations/comms.service';
import { EventBus } from '../automation/event-bus';
import { DomainEvents } from '../automation/events';
import { tenantContext } from '../common/tenancy/tenant-context';

const SOURCES = Object.values(ReviewSource);

/**
 * Reviews V1 (Sprint 2). Two halves:
 *  • Review REQUESTS — a real outbound "please review us" message to a contact,
 *    sent only through a really-configured provider (honest 503 otherwise).
 *  • REVIEWS — reviews the business received, recorded here (manually or via a
 *    request). Response drafting is AI-assisted with a human approval step.
 *
 * HONEST BOUNDARY: no external review platform (Google/Facebook) is integrated.
 * Publishing a response on those platforms is a tracked MANUAL step — marking a
 * review RESPONDED records what was said and by whom; it never claims we posted
 * it anywhere automatically. This is the clean seam for future providers.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderFactory,
    private readonly comms: CommsService,
    private readonly bus: EventBus,
  ) {}

  // ── Review requests ────────────────────────────────────────────────────
  listRequests() {
    return this.prisma.db.reviewRequest.findMany({
      include: { contact: { select: { id: true, name: true, phone: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async createRequest(input: { contactId: string; channel?: string; message?: string; jobId?: string }) {
    const contact = await this.prisma.db.contact.findFirst({
      where: { id: input.contactId },
      select: { id: true, tenantId: true, name: true, phone: true, email: true },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    const channel = (input.channel ?? 'SMS') as Channel;
    if (channel !== 'SMS' && channel !== 'EMAIL') throw new BadRequestException('Review requests go out via SMS or EMAIL');

    const status = await this.providers.commsStatus(tenantContext.tenantId);
    const configured = channel === 'EMAIL' ? status.email.configured : status.sms.configured;
    if (!configured)
      throw new ServiceUnavailableException(
        `Sending review requests via ${channel} requires a connected ${channel === 'EMAIL' ? 'SendGrid' : 'Twilio'} integration — Settings → Integrations.`,
      );
    const to = channel === 'EMAIL' ? contact.email : contact.phone;
    if (!to) throw new BadRequestException(`${contact.name} has no ${channel === 'EMAIL' ? 'email address' : 'phone number'} on file.`);

    const message =
      input.message?.trim() ||
      `Hi ${contact.name.split(' ')[0]}, thanks for choosing us! Would you take a minute to leave us a review? It really helps.`;

    const request = await this.prisma.db.reviewRequest.create({
      data: { contactId: contact.id, channel, message, jobId: input.jobId ?? null, status: 'DRAFT' } as any,
    });

    try {
      if (channel === 'EMAIL') await this.comms.sendEmail(tenantContext.tenantId, { to, subject: 'How did we do?', body: message });
      else await this.comms.sendSms(tenantContext.tenantId, { to, body: message });
      const sent = await this.prisma.db.reviewRequest.update({ where: { id: request.id }, data: { status: 'SENT', sentAt: new Date() } });
      await this.bus.emit({
        name: DomainEvents.REVIEW_REQUEST_SENT,
        tenantId: tenantContext.tenantId,
        payload: { request: { id: sent.id, channel }, contact: { id: contact.id, name: contact.name } },
      });
      return sent;
    } catch (err) {
      // Sanitized failure — provider errors can carry URLs/ids, never secrets,
      // but we still store only a short, safe description.
      return this.prisma.db.reviewRequest.update({
        where: { id: request.id },
        data: { status: 'FAILED', error: `Send failed: ${(err as Error).message?.slice(0, 200) ?? 'provider error'}` },
      });
    }
  }

  // ── Reviews ────────────────────────────────────────────────────────────
  list(filter: { responseStatus?: string; minRating?: number; maxRating?: number }) {
    const where: any = {};
    if (filter.responseStatus) where.responseStatus = filter.responseStatus as ReviewResponseStatus;
    if (filter.minRating || filter.maxRating) where.rating = { ...(filter.minRating ? { gte: filter.minRating } : {}), ...(filter.maxRating ? { lte: filter.maxRating } : {}) };
    return this.prisma.db.review.findMany({
      where,
      include: { contact: { select: { id: true, name: true } }, request: { select: { id: true, channel: true, sentAt: true } } },
      orderBy: { reviewedAt: 'desc' },
      take: 200,
    });
  }

  async record(input: { contactId?: string; requestId?: string; source?: string; rating: number; text?: string; reviewedAt?: string }) {
    const rating = Number(input.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new BadRequestException('rating must be an integer 1–5');
    if (input.source && !SOURCES.includes(input.source as ReviewSource))
      throw new BadRequestException(`source must be one of: ${SOURCES.join(', ')}`);

    const review = await this.prisma.db.review.create({
      data: {
        contactId: input.contactId ?? null,
        requestId: input.requestId ?? null,
        source: (input.source as ReviewSource) ?? 'DIRECT',
        rating,
        text: input.text ?? null,
        reviewedAt: input.reviewedAt ? new Date(input.reviewedAt) : new Date(),
        // 4–5 star reviews don't demand a response the way 1–3 star ones do,
        // but all start NEEDS_RESPONSE so nothing slips silently.
      } as any,
    });
    if (input.requestId)
      await this.prisma.db.reviewRequest.updateMany({ where: { id: input.requestId }, data: { status: 'COMPLETED' } });
    await this.bus.emit({
      name: DomainEvents.REVIEW_RECEIVED,
      tenantId: tenantContext.tenantId,
      payload: { review: { id: review.id, rating, source: review.source }, contact: input.contactId ? { id: input.contactId } : null },
    });
    return review;
  }

  /** AI response draft — grounded, returned for human approval. Never posted. */
  async draftResponse(id: string) {
    const llm = this.providers.llm();
    if (llm.provider === 'stub')
      return { available: false, reason: 'AI drafting requires the platform AI to be configured.', draft: null };

    const review = await this.getReview(id);
    const profile = await this.prisma.db.companyProfile.findFirst({ select: { tenantId: true, brandName: true, legalName: true, brandVoice: true } });
    const name = profile?.brandName ?? profile?.legalName ?? 'our team';
    const { text } = await llm.complete({
      system: `You draft ONE public review response for a business owner to review before they post it themselves. Business: ${name}.${profile?.brandVoice ? ` Voice: ${profile.brandVoice}.` : ''} Rules: thank genuinely, never argue, never admit legal liability, never offer unauthorized compensation, keep under 80 words. For negative reviews: acknowledge, apologize for the experience, invite them to continue offline.`,
      messages: [{ role: 'user', content: `${review.rating}-star review${review.contact ? ` from ${review.contact.name}` : ''}: "${review.text ?? '(no text)'}"` }],
      maxTokens: 250,
    });
    const draft = text.trim();
    await this.prisma.db.review.update({ where: { id }, data: { responseDraft: draft, responseStatus: 'DRAFTED' } });
    return { available: true, draft, note: 'Draft only — approve it and post it on the platform yourself.' };
  }

  /** Human approves + records the response actually used (manual posting). */
  async respond(id: string, input: { responseText: string }) {
    if (!input.responseText?.trim()) throw new BadRequestException('responseText is required');
    await this.getReview(id);
    const review = await this.prisma.db.review.update({
      where: { id },
      data: {
        responseText: input.responseText.trim(),
        responseStatus: 'RESPONDED',
        respondedAt: new Date(),
        respondedById: tenantContext.get()?.userId ?? null,
      },
    });
    await this.bus.emit({
      name: DomainEvents.REVIEW_RESPONDED,
      tenantId: tenantContext.tenantId,
      payload: { review: { id, rating: review.rating } },
    });
    return review;
  }

  async dismiss(id: string) {
    await this.getReview(id);
    return this.prisma.db.review.update({ where: { id }, data: { responseStatus: 'DISMISSED' } });
  }

  /** Internal follow-up task for a review (e.g. call an unhappy customer). */
  async createFollowUp(id: string, input?: { title?: string; dueAt?: string }) {
    const review = await this.getReview(id);
    const activity = await this.prisma.db.activity.create({
      data: {
        type: 'TASK',
        status: 'OPEN',
        title: input?.title ?? `Follow up on ${review.rating}-star review${review.contact ? ` from ${review.contact.name}` : ''}`,
        body: review.text ? `Review: "${review.text.slice(0, 500)}"` : null,
        actor: 'STAFF',
        authorUserId: tenantContext.get()?.userId ?? null,
        contactId: review.contactId,
        dueAt: input?.dueAt ? new Date(input.dueAt) : null,
        metadata: { reviewId: id },
      } as any,
    });
    await this.prisma.db.review.update({ where: { id }, data: { followUpActivityId: activity.id } });
    return activity;
  }

  /** Real aggregates for the dashboard widget + analytics header. */
  async summary() {
    const monthAgo = new Date(Date.now() - 30 * 86_400_000);
    const [total, agg, needsResponse, negative, requests30d, byRating] = await Promise.all([
      this.prisma.db.review.count(),
      this.prisma.db.review.aggregate({ _avg: { rating: true } }),
      this.prisma.db.review.count({ where: { responseStatus: 'NEEDS_RESPONSE' } }),
      this.prisma.db.review.count({ where: { rating: { lte: 3 } } }),
      this.prisma.db.reviewRequest.count({ where: { sentAt: { gte: monthAgo } } }),
      this.prisma.db.review.groupBy({ by: ['rating'], _count: true }),
    ]);
    return {
      total,
      averageRating: total ? Math.round((agg._avg.rating ?? 0) * 10) / 10 : null,
      needsResponse,
      negative,
      requestsSent30d: requests30d,
      byRating: [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: byRating.find((b) => b.rating === r)?._count ?? 0 })),
    };
  }

  private async getReview(id: string) {
    const review = await this.prisma.db.review.findFirst({ where: { id }, include: { contact: { select: { id: true, name: true } } } });
    if (!review) throw new NotFoundException('Review not found');
    return review;
  }
}
