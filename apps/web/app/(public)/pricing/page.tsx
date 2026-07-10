import Link from 'next/link';

const PLANS = [
  {
    name: 'Starter', price: 79, popular: false,
    blurb: 'Solo operators getting off spreadsheets and missed calls.',
    features: ['CRM & industry pipeline', 'Calendar & scheduling', 'Quotes, invoicing & payments', 'Reviews (basic)', 'Customer portal', '1 AI employee', '3 staff users'],
  },
  {
    name: 'Growth', price: 149, popular: true,
    blurb: 'Small teams that want the phone answered 24/7.',
    features: ['Everything in Starter', 'AI voice receptionist (300 min)', 'Reviews Pro + AI replies', 'Marketing & social studio', '3 AI employees', '10 staff users'],
  },
  {
    name: 'Business', price: 299, popular: false,
    blurb: 'Established operations running the full AI workforce.',
    features: ['Everything in Growth', 'Full AI workforce (8 employees)', 'Executive briefing', 'Inventory + Fleet add-ons', 'Website & landing pages', 'Voice 1,000 min', '25 staff users'],
  },
  {
    name: 'Pro', price: 499, popular: false,
    blurb: 'Multi-crew companies with serious operational depth.',
    features: ['Everything in Business', 'Industry depth packs', 'HR & training workspaces', 'Client portal variants', 'Public API access', '50 staff users'],
  },
  {
    name: 'Enterprise', price: 999, popular: false, custom: true,
    blurb: 'Multi-location groups and franchises.',
    features: ['Everything in Pro', 'Multi-location management', 'SSO & compliance pack', 'Custom industry module', 'Dedicated success manager', 'SLA & priority onboarding'],
  },
];

const ADDONS = [
  { name: 'Extra AI employees', price: 'from $29/mo each', desc: 'Collections AI, Recruiting AI and more — each reports its ROI on the leaderboard.' },
  { name: 'Voice minutes', price: '$0.20/min after allowance', desc: 'A fraction of a human answering service, available 24/7.' },
  { name: 'Reviews Pro (standalone)', price: '$49/mo', desc: 'AI replies, reputation score and multi-source ingestion — the Podium replacement.' },
  { name: 'Marketing Pro', price: '$49/mo', desc: 'Multi-step journeys and revenue attribution from the value ledger.' },
  { name: 'Website & custom domain', price: '$29/mo', desc: 'Your booking page, reviews and brand on your own domain.' },
];

const FAQ = [
  { q: 'Is there a free trial?', a: 'Yes — Get Started provisions a full workspace configured for your industry. No credit card required to explore.' },
  { q: 'What counts as a staff user?', a: 'Owners, admins, dispatchers and field techs. Customers using the portal are free and unlimited.' },
  { q: 'Can I change plans later?', a: 'Upgrade or downgrade any time from Billing; changes prorate automatically.' },
  { q: 'What are AI employees?', a: 'Installable agents (Sales AI, Collections AI, Receptionist, Executive AI…) that do real work and report their ROI on a leaderboard.' },
  { q: 'How do payments work?', a: 'Payments run on Stripe. Invoices carry pay links, and settlements reconcile idempotently — no double-booked revenue.' },
  { q: 'Is my data isolated?', a: 'Yes. Every request is scoped to your business with a fail-closed guard — access across accounts is structurally impossible.' },
];

export default function PricingPage() {
  return (
    <main className="mk-main">
      <section className="hero" style={{ padding: '64px 0 20px' }}>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 48px)' }}>
          One subscription, <span className="grad-text">not seven</span>
        </h1>
        <p className="hero-sub">
          Sofilic replaces the booking tool, the review tool, the texting tool, the answering service and
          the marketing app — priced well under what those cost apart.
        </p>
      </section>

      <section className="mk-section" style={{ paddingTop: 24 }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {PLANS.map((p) => (
            <div className={`panel plan ${p.popular ? 'popular' : ''}`} key={p.name}>
              {p.popular && <span className="pop-badge">Most popular</span>}
              <h3 style={{ margin: 0 }}>{p.name}</h3>
              <div className="price">
                ${p.price}{(p as any).custom ? '+' : ''}
                <span className="muted" style={{ fontSize: 14 }}>/mo</span>
              </div>
              <p className="muted" style={{ fontSize: 13, minHeight: 40 }}>{p.blurb}</p>
              <ul>
                {p.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <Link href="/signup" className={p.popular ? 'btn' : 'btn ghost'}>Get Started</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-section" style={{ paddingTop: 10 }}>
        <div className="mk-section-head" style={{ marginBottom: 28 }}>
          <span className="mk-kicker">Add-ons</span>
          <h2 className="mk-h2" style={{ fontSize: 'clamp(22px, 3vw, 30px)' }}>Grow the stack as you grow</h2>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {ADDONS.map((a) => (
            <div className="panel" key={a.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong style={{ fontSize: 14 }}>{a.name}</strong>
                <span className="tag">{a.price}</span>
              </div>
              <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>{a.desc}</p>
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
        <h2>Run your entire business with AI.</h2>
        <div className="hero-ctas" style={{ marginTop: 20 }}>
          <Link href="/signup" className="btn">Get Started</Link>
        </div>
      </section>
    </main>
  );
}
