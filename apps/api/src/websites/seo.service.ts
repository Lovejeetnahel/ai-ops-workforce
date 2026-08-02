import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProviderFactory } from '../integrations/provider-factory.service';
import { tenantContext } from '../common/tenancy/tenant-context';

export interface SeoFinding {
  pageId: string | null;
  pageTitle: string;
  check: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PASS' | 'FAIL' | 'WARN';
  detail: string;
}

/**
 * SEO V1 (Sprint 3): a deterministic audit computed from the tenant's REAL
 * site pages + company profile. External search data (impressions, rankings,
 * clicks) requires Search Console — honestly setup-required, never invented.
 */
@Injectable()
export class SeoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: ProviderFactory,
  ) {}

  async runAudit() {
    const [sites, profile] = await Promise.all([
      this.prisma.db.site.findMany({ include: { pages: true } }),
      this.prisma.db.companyProfile.findFirst(),
    ]);
    const findings: SeoFinding[] = [];
    const pages = sites.flatMap((s) => s.pages);

    for (const p of pages) {
      const seo: any = p.seo ?? {};
      const sections: any[] = (p.sections as any[]) ?? [];
      const title = String(seo.title ?? '');
      const desc = String(seo.description ?? '');
      const add = (check: string, ok: boolean, severity: SeoFinding['severity'], failDetail: string, passDetail = 'OK') =>
        findings.push({ pageId: p.id, pageTitle: p.title, check, severity, status: ok ? 'PASS' : 'FAIL', detail: ok ? passDetail : failDetail });

      add('seo-title', title.length >= 15 && title.length <= 65, 'HIGH', title ? `Title is ${title.length} chars (aim 15–65)` : 'Missing SEO title');
      add('meta-description', desc.length >= 50 && desc.length <= 165, 'HIGH', desc ? `Description is ${desc.length} chars (aim 50–165)` : 'Missing meta description');
      add('h1-heading', sections.some((s) => s.type === 'hero' && s.headline), 'HIGH', 'No hero headline (renders as the H1)');
      add('contact-path', sections.some((s) => s.type === 'contact'), 'MEDIUM', 'No contact/lead form section — visitors have no conversion path');
      add('indexability', !seo.noindex || p.status !== 'PUBLISHED', 'MEDIUM', 'Published page is set to noindex — it will not appear in search');
      add('published', p.status === 'PUBLISHED', 'LOW', 'Draft — not live or indexable yet');
      if (seo.canonical) add('canonical', /^https?:\/\//.test(String(seo.canonical)), 'LOW', 'Canonical is not an absolute URL');
      // Broken internal links: hrefs pointing at page slugs that don't exist.
      const hrefs = sections.flatMap((s) => [s.ctaHref, ...((s.items ?? []).map((i: any) => i.href) ?? [])]).filter((h) => typeof h === 'string' && h.startsWith('/'));
      const slugs = new Set(pages.map((x) => `/${x.slug}`));
      const broken = hrefs.filter((h) => !slugs.has(h) && h !== '/' && !h.startsWith('/#'));
      add('internal-links', broken.length === 0, 'MEDIUM', `Broken internal link(s): ${broken.join(', ')}`);
    }

    // Local SEO / business-information consistency (from the real profile).
    const local = (check: string, ok: boolean, detail: string) =>
      findings.push({ pageId: null, pageTitle: 'Business profile', check, severity: 'MEDIUM', status: ok ? 'PASS' : 'WARN', detail });
    local('business-name', !!(profile?.brandName || profile?.legalName), profile?.brandName || profile?.legalName ? 'Set' : 'Add your business name to the Company Profile');
    local('locations-on-file', Array.isArray(profile?.locations) && (profile?.locations as any[]).length > 0, (profile?.locations as any[])?.length ? 'Set' : 'Add your service area/address — local search needs a consistent NAP');
    local('tagline-positioning', !!profile?.tagline, profile?.tagline ? 'Set' : 'A one-line positioning statement improves titles and descriptions');

    const scored = findings.filter((f) => f.status !== 'WARN');
    const score = scored.length ? Math.round((scored.filter((f) => f.status === 'PASS').length / scored.length) * 100) : 0;

    const audit = await this.prisma.db.seoAudit.create({
      data: { siteId: sites[0]?.id ?? null, score, results: findings as any } as any,
    });
    return { auditId: audit.id, score, findings, pagesAudited: pages.length, external: { searchConsole: 'setup-required', note: 'Impressions, rankings and clicks require Search Console — not connected, so none are shown.' } };
  }

  history() {
    return this.prisma.db.seoAudit.findMany({ select: { id: true, score: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 30 });
  }

  async createTask(finding: { check: string; detail: string; pageTitle?: string }) {
    return this.prisma.db.activity.create({
      data: {
        type: 'TASK',
        status: 'OPEN',
        title: `SEO: fix ${finding.check}${finding.pageTitle ? ` on "${finding.pageTitle}"` : ''}`,
        body: finding.detail?.slice(0, 500) ?? null,
        actor: 'STAFF',
        authorUserId: tenantContext.get()?.userId ?? null,
        metadata: { seo: true, check: finding.check },
      } as any,
    });
  }

  /** AI recommendations grounded in the real audit — honest when AI is off. */
  async aiRecommendations() {
    const llm = this.providers.llm();
    if (llm.provider === 'stub') return { available: false, reason: 'AI recommendations require the platform AI to be configured.', recommendations: [] };
    const latest = await this.prisma.db.seoAudit.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!latest) return { available: true, recommendations: [], note: 'Run an audit first.' };
    const fails = ((latest.results as any[]) ?? []).filter((f) => f.status !== 'PASS').slice(0, 15);
    const { text } = await llm.complete({
      system: 'You are a local-SEO specialist. Given real audit findings, return a prioritized plain-text list (max 6 items) of concrete fixes. Never invent traffic numbers, rankings or competitor claims. Include one structured-data (LocalBusiness JSON-LD) recommendation if relevant.',
      messages: [{ role: 'user', content: JSON.stringify(fails) }],
      maxTokens: 500,
    });
    return { available: true, recommendations: text.trim().split('\n').filter(Boolean).slice(0, 8) };
  }
}
