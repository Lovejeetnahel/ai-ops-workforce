import Link from 'next/link';
import type { Metadata } from 'next';
import { StatusBadge } from '../../../components/StatusBadge';
import { AI_WORKFORCE_FACTS } from '../../../lib/product-status';

export const metadata: Metadata = {
  title: 'Sofilic Pricing — Plans, Add-ons and What’s Included',
  description: 'Sofilic pricing in USD, billed monthly: three plans — Starter, Pro and Enterprise — with real included limits and a 14-day free trial.',
  alternates: { canonical: 'https://sofilic.com/pricing' },
};

// The SELLABLE catalog — kept in exact lockstep with the enforced billing
// plans (apps/api/src/common/entitlements/plans.ts). Every limit shown here
// is a real, runtime-enforced included limit, not marketing copy.
const PLANS = [
  {
    name: 'Starter', price: 99, popular: false,
    blurb: 'Solo operators getting off spreadsheets and missed calls.',
    limit: '3 staff users · 1 AI employee · 1 location',
    includes: [
      'CRM & industry pipeline (1,000 contacts)',
      'Scheduling & public booking links',
      'Estimates, invoicing & payments',
      'Unified inbox + customer portal',
      '1,000 AI tasks / 500 messages / 100 voice min per month',
      '1 website with lead forms & SEO checks',
    ],
    beta: [],
    comingSoon: [],
  },
  {
    name: 'Pro', price: 299, popular: true,
    blurb: `Growing teams running the full ${AI_WORKFORCE_FACTS.employeeRoles}-role AI workforce.`,
    limit: '15 staff users · full AI workforce · 5 locations',
    includes: [
      'Everything in Starter',
      `All ${AI_WORKFORCE_FACTS.employeeRoles} AI employee roles`,
      'Reviews, marketing campaigns & social planning',
      'Automations & workflows (100 active rules)',
      '10,000 AI tasks / 5,000 messages / 1,000 voice min per month',
      '25,000 contacts · 3 websites',
    ],
    beta: [],
    comingSoon: [],
  },
  {
    name: 'Enterprise', price: 999, popular: false,
    blurb: 'Multi-location groups and franchises.',
    limit: '100 staff users · 50 locations',
    includes: [
      'Everything in Pro',
      'Multi-location management & executive rollups',
      'Public API access (25 keys) + webhooks',
      '100,000 AI tasks / 50,000 messages / 10,000 voice min per month',
      '250,000 contacts · 10 websites',
      'Priority support',
    ],
    beta: [],
    comingSoon: [],
  },
];

const ADDONS = [
  { name: 'AI employee roles', status: 'live' as const, price: 'Included allowance per plan', desc: 'Each plan includes the AI employee roles listed above; every employee defaults to approval-first authority.' },
  { name: 'Voice AI calling', status: 'live' as const, price: 'Included minutes per plan', desc: 'AI phone answering with a connected voice provider. Minutes and per-call cost come from provider reports only.' },
  { name: 'SMS & email campaigns', status: 'live' as const, price: 'Included messages per plan', desc: 'Campaigns, review requests and reminders send through your connected Twilio/SendGrid — nothing sends without a real provider.' },
  { name: 'Website & lead forms', status: 'live' as const, price: 'Included sites per plan', desc: 'Publish landing pages with lead forms and SEO checks. Custom-domain connection is not automated yet.' },
  { name: 'Usage overage', status: 'coming-soon' as const, price: 'Not billed today', desc: 'Usage over your included limits is counted and shown honestly, but overage billing is not enabled — upgrade to raise limits.' },
];

const FAQ = [
  { q: 'Do I need a credit card to get started?', a: 'No. Every new workspace starts a 14-day free trial with full Pro limits, no card required. Pick a plan in Settings → Billing whenever you’re ready — checkout is a hosted Stripe page.' },
  { q: 'What currency and billing period is this?', a: 'All prices are in USD, billed monthly. We don’t currently publish an annual-billing discount.' },
  { q: 'What counts as a staff user?', a: 'Owners, admins, dispatchers and field techs. Customers using the portal don’t count toward your staff limit.' },
  { q: 'Can I change plans later?', a: 'Yes — upgrade or downgrade any time from Settings → Billing. Changes are prorated by Stripe, and you can cancel at period end or reactivate whenever you like.' },
  { q: 'What are AI employee roles?', a: 'Installable agent configurations (Sales, Receptionist, Collections and more) you can turn on. Every AI employee defaults to approval-first authority — you stay in control of outside-facing actions.' },
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
          Three plans, from solo operators to multi-location groups — and every limit shown is the
          real, enforced limit in the product, not fine print. Every workspace starts with a 14-day
          free Pro trial, no card required.
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
