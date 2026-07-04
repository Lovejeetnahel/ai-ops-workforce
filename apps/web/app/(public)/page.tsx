import Link from 'next/link';

const CUSTOMERS = ['Northwind Field Co', 'Veridian Security', 'Bluepine HVAC', 'Halcyon Clean', 'Orchard PM', 'Summit Roofing'];

const STATS = [
  { v: '12', l: 'integrated modules' },
  { v: '8', l: 'AI employees in the box' },
  { v: '90 sec', l: 'missed call → booked job' },
  { v: '24/7', l: 'AI coverage, no overtime' },
];

const FEATURES = [
  { ico: '🤖', name: 'AI Workforce', desc: 'Installable AI employees for sales, dispatch, collections and customer success — each reporting measurable ROI on a leaderboard.' },
  { ico: '📇', name: 'CRM & Pipeline', desc: 'Industry-aware stages and lead scoring. Your vocabulary, not generic CRM-speak.' },
  { ico: '🚚', name: 'Smart Dispatch', desc: 'Skill, zone and urgency-aware assignment. Emergencies fast-track to the nearest on-call tech.' },
  { ico: '📱', name: 'Field Team App', desc: 'Clock-in, job tracking, routes and an AI copilot — the mobile surface techs actually use.' },
  { ico: '🏠', name: 'Customer Portal', desc: 'Customers see bookings, documents, invoices and conversations with a secure scoped login.' },
  { ico: '📄', name: 'Quotes & Invoices', desc: 'Generate, e-sign and get paid. Invoices carry pay links and reconcile automatically.' },
  { ico: '💳', name: 'Payments & Billing', desc: 'Stripe-backed payments with idempotent settlement and a value ledger that never drifts.' },
  { ico: '📊', name: 'Analytics & Briefing', desc: 'Live KPIs plus a daily AI executive briefing that tells you what to do next.' },
  { ico: '⚙️', name: 'Automation Workflows', desc: 'When-this-then-that rules seeded per industry: text-backs, reviews, re-engagement.' },
  { ico: '🧩', name: 'Marketplace', desc: 'Install AI employees, workflow packs, templates and integrations in one click.' },
  { ico: '🛡️', name: 'Compliance & Audit', desc: 'Audit logs, consent records, retention policies and GDPR/PIPEDA export.' },
  { ico: '🔌', name: 'Public API', desc: 'Scoped API keys with rate limiting over a clean /v1 REST surface.' },
];

const FLOW = [
  { b: 'Lead captured', s: 'call · chat · form' },
  { b: 'AI qualifies', s: 'scores & quotes' },
  { b: 'Smart dispatch', s: 'skill + zone match' },
  { b: 'Job completed', s: 'field app + copilot' },
  { b: 'Paid instantly', s: 'invoice + pay link' },
  { b: 'Executive brief', s: 'daily AI insights' },
];

const QUOTES = [
  { init: 'RN', name: 'Rachel N.', role: 'Owner, HVAC operator (14 techs)', text: 'The missed-call text-back alone paid for the platform in the first month. Now the AI books emergencies before I even see the call.' },
  { init: 'DM', name: 'Devon M.', role: 'Ops director, security firm', text: 'We replaced four disconnected tools with Sofilic. Dispatch, payroll hours, client portal — one login, one source of truth.' },
  { init: 'AS', name: 'Aisha S.', role: 'Founder, cleaning company', text: 'The executive briefing is the first thing I read every morning. It caught an overdue invoice pattern that saved us thousands.' },
];

const TRUST = [
  { ico: '🏰', t: 'Tenant isolation', d: 'Fail-closed row-level scoping on every query — data never crosses tenants.' },
  { ico: '🔑', t: 'Role-based access', d: 'Owner, Admin, Staff and Customer roles enforced on every route.' },
  { ico: '🗝️', t: 'Scoped API keys', d: 'Per-key scopes and rate limits on the public API.' },
  { ico: '📜', t: 'Audit logs', d: 'Every sensitive action recorded and reviewable.' },
  { ico: '🔒', t: 'Encrypted credentials', d: 'Integration secrets encrypted at rest with AES-256.' },
  { ico: '🌍', t: 'GDPR / PIPEDA', d: 'Data export and erasure workflows built in, not bolted on.' },
];

const ROADMAP = [
  { q: 'Now', items: ['Full AI workforce with ROI leaderboard', 'Smart dispatch & field app', 'Payments, portal & executive briefing'] },
  { q: 'Next', items: ['Native mobile apps (iOS / Android)', 'Deeper voice AI with live transfer', 'Custom AI employee builder'] },
  { q: 'Later', items: ['Multi-region data residency', 'Franchise & multi-brand management', 'Open workflow SDK'] },
];

const INTEGRATIONS = ['Stripe', 'Twilio', 'SendGrid', 'Google Calendar', 'Vapi Voice', 'QuickBooks', 'Zapier-style Webhooks', 'REST API'];

const FAQ = [
  { q: 'How fast can we go live?', a: 'Most teams are operational in days. Pick your industry module, invite staff, connect Stripe and Twilio — the AI workforce starts handling leads immediately.' },
  { q: 'Do we need technical staff?', a: 'No. Sofilic is fully managed. The public API and webhooks are there when you want them, but nothing requires code.' },
  { q: 'What happens to our existing data?', a: 'Leads, customers and job history import via CSV or the API. Your industry module maps them into the right pipeline stages.' },
  { q: 'Can the AI make mistakes?', a: 'Every AI employee runs with a configurable authority level — fully autonomous or approval-required. Every action is logged and auditable.' },
  { q: 'Is our data safe?', a: 'Tenant isolation is fail-closed at the query layer, credentials are AES-256 encrypted, access is role-gated, and every sensitive action hits the audit log.' },
  { q: 'What if we outgrow it?', a: 'Enterprise adds multi-company management, the full API surface, and priority support. The platform scales horizontally — you won’t hit a ceiling.' },
];

export default function Landing() {
  return (
    <main className="mk-main">
      {/* Hero */}
      <section className="hero">
        <div className="hero-badge">✦ Sofilic — now live</div>
        <h1>
          SOFILIC
        </h1>
        <p className="hero-tagline">
          The <span className="grad-text">AI Business Operating System</span>
        </p>
        <p className="hero-sub">
          Run your entire business with AI. Leads, dispatch, field teams, customer portal, invoices,
          payments, analytics, AI employees, workflows and marketplace apps — one operating system.
        </p>
        <div className="hero-ctas">
          <Link href="/signup" className="btn">Get Started</Link>
          <Link href="/demo" className="btn ghost">See it work</Link>
          <Link href="/features" className="btn ghost">Explore the platform</Link>
        </div>

        {/* Animated dashboard preview */}
        <div className="mockup">
          <div className="mockup-bar">
            <span style={{ background: '#f87171' }} />
            <span style={{ background: '#fbbf24' }} />
            <span style={{ background: '#34d399' }} />
            <span className="mockup-url">os.sofilic.com/dashboard</span>
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

        {/* Customer logos */}
        <div className="logo-row">
          {CUSTOMERS.map((c) => <span key={c}>{c}</span>)}
        </div>
      </section>

      {/* Stats */}
      <section className="mk-section" style={{ paddingTop: 20 }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {STATS.map((s) => (
            <div className="stat-block" key={s.l}>
              <div className="kpi">{s.v}</div>
              <div className="muted">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* AI workflow graphic */}
      <section className="mk-section" style={{ paddingTop: 30 }}>
        <div className="mk-section-head">
          <span className="mk-kicker">How Sofilic runs your day</span>
          <h2 className="mk-h2">From first ring to executive insight</h2>
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

      {/* Feature grid */}
      <section className="mk-section" id="features">
        <div className="mk-section-head">
          <span className="mk-kicker">The full operating system</span>
          <h2 className="mk-h2">Every module your operation needs</h2>
          <p className="muted">One login. One data model. Twelve integrated modules.</p>
        </div>
        <div className="grid">
          {FEATURES.map((f) => (
            <div className="panel lift feature-card" key={f.name}>
              <div className="feature-ico">{f.ico}</div>
              <h4>{f.name}</h4>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Customer success */}
      <section className="mk-section">
        <div className="mk-section-head">
          <span className="mk-kicker">Customer success</span>
          <h2 className="mk-h2">Operators run on Sofilic</h2>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {QUOTES.map((q) => (
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
          <span className="mk-kicker">Security & compliance</span>
          <h2 className="mk-h2">Enterprise-grade from day one</h2>
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
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 30px)', margin: '0 0 10px' }}>Built for multi-location operators</h2>
            <p className="muted" style={{ lineHeight: 1.7, margin: 0 }}>
              Multi-company management, the full public API, custom industry modules, advanced audit
              and compliance controls, dedicated success management and priority onboarding — with the
              same fail-closed tenant isolation underneath.
            </p>
          </div>
          <Link href="/pricing" className="btn">Talk enterprise</Link>
        </div>
      </section>

      {/* Roadmap */}
      <section className="mk-section">
        <div className="mk-section-head">
          <span className="mk-kicker">Roadmap</span>
          <h2 className="mk-h2">Where Sofilic is heading</h2>
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

      {/* Integrations */}
      <section className="mk-section" style={{ paddingTop: 10 }}>
        <div className="mk-section-head" style={{ marginBottom: 30 }}>
          <span className="mk-kicker">Integrations</span>
          <h2 className="mk-h2" style={{ fontSize: 'clamp(22px, 3vw, 30px)' }}>Plays well with your stack</h2>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
          {INTEGRATIONS.map((n) => (
            <div className="industry-pill" key={n} style={{ justifyContent: 'center' }}>{n}</div>
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
        <h2>Run your entire business with AI.</h2>
        <p className="muted" style={{ maxWidth: 520, margin: '0 auto 28px' }}>
          Pick your industry module, invite your team, and let Sofilic start earning its keep — in days, not months.
        </p>
        <div className="hero-ctas">
          <Link href="/signup" className="btn">Get Started</Link>
          <Link href="/demo" className="btn ghost">Watch it work</Link>
        </div>
      </section>
    </main>
  );
}
