import Link from 'next/link';

const PLANS = [
  {
    name: 'Starter', price: 99, seats: '3 seats', popular: false,
    blurb: 'For solo operators and small crews getting off spreadsheets.',
    features: ['CRM & pipeline', 'Scheduling & calendar', 'Quotes & invoicing', 'Payments (Stripe)', '1 AI employee', 'Customer portal', 'Email support'],
  },
  {
    name: 'Pro', price: 299, seats: '15 seats', popular: true,
    blurb: 'For growing operations that want the full AI workforce.',
    features: ['Everything in Starter', 'Full AI workforce (8 employees)', 'Smart dispatch', 'Field team app + copilot', 'Analytics & executive briefing', 'Automation workflows', 'Marketplace apps', 'Priority support'],
  },
  {
    name: 'Enterprise', price: 999, seats: '100 seats', popular: false,
    blurb: 'For multi-crew and multi-location operators with compliance needs.',
    features: ['Everything in Pro', 'Multi-company management', 'Public API + webhooks', 'Advanced compliance & audit', 'Custom industry module', 'Dedicated success manager', 'SLA & priority onboarding'],
  },
];

const FAQ = [
  { q: 'Is there a free trial?', a: 'Yes — Get Started provisions a full workspace with your industry module. No credit card required to explore.' },
  { q: 'What counts as a seat?', a: 'Any staff login: owners, admins, dispatchers and field techs. Customers using the portal are free and unlimited.' },
  { q: 'Can I change plans later?', a: 'Upgrade or downgrade any time from Billing; changes prorate automatically.' },
  { q: 'What are AI employees?', a: 'Installable agents (Sales AI, Collections AI, Receptionist, Executive AI…) that do real work and report their ROI on a leaderboard.' },
  { q: 'How do payments work?', a: 'Payments run on Stripe. Invoices carry pay links, and settlements reconcile idempotently — no double-booked revenue.' },
  { q: 'Is my data isolated?', a: 'Yes. Every query is tenant-scoped with a fail-closed guard; cross-tenant access is structurally impossible.' },
];

export default function PricingPage() {
  return (
    <main className="mk-main">
      <section className="hero" style={{ padding: '64px 0 20px' }}>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 48px)' }}>
          Simple pricing, <span className="grad-text">serious leverage</span>
        </h1>
        <p className="hero-sub">Every plan includes the core OS. Higher tiers unlock the AI workforce, analytics and the platform surface.</p>
      </section>

      <section className="mk-section" style={{ paddingTop: 24 }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', maxWidth: 1020, margin: '0 auto' }}>
          {PLANS.map((p) => (
            <div className={`panel plan ${p.popular ? 'popular' : ''}`} key={p.name}>
              {p.popular && <span className="pop-badge">Most popular</span>}
              <h3 style={{ margin: 0 }}>{p.name}</h3>
              <div className="price">${p.price}<span className="muted" style={{ fontSize: 14 }}>/mo</span></div>
              <div className="muted" style={{ marginBottom: 4 }}>{p.seats}</div>
              <p className="muted" style={{ fontSize: 13, minHeight: 40 }}>{p.blurb}</p>
              <ul>
                {p.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <Link href="/signup" className={p.popular ? 'btn' : 'btn ghost'}>Start with {p.name}</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-section-head">
          <span className="mk-kicker">FAQ</span>
          <h2 className="mk-h2" style={{ fontSize: 'clamp(22px, 3vw, 30px)' }}>Common questions</h2>
        </div>
        <div className="grid-2" style={{ maxWidth: 980, margin: '0 auto' }}>
          {FAQ.map((f) => (
            <div className="panel" key={f.q}>
              <h3 style={{ marginBottom: 8 }}>{f.q}</h3>
              <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <h2>Launch your AI operations system in days, not months.</h2>
        <div className="hero-ctas" style={{ marginTop: 20 }}>
          <Link href="/signup" className="btn">Get Started</Link>
        </div>
      </section>
    </main>
  );
}
