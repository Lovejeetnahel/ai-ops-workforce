import Link from 'next/link';

const FEATURES = [
  { ico: '🤖', name: 'AI Workforce', desc: 'Installable AI employees for sales, dispatch, collections, customer success and more — each with a measurable ROI.' },
  { ico: '📇', name: 'CRM & Pipeline', desc: 'Industry-aware pipeline stages, lead scoring and one-click stage moves. Your vocabulary, not generic CRM-speak.' },
  { ico: '🚚', name: 'Smart Dispatch', desc: 'Skill, zone and urgency-aware assignment. Emergencies fast-track to the nearest on-call tech automatically.' },
  { ico: '📱', name: 'Field Team App', desc: 'Clock-in, job start/stop, travel tracking, route view and AI copilot — the mobile surface techs actually use.' },
  { ico: '🏠', name: 'Customer Portal', desc: 'Customers see their bookings, documents, invoices and conversation history with a secure scoped login.' },
  { ico: '📄', name: 'Quotes & Invoices', desc: 'Generate, send and e-sign quotes; invoices carry pay links and reconcile automatically when paid.' },
  { ico: '💳', name: 'Payments & Billing', desc: 'Stripe-backed payments with idempotent settlement, a value ledger, and per-plan subscription billing.' },
  { ico: '📊', name: 'Analytics & Executive Briefing', desc: 'Live KPIs from the value ledger plus a daily AI briefing that tells you what to do next.' },
  { ico: '⚙️', name: 'Automation Workflows', desc: 'When-this-then-that rules seeded per industry: missed-call text-back, review requests, re-engagement.' },
  { ico: '🧩', name: 'Marketplace', desc: 'Install AI employees, workflow packs, industry templates and integrations in one click.' },
  { ico: '🛡️', name: 'Compliance & Audit', desc: 'Full audit logs, consent records, retention policies and GDPR/PIPEDA data export and erasure.' },
  { ico: '🔌', name: 'Public API', desc: 'Scoped API keys with rate limiting over a clean /v1 REST surface for leads, jobs, invoices and account.' },
];

const INDUSTRIES = [
  ['🛡️', 'Security'], ['🧹', 'Cleaning'], ['❄️', 'HVAC'], ['🏠', 'Roofing'],
  ['🏢', 'Property Management'], ['🔍', 'Inspection'], ['🌿', 'Landscaping'],
  ['🔧', 'Appliance Repair'], ['🚐', 'Field Services'], ['🏡', 'Home Services'],
];

const STEPS = [
  { t: 'Capture lead', d: 'Calls, web chat, forms and referrals flow into one pipeline — nothing slips.' },
  { t: 'AI qualifies', d: 'The Sales AI scores, qualifies and quotes in minutes, not days.' },
  { t: 'Dispatch job', d: 'Smart dispatch matches skills, zones and urgency to the right person.' },
  { t: 'Field team completes', d: 'Techs run the job from the field app with AI copilot support.' },
  { t: 'Invoice & payment', d: 'Invoices go out with pay links; settlement reconciles automatically.' },
  { t: 'Executive insights', d: 'The Executive AI briefs you daily on revenue, risks and next moves.' },
];

const TRUST = [
  { ico: '🏰', t: 'Tenant isolation', d: 'Fail-closed row-level scoping on every query — your data never crosses tenants.' },
  { ico: '🔑', t: 'Role-based access', d: 'Owner, Admin, Staff and Customer roles enforced on every route.' },
  { ico: '🗝️', t: 'Scoped API keys', d: 'Per-key scopes and rate limits on the public API.' },
  { ico: '📜', t: 'Audit logs', d: 'Every sensitive action is recorded and reviewable.' },
  { ico: '🔒', t: 'Encrypted credentials', d: 'Integration secrets encrypted at rest with AES-256.' },
  { ico: '🌍', t: 'GDPR / PIPEDA export', d: 'Data export and erasure workflows built in, not bolted on.' },
];

export default function Landing() {
  return (
    <main className="mk-main">
      {/* Hero */}
      <section className="hero">
        <div className="hero-badge">✦ Now live — the complete AI Business OS</div>
        <h1>
          AI Operations <span className="grad-text">Workforce</span>
        </h1>
        <p className="hero-tagline">The AI Business OS for service industries</p>
        <p className="hero-sub">
          Automate leads, dispatch, field teams, customer portal, invoices, payments, analytics,
          AI employees, workflows, and marketplace apps from one operating system.
        </p>
        <div className="hero-ctas">
          <Link href="/signup" className="btn">Start Free Demo</Link>
          <Link href="/login" className="btn ghost">Login</Link>
          <Link href="/features" className="btn ghost">See Platform</Link>
        </div>

        {/* Dashboard mockup */}
        <div className="mockup">
          <div className="mockup-bar">
            <span style={{ background: '#f87171' }} />
            <span style={{ background: '#fbbf24' }} />
            <span style={{ background: '#34d399' }} />
          </div>
          <div className="mockup-body">
            <div className="mockup-side">
              <i className="hot" style={{ width: '85%' }} />
              <i style={{ width: '70%' }} /><i style={{ width: '78%' }} /><i style={{ width: '62%' }} />
              <i style={{ width: '74%' }} /><i style={{ width: '66%' }} /><i style={{ width: '80%' }} />
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

      {/* Feature grid */}
      <section className="mk-section" id="features">
        <div className="mk-section-head">
          <span className="mk-kicker">The full operating system</span>
          <h2 className="mk-h2">Every module your operation needs</h2>
          <p className="muted">One login. One data model. Twelve integrated modules.</p>
        </div>
        <div className="grid">
          {FEATURES.map((f) => (
            <div className="panel feature-card" key={f.name}>
              <div className="feature-ico">{f.ico}</div>
              <h4>{f.name}</h4>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Industries */}
      <section className="mk-section" id="industries">
        <div className="mk-section-head">
          <span className="mk-kicker">Built for your vertical</span>
          <h2 className="mk-h2">Industry modules, not generic software</h2>
          <p className="muted">Pipeline stages, vocabulary, templates and automations adapt to how your industry actually works.</p>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {INDUSTRIES.map(([ico, name]) => (
            <div className="industry-pill" key={name}><span>{ico}</span> {name}</div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mk-section">
        <div className="mk-section-head">
          <span className="mk-kicker">How it works</span>
          <h2 className="mk-h2">From first call to executive insight</h2>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {STEPS.map((s, i) => (
            <div className="panel step" key={s.t}>
              <div className="step-num">{i + 1}</div>
              <h4>{s.t}</h4>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing preview */}
      <section className="mk-section">
        <div className="mk-section-head">
          <span className="mk-kicker">Pricing</span>
          <h2 className="mk-h2">Start small, scale to enterprise</h2>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', maxWidth: 960, margin: '0 auto' }}>
          <div className="panel plan">
            <h3 style={{ margin: 0 }}>Starter</h3>
            <div className="price">$99<span className="muted" style={{ fontSize: 14 }}>/mo</span></div>
            <ul>
              <li>3 seats</li><li>CRM & scheduling</li><li>Invoicing & payments</li><li>1 AI employee</li>
            </ul>
            <Link href="/pricing" className="btn ghost">See details</Link>
          </div>
          <div className="panel plan popular">
            <span className="pop-badge">Most popular</span>
            <h3 style={{ margin: 0 }}>Pro</h3>
            <div className="price">$299<span className="muted" style={{ fontSize: 14 }}>/mo</span></div>
            <ul>
              <li>15 seats</li><li>Everything in Starter</li><li>Full AI workforce</li><li>Analytics & workflows</li>
            </ul>
            <Link href="/pricing" className="btn">See details</Link>
          </div>
          <div className="panel plan">
            <h3 style={{ margin: 0 }}>Enterprise</h3>
            <div className="price">$999<span className="muted" style={{ fontSize: 14 }}>/mo</span></div>
            <ul>
              <li>100 seats</li><li>Everything in Pro</li><li>Multi-company & API</li><li>Priority support</li>
            </ul>
            <Link href="/pricing" className="btn ghost">See details</Link>
          </div>
        </div>
      </section>

      {/* Security / trust */}
      <section className="mk-section">
        <div className="mk-section-head">
          <span className="mk-kicker">Security & trust</span>
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

      {/* Final CTA */}
      <section className="final-cta">
        <h2>Launch your AI operations system in days, not months.</h2>
        <p className="muted" style={{ maxWidth: 520, margin: '0 auto 26px' }}>
          Pick your industry module, invite your team, and let your AI workforce start earning its keep.
        </p>
        <div className="hero-ctas">
          <Link href="/signup" className="btn">Start Free Demo</Link>
          <Link href="/demo" className="btn ghost">Watch it work</Link>
        </div>
      </section>
    </main>
  );
}
