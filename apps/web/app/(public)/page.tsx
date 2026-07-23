import Link from 'next/link';
import type { Metadata } from 'next';
import { listPresets } from '@aiow/config';
import { AI_WORKFORCE_FACTS } from '../../lib/product-status';
import { StatusBadge } from '../../components/StatusBadge';

export const metadata: Metadata = {
  title: 'Sofilic — The AI Business Operating System for Local Businesses',
  description:
    'One login for CRM, dispatch, payments, automation and an AI workforce built for local service businesses. See what’s live today, what’s in beta, and what’s coming next.',
  alternates: { canonical: 'https://sofilic.com' },
};

const FEATURES = [
  { ico: '📇', name: 'CRM & Pipeline', desc: 'Industry-aware stages and lead scoring, wired to your real leads and contacts.', status: 'live' as const },
  { ico: '💼', name: 'Sales & Follow-ups', desc: 'A live pipeline board so a lead never sits without a next step.', status: 'live' as const },
  { ico: '⚙️', name: 'Automation', desc: 'When-this-then-that recipes and a visual workflow builder, with a full run history.', status: 'live' as const },
  { ico: '💳', name: 'Payments & Invoicing', desc: 'Stripe-backed invoices, estimates and subscriptions with idempotent settlement.', status: 'live' as const },
  { ico: '📱', name: 'Field Operations', desc: 'Job tracking, dispatch and a mobile-first surface for techs in the field.', status: 'live' as const },
  { ico: '🧩', name: 'Apps & Marketplace', desc: 'Install optional capabilities — Field Operations, Inventory, Fleet, HR — as you need them.', status: 'live' as const },
  { ico: '🎙️', name: 'Voice AI', desc: 'Configure your AI voice agent and roster of AI employees. Automated call answering is in beta rollout.', status: 'beta' as const },
  { ico: '💬', name: 'Conversations', desc: 'A unified inbox for voice, SMS, chat and email threads.', status: 'coming-soon' as const },
  { ico: '📣', name: 'Marketing & Reviews', desc: 'Campaigns, reputation management and automated review requests.', status: 'coming-soon' as const },
  { ico: '📊', name: 'Analytics & Dashboard', desc: 'Live KPIs, a revenue trend and an activity feed computed from your own data — no fabricated numbers.', status: 'live' as const },
  { ico: '🌐', name: 'Websites & SEO', desc: 'Landing pages, forms and a booking presence on your own domain.', status: 'coming-soon' as const },
  { ico: '🔌', name: 'Public API', desc: 'Scoped API keys with per-key rate limiting over a clean /v1 REST surface.', status: 'live' as const },
];

const FLOW = [
  { b: 'Lead captured', s: 'call · chat · form' },
  { b: 'Tracked in CRM', s: 'scored & organized' },
  { b: 'Job dispatched', s: 'field team notified' },
  { b: 'Job completed', s: 'field app updates status' },
  { b: 'Invoice sent', s: 'Stripe pay link' },
  { b: 'You see it all', s: 'live dashboard' },
];

const EXAMPLES = [
  { init: 'HV', name: 'Sample HVAC business', role: 'Example scenario — 12 technicians', text: 'Missed calls automatically become a CRM lead and a follow-up task, instead of a voicemail nobody checks until tomorrow.' },
  { init: 'CL', name: 'Sample cleaning company', role: 'Example scenario — recurring routes', text: 'Recipes in Automation move a completed job straight to an invoice, so the office isn’t re-typing the same job twice.' },
  { init: 'RE', name: 'Sample property manager', role: 'Example scenario — multi-unit portfolio', text: 'One pipeline for maintenance requests across every property, instead of a shared inbox and a spreadsheet.' },
];

const TRUST = [
  { ico: '🏰', t: 'Tenant data isolation', d: 'Every database query is scoped to your business by a fail-closed guard we’ve tested directly — an unscoped query throws instead of ever returning another account’s data.' },
  { ico: '🔑', t: 'Role-based access', d: 'Owner, Admin, Staff and Customer roles enforced on every route.' },
  { ico: '🗝️', t: 'Scoped API keys', d: 'Per-key scopes and rate limits on the public API.' },
  { ico: '📜', t: 'Audit logs', d: 'Sensitive actions are recorded and reviewable.' },
  { ico: '🔒', t: 'Encrypted credentials', d: 'Integration secrets are encrypted at rest with AES-256.' },
  { ico: '📄', t: 'Data export & deletion', d: 'Built-in tooling to export or erase your data on request.' },
];

const ROADMAP = [
  { q: 'Live now', items: ['CRM, Sales pipeline & Automation', 'Payments, invoicing & Field Operations', 'Real-time dashboard analytics'] },
  { q: 'Beta', items: ['Voice AI agent configuration & AI employee roster', 'Automated call answering'] },
  { q: 'Coming next', items: ['Unified Conversations inbox', 'Marketing Studio & Reviews', 'Websites, SEO & Social Media'] },
];

const FAQ = [
  { q: 'How fast can we go live?', a: 'Signup provisions your workspace immediately. Pick your industry, invite staff, and connect Stripe/Twilio when you’re ready — no waiting period.' },
  { q: 'Do we need technical staff?', a: 'No. Sofilic is fully managed. The public API and webhooks are there if you want them, but nothing requires code.' },
  { q: 'What happens to our existing data?', a: 'Leads and customer records can be added directly or via the API. Your industry selection maps them into the right pipeline stages.' },
  { q: 'Can the AI make mistakes?', a: 'Each AI employee can be set to fully autonomous or approval-required. Every action is logged.' },
  { q: 'Is our data safe?', a: 'Data isolation is enforced at the query layer, credentials are AES-256 encrypted, and access is role-gated. See our Security page for details.' },
  { q: 'What if a module says "Coming soon"?', a: 'It means the page exists but isn’t wired to a live backend yet. We label this honestly rather than shipping a page that looks done before it is.' },
];

export default function Landing() {
  const industryCount = listPresets().length;
  return (
    <main className="mk-main">
      {/* Hero */}
      <section className="hero">
        <div className="hero-badge">✦ Sofilic — now live</div>
        <h1>SOFILIC</h1>
        <p className="hero-tagline">
          The <span className="grad-text">AI Business Operating System</span>
        </p>
        <p className="hero-sub">
          One login for CRM, sales, automation, payments and field operations — built for local
          service businesses, with an AI workforce that’s rolling out feature by feature, not oversold
          all at once.
        </p>
        <div className="hero-ctas">
          <Link href="/signup" className="btn">Get Started</Link>
          <Link href="/demo" className="btn ghost">See an example workflow</Link>
          <Link href="/features" className="btn ghost">Explore the platform</Link>
        </div>

        {/* Illustrative dashboard preview — not a real account */}
        <div style={{ textAlign: 'center' }}>
          <span className="sample-flag" style={{ margin: '0 auto' }}>◔ Example data — not a real customer account</span>
        </div>
        <div className="mockup">
          <div className="mockup-bar">
            <span style={{ background: '#f87171' }} />
            <span style={{ background: '#fbbf24' }} />
            <span style={{ background: '#34d399' }} />
            <span className="mockup-url">sofilic.com/dashboard</span>
          </div>
          <div className="mockup-body">
            <div className="mockup-side">
              <i className="hot" style={{ width: '85%' }} />
              <i style={{ width: '70%' }} /><i style={{ width: '78%' }} /><i style={{ width: '62%' }} />
              <i style={{ width: '74%' }} /><i style={{ width: '66%' }} /><i style={{ width: '80%' }} />
              <i style={{ width: '58%' }} /><i style={{ width: '72%' }} />
            </div>
            <div className="mockup-content">
              <div className="mockup-kpis">
                <div className="mockup-kpi"><span>Revenue today</span><b>$4,820</b></div>
                <div className="mockup-kpi"><span>New leads</span><b>12</b></div>
                <div className="mockup-kpi"><span>Jobs booked</span><b>8</b></div>
                <div className="mockup-kpi"><span>AI actions</span><b>27</b></div>
              </div>
              <div className="mockup-chart">
                {[38, 52, 44, 65, 58, 74, 62, 85, 70, 92, 80, 100].map((h, i) => (
                  <i key={i} style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats — every number here is verifiable, not marketing filler */}
      <section className="mk-section" style={{ paddingTop: 20 }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="stat-block"><div className="kpi">{industryCount}</div><div className="muted">industries ready at signup</div></div>
          <div className="stat-block"><div className="kpi">{AI_WORKFORCE_FACTS.employeeRoles}</div><div className="muted">AI employee roles you can configure</div></div>
          <div className="stat-block"><div className="kpi">{FEATURES.length}</div><div className="muted">modules across the platform</div></div>
          <div className="stat-block"><div className="kpi">24/7</div><div className="muted">the platform doesn’t clock out</div></div>
        </div>
      </section>

      {/* Workflow graphic */}
      <section className="mk-section" style={{ paddingTop: 30 }}>
        <div className="mk-section-head">
          <span className="mk-kicker">How Sofilic fits your day</span>
          <h2 className="mk-h2">From first contact to paid invoice</h2>
        </div>
        <div className="flow">
          {FLOW.map((f, i) => (
            <span key={f.b} style={{ display: 'contents' }}>
              <div className="flow-node">
                <b>{f.b}</b>
                <span>{f.s}</span>
              </div>
              {i < FLOW.length - 1 && <span className="flow-arrow">→</span>}
            </span>
          ))}
        </div>
      </section>

      {/* Feature grid — status-labeled */}
      <section className="mk-section" id="features">
        <div className="mk-section-head">
          <span className="mk-kicker">The platform, honestly labeled</span>
          <h2 className="mk-h2">What’s live, what’s beta, what’s next</h2>
          <p className="muted">One login, one data model — and a clear label on every module.</p>
        </div>
        <div className="grid">
          {FEATURES.map((f) => (
            <div className="panel lift feature-card" key={f.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="feature-ico">{f.ico}</div>
                <StatusBadge status={f.status} />
              </div>
              <h4>{f.name}</h4>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Example scenarios — explicitly fictional, not customer testimonials */}
      <section className="mk-section">
        <div className="mk-section-head">
          <span className="mk-kicker">Example scenarios</span>
          <h2 className="mk-h2">How businesses like yours would use it</h2>
          <p className="muted">These are illustrative scenarios, not real customer testimonials.</p>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {EXAMPLES.map((q) => (
            <div className="panel lift quote-card" key={q.name}>
              <blockquote>“{q.text}”</blockquote>
              <div className="who">
                <span className="quote-avatar">{q.init}</span>
                <span>
                  <strong style={{ fontSize: 13.5 }}>{q.name}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>{q.role}</div>
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Security & compliance */}
      <section className="mk-section">
        <div className="mk-section-head">
          <span className="mk-kicker">Security</span>
          <h2 className="mk-h2">Built with tenant isolation from day one</h2>
          <p className="muted">See the full detail on our <Link href="/security" style={{ color: 'var(--cyan)' }}>Security page</Link>.</p>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {TRUST.map((t) => (
            <div className="panel trust-item" key={t.t}>
              <span className="t-ico">{t.ico}</span>
              <div><h4>{t.t}</h4><p>{t.d}</p></div>
            </div>
          ))}
        </div>
      </section>

      {/* Enterprise */}
      <section className="mk-section" style={{ paddingTop: 20 }}>
        <div className="panel glow" style={{ padding: '44px 40px', display: 'flex', gap: 30, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ maxWidth: 560 }}>
            <span className="mk-kicker">Sofilic Enterprise</span>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 30px)', margin: '0 0 10px' }}>Multi-location operators</h2>
            <p className="muted" style={{ lineHeight: 1.7, margin: 0 }}>
              Custom pricing and onboarding for multi-location groups. Talk to us about your team size,
              locations and requirements.
            </p>
          </div>
          <Link href="/contact" className="btn">Talk to Enterprise</Link>
        </div>
      </section>

      {/* Roadmap */}
      <section className="mk-section">
        <div className="mk-section-head">
          <span className="mk-kicker">Roadmap</span>
          <h2 className="mk-h2">Where Sofilic is today</h2>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {ROADMAP.map((r) => (
            <div className="panel" key={r.q}>
              <div className="roadmap-q">{r.q}</div>
              {r.items.map((it) => (
                <div key={it} className="agent-row"><span style={{ color: 'var(--indigo)' }}>◆</span><span>{it}</span></div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mk-section">
        <div className="mk-section-head">
          <span className="mk-kicker">FAQ</span>
          <h2 className="mk-h2" style={{ fontSize: 'clamp(22px, 3vw, 30px)' }}>Questions, answered</h2>
        </div>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FAQ.map((f) => (
            <details className="panel faq-item" key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="final-cta">
        <h2>Run your business with a system that tells you the truth.</h2>
        <p className="muted" style={{ maxWidth: 520, margin: '0 auto 28px' }}>
          Pick your industry, invite your team, and see exactly what’s live today.
        </p>
        <div className="hero-ctas">
          <Link href="/signup" className="btn">Get Started</Link>
          <Link href="/demo" className="btn ghost">See an example workflow</Link>
        </div>
      </section>
    </main>
  );
}
