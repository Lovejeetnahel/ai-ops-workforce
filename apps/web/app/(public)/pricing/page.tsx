import Link from 'next/link';
import type { Metadata } from 'next';
import { StatusBadge } from '../../../components/StatusBadge';
import { AI_WORKFORCE_FACTS } from '../../../lib/product-status';

export const metadata: Metadata = {
  title: 'Sofilic Pricing — Plans, Add-ons and What’s Included',
  description: 'Sofilic pricing in USD, billed monthly: five plans from solo operators to multi-location enterprises, plus honest status on every add-on.',
  alternates: { canonical: 'https://sofilic.com/pricing' },
};

const PLANS = [
  {
    name: 'Starter', price: 79, popular: false,
    blurb: 'Solo operators getting off spreadsheets and missed calls.',
    limit: '3 staff users · 1 AI employee role',
    includes: ['CRM & industry pipeline', 'Calendar & scheduling', 'Quotes, invoicing & payments'],
    beta: ['Customer portal'],
    comingSoon: [],
  },
  {
    name: 'Growth', price: 149, popular: true,
    blurb: 'Small teams that want a system that keeps up with the phone.',
    limit: '10 staff users · 3 AI employee roles',
    includes: ['Everything in Starter'],
    beta: ['Voice AI agent configuration'],
    comingSoon: ['Reviews & Marketing'],
  },
  {
    name: 'Business', price: 299, popular: false,
    blurb: 'Established operations running the full AI employee roster.',
    limit: `25 staff users · full ${AI_WORKFORCE_FACTS.employeeRoles}-role AI employee roster`,
    includes: ['Everything in Growth'],
    beta: [],
    // Inventory + Fleet belong to this tier but are NOT live yet — they must
    // never appear under "includes" (that's the drift this file is guarding
    // against; the Apps page and OPTIONAL_APP_STATUS say Coming soon).
    comingSoon: ['Inventory + Fleet add-on apps', 'Website builder'],
  },
  {
    name: 'Pro', price: 499, popular: false,
    blurb: 'Multi-crew companies that need deeper operational tooling.',
    limit: '50 staff users',
    includes: ['Everything in Business', 'Client portal variants', 'Public API access'],
    beta: [],
    comingSoon: ['HR & training workspaces'],
  },
  {
    name: 'Enterprise', price: 999, popular: false, custom: true,
    blurb: 'Multi-location groups and franchises.',
    limit: 'Custom staff and location limits',
    includes: ['Everything in Pro', 'Multi-location management', 'Custom industry configuration', 'Dedicated success manager', 'Custom onboarding'],
    beta: [],
    comingSoon: [],
  },
];

const ADDONS = [
  { name: 'Extra AI employee roles', status: 'live' as const, price: 'Included allowance per plan', desc: 'Each plan includes a number of AI employee roles you can configure; additional roles are discussed at signup.' },
  { name: 'Voice AI calling minutes', status: 'beta' as const, price: 'Available during beta', desc: 'Automated call answering is in beta rollout. Usage pricing will be shown before activation.' },
  { name: 'Reviews & Reputation', status: 'coming-soon' as const, price: 'Pricing to be announced', desc: 'Automated review requests and reputation management — not yet live.' },
  { name: 'Marketing Studio', status: 'coming-soon' as const, price: 'Pricing to be announced', desc: 'Campaigns and social scheduling — not yet live.' },
  { name: 'Website & custom domain', status: 'coming-soon' as const, price: 'Pricing to be announced', desc: 'A booking page and brand presence on your own domain — not yet live.' },
];

const FAQ = [
  { q: 'Do I need a credit card to get started?', a: 'No. Get Started provisions your workspace immediately with no credit card required. If you choose a paid plan afterward, it begins with a 14-day trial before billing starts.' },
  { q: 'What currency and billing period is this?', a: 'All prices are in USD, billed monthly. We don’t currently publish an annual-billing discount.' },
  { q: 'What counts as a staff user?', a: 'Owners, admins, dispatchers and field techs. Customers using the portal don’t count toward your staff limit.' },
  { q: 'Can I change plans later?', a: 'Yes — upgrade or downgrade any time from Billing in Settings.' },
  { q: 'What are AI employee roles?', a: 'Installable agent configurations (Sales, Receptionist, Collections and more) you can turn on. Automated actions are currently in beta rollout — see the Features page for exact status.' },
  { q: 'How do payments work?', a: 'Payments run on your connected Stripe account. Invoices carry pay links, and settlement is designed to avoid double-booked revenue.' },
  { q: 'Is my data isolated from other businesses?', a: 'Yes. Every request is scoped to your business by a fail-closed guard we’ve directly tested — see our Security page.' },
];

export default function PricingPage() {
  return (
    <main className="mk-main">
      <section className="hero" style={{ padding: '64px 0 20px' }}>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 48px)' }}>
          One subscription, <span className="grad-text">priced in USD, billed monthly</span>
        </h1>
        <p className="hero-sub">
          Five plans, from solo operators to multi-location groups. Every plan includes what’s marked
          live today — beta and coming-soon capabilities are labeled, not hidden in fine print.
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
                <span className="muted" style={{ fontSize: 14 }}>/mo USD</span>
              </div>
              <p className="muted" style={{ fontSize: 13, minHeight: 40 }}>{p.blurb}</p>
              <div className="tag" style={{ marginBottom: 10, display: 'inline-block' }}>{p.limit}</div>
              <ul>
                {p.includes.map((f) => <li key={f}>{f}</li>)}
              </ul>
              {p.beta.length > 0 && (
                <>
                  <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '10px 0 4px' }}>In beta</div>
                  <ul>
                    {p.beta.map((f) => (
                      <li key={f}>
                        <span style={{ flex: 1, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                          <span>{f}</span> <StatusBadge status="beta" />
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {p.comingSoon.length > 0 && (
                <>
                  <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '10px 0 4px' }}>Coming soon</div>
                  <ul>
                    {p.comingSoon.map((f) => (
                      <li key={f}>
                        <span style={{ flex: 1, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                          <span>{f}</span> <StatusBadge status="coming-soon" />
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <Link href={(p as any).custom ? '/contact' : '/signup'} className={p.popular ? 'btn' : 'btn ghost'} style={{ marginTop: 10 }}>
                {(p as any).custom ? 'Talk to us' : 'Get Started'}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-section" style={{ paddingTop: 10 }}>
        <div className="mk-section-head" style={{ marginBottom: 28 }}>
          <span className="mk-kicker">Add-ons</span>
          <h2 className="mk-h2" style={{ fontSize: 'clamp(22px, 3vw, 30px)' }}>Grow the stack as it ships</h2>
          <p className="muted">Add-ons tied to beta or coming-soon capabilities will have pricing announced as they reach general availability. Contact us for current availability.</p>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {ADDONS.map((a) => (
            <div className="panel" key={a.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <strong style={{ fontSize: 14 }}>{a.name}</strong>
                <StatusBadge status={a.status} />
              </div>
              <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>{a.desc}</p>
              <span className="tag" style={{ marginTop: 8, display: 'inline-block' }}>{a.price}</span>
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
        <h2>Get started free — no credit card required.</h2>
        <div className="hero-ctas" style={{ marginTop: 20 }}>
          <Link href="/signup" className="btn">Get Started</Link>
          <Link href="/contact" className="btn ghost">Talk to Enterprise</Link>
        </div>
      </section>
    </main>
  );
}
