import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProviderFactory } from '../integrations/provider-factory.service';
import { EventBus } from '../automation/event-bus';
import { DomainEvents } from '../automation/events';
import { tenantContext } from '../common/tenancy/tenant-context';
import { randomBytes } from 'node:crypto';

export const SECTION_TYPES = ['hero', 'services', 'testimonials', 'faq', 'contact', 'cta'] as const;

/**
 * Websites V1 (Sprint 3). Real pages made of typed sections, with drafts,
 * revisions, publish state and a live public render path (/s/<site>/<page>).
 *
 * HONESTY: custom domains stay 'not_connected' (no DNS verification exists
 * yet — labeled setup-required); the testimonials section starts EMPTY and is
 * only ever filled by the business from their real recorded reviews; AI
 * content generation grounds in the company profile and never invents
 * customer names, results or credentials.
 */
@Injectable()
export class WebsitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderFactory,
    private readonly bus: EventBus,
  ) {}

  // ── Sites ──────────────────────────────────────────────────────────────
  listSites() {
    return this.prisma.db.site.findMany({ include: { pages: { select: { id: true, title: true, slug: true, status: true, updatedAt: true } } }, orderBy: { createdAt: 'asc' } });
  }

  async createSite(name: string) {
    if (!name?.trim()) throw new BadRequestException('name is required');
    const slug = `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'site'}-${randomBytes(2).toString('hex')}`;
    return this.prisma.db.site.create({ data: { name: name.trim(), slug } as any });
  }

  // ── Pages ──────────────────────────────────────────────────────────────
  async getPage(id: string) {
    const page = await this.prisma.db.sitePage.findFirst({
      where: { id },
      include: { site: { select: { id: true, name: true, slug: true, domainStatus: true } }, revisions: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, createdAt: true, savedById: true } } },
    });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async createPage(input: { siteId: string; title: string; slug?: string; sections?: any[]; fromTemplate?: string }) {
    const site = await this.prisma.db.site.findFirst({ where: { id: input.siteId }, select: { id: true, tenantId: true } });
    if (!site) throw new NotFoundException('Site not found');
    if (!input.title?.trim()) throw new BadRequestException('title is required');
    const slug = (input.slug ?? input.title).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'page';
    const sections = input.sections?.length ? this.validateSections(input.sections) : input.fromTemplate ? await this.template(input.fromTemplate) : [];
    return this.prisma.db.sitePage.create({
      data: { siteId: input.siteId, title: input.title.trim(), slug, sections: sections as any, seo: { title: input.title.trim(), description: '' } } as any,
    });
  }

  /** Every save snapshots a revision (immutable history + audit trail). */
  async updatePage(id: string, input: Partial<{ title: string; sections: any[]; seo: any }>) {
    const page = await this.getPage(id);
    await this.prisma.db.sitePageRevision.create({
      data: { pageId: id, sections: page.sections as any, seo: page.seo as any, savedById: tenantContext.get()?.userId ?? null } as any,
    });
    const data: any = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.sections !== undefined) data.sections = this.validateSections(input.sections) as any;
    if (input.seo !== undefined) data.seo = { ...(page.seo as any), ...input.seo };
    data.updatedById = tenantContext.get()?.userId ?? null;
    return this.prisma.db.sitePage.update({ where: { id }, data });
  }

  async restoreRevision(pageId: string, revisionId: string) {
    await this.getPage(pageId);
    const rev = await this.prisma.db.sitePageRevision.findFirst({ where: { id: revisionId, pageId } });
    if (!rev) throw new NotFoundException('Revision not found');
    return this.updatePage(pageId, { sections: rev.sections as any[], seo: rev.seo });
  }

  async setPublished(id: string, published: boolean) {
    const page = await this.getPage(id);
    if (published && !(page.sections as any[])?.length) throw new BadRequestException('Add at least one section before publishing');
    return this.prisma.db.sitePage.update({
      where: { id },
      data: { status: published ? 'PUBLISHED' : 'DRAFT', publishedAt: published ? new Date() : null },
    });
  }

  /** Preset-recommended starter templates. Copy is generic — never fabricated specifics. */
  private async template(key: string): Promise<any[]> {
    const profile = await this.prisma.db.companyProfile.findFirst({ select: { tenantId: true, brandName: true, legalName: true, tagline: true } });
    const name = profile?.brandName ?? profile?.legalName ?? 'Your Business';
    const base = [
      { type: 'hero', headline: name, subheadline: profile?.tagline ?? 'Tell visitors what you do in one sentence.', ctaLabel: 'Get a quote', ctaHref: '#contact' },
      { type: 'services', title: 'What we do', items: [] },
      { type: 'testimonials', title: 'What customers say', items: [], note: 'Add quotes from your real recorded reviews — never invented.' },
      { type: 'faq', title: 'Common questions', items: [] },
      { type: 'contact', title: 'Get in touch', fields: ['name', 'phone', 'email', 'message'] },
      { type: 'cta', headline: 'Ready to get started?', ctaLabel: 'Book now', ctaHref: '#contact' },
    ];
    if (key === 'landing') return [base[0], base[1], base[4]];
    return base;
  }

  private validateSections(sections: any[]) {
    if (!Array.isArray(sections) || sections.length > 30) throw new BadRequestException('sections must be an array (max 30)');
    for (const s of sections) if (!SECTION_TYPES.includes(s?.type)) throw new BadRequestException(`Unknown section type: ${s?.type}. Valid: ${SECTION_TYPES.join(', ')}`);
    return sections;
  }

  /** AI section copy grounded in the company profile — draft only, honest. */
  async aiDraftSection(input: { type: string; notes?: string }) {
    const llm = this.providers.llm();
    if (llm.provider === 'stub') return { available: false, reason: 'AI drafting requires the platform AI to be configured.', draft: null };
    if (!SECTION_TYPES.includes(input.type as any)) throw new BadRequestException('Unknown section type');
    const profile = await this.prisma.db.companyProfile.findFirst({
      select: { tenantId: true, brandName: true, legalName: true, tagline: true, brandVoice: true, targetMarket: true, mission: true },
    });
    const name = profile?.brandName ?? profile?.legalName ?? 'the business';
    const { text } = await llm.complete({
      system: `You write ONE ${input.type} website section as JSON for ${name}${profile?.tagline ? ` — ${profile.tagline}` : ''}.${profile?.brandVoice ? ` Voice: ${profile.brandVoice}.` : ''}${profile?.targetMarket ? ` Audience: ${profile.targetMarket}.` : ''} ABSOLUTE RULES: never invent customer names, testimonials, statistics, years in business, certifications or guarantees not provided. For 'testimonials' return an empty items array with a note that real reviews must be added by the owner. Return ONLY the JSON object for the section, shaped like {type:"${input.type}", ...}.`,
      messages: [{ role: 'user', content: input.notes ?? `Draft the ${input.type} section.` }],
      maxTokens: 600,
    });
    try {
      const parsed = JSON.parse(text.trim().replace(/^```json?\n?|```$/g, ''));
      parsed.type = input.type;
      return { available: true, draft: parsed, note: 'Draft only — review before saving.' };
    } catch {
      return { available: true, draft: { type: input.type, raw: text.trim() }, note: 'Model returned non-JSON — edit manually.' };
    }
  }

  // ── Public render + forms (no auth; tenant from site slug) ─────────────
  async publicPage(siteSlug: string, pageSlug: string) {
    const site = await this.prisma.site.findUnique({ where: { slug: siteSlug }, select: { id: true, tenantId: true, name: true, theme: true } });
    if (!site) throw new NotFoundException('Site not found');
    const page = await this.prisma.sitePage.findFirst({
      where: { siteId: site.id, slug: pageSlug, status: 'PUBLISHED' },
      select: { id: true, title: true, sections: true, seo: true, publishedAt: true },
    });
    if (!page) throw new NotFoundException('Page not found or not published');
    return { business: site.name, theme: site.theme, page };
  }

  /** Real form submission → FormSubmission + CRM Lead with attribution. */
  async publicSubmit(siteSlug: string, pageSlug: string, body: { name?: string; phone?: string; email?: string; message?: string; source?: string }) {
    const site = await this.prisma.site.findUnique({ where: { slug: siteSlug }, select: { id: true, tenantId: true } });
    if (!site) throw new NotFoundException('Site not found');
    const page = await this.prisma.sitePage.findFirst({ where: { siteId: site.id, slug: pageSlug, status: 'PUBLISHED' }, select: { id: true } });
    if (!page) throw new NotFoundException('Page not found');
    if (!body.name?.trim() || (!body.phone && !body.email)) throw new BadRequestException('Name and a phone number or email are required');

    return tenantContext.run({ tenantId: site.tenantId }, async () => {
      const contact = await this.prisma.db.contact.create({
        data: { name: body.name!.trim().slice(0, 200), phone: body.phone?.slice(0, 40) ?? null, email: body.email?.slice(0, 200) ?? null } as any,
      });
      const lead = await this.prisma.db.lead.create({
        data: { contactId: contact.id, entityType: 'lead', source: body.source?.slice(0, 100) ?? 'website_form', intake: { message: body.message?.slice(0, 2000) ?? null, pageId: page.id } } as any,
      });
      await this.prisma.db.formSubmission.create({
        data: { pageId: page.id, data: { name: contact.name, message: body.message?.slice(0, 2000) ?? null }, leadId: lead.id, source: body.source ?? null } as any,
      });
      await this.bus.emit({
        name: DomainEvents.LEAD_CREATED,
        tenantId: site.tenantId,
        payload: { lead: { id: lead.id, urgency: 'NORMAL', serviceType: null }, contact, source: 'website_form' },
      });
      return { ok: true };
    });
  }

  listSubmissions() {
    return this.prisma.db.formSubmission.findMany({ include: { page: { select: { id: true, title: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
  }
}
