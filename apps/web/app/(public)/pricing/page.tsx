import Link from 'next/link';
import type { Metadata } from 'next';
import { StatusBadge } from '../../../components/StatusBadge';

export const metadata: Metadata = {
  title: 'Sofilic Pricing — Plans, Add-ons and What’s Included',
  description: 'Sofilic pricing in USD, billed monthly: five plans from solo operators to multi-location enterprises, plus honest status on every add-on.',
  alternates: { canonical: 'https://sofilic.com/pricing' },
};

const PLANS = [
  {
    name: 'Starter', price: 79, popular: false,
    blurb: 'Solo operators getting off spreadsheets and missed calls.',
    features: ['CRM & industry pipeline', 'Calendar & scheduling', 'Quotes, invoicing & payments', 'Customer portal (beta)', '1 AI employee role', '3 staff users'],
  },
  {
    name: 'Growth', price: 149, popular: true,
    blurb: 'Small teams that want a system that keeps up with the phone.',
    features: ['Everything in Starter', 'Voice AI agent configuration (beta)', 'Reviews & Marketing (coming soon)', '3 AI employee roles', '10 staff users'],
  },
  {
    name: 'Business', price: 299, popular: false,
    blurb: 'Established operations running the full AI employee roster.',
    features: ['Everything in Growth', 'Full AI employee roster (8 roles)', 'Inventory + Fleet add-on apps', 'Website builder (coming soon)', '25 staff users'],
  },
  {
    name: 'Pro', price: 499, popular: false,
    blurb: 'Multi-crew companies that need deeper operational tooling.',
    features: ['Everything in Business', 'HR & training workspaces', 'Client portal variants', 'Public API access', '50 staff users'],
  },
  {
    name: 'Enterprise', price: 999, popular: false, custom: true,
    blurb: 'Multi-location groups and franchises.',
    features: ['Everything in Pro', 'Multi-location management', 'Custom industry configuration', 'Dedicated success manager', 'Custom onboarding'],
  },
];

const ADDONS = [
  { name: 'Extra AI employee roles', status: 'live' as const, price: 'Included allowance per plan', desc: 'Each plan includes a number of AI employee roles you can configure; additional roles are discussed at signup.' },
  { name: 'Voice AI calling minutes', status: 'beta' as const, price: 'Pricing to be confirmed', desc: 'Automated call answering is in beta rollout — usage pricing isn’t finalized yet. Talk to us for current terms.' },
  { name: 'Reviews & Reputation', status: 'coming-soon' as const, price: 'Pricing to be confirmed', desc: 'Automated review requests and reputation management — not yet live.' },
  { name: 'Marketing Studio', status: 'coming-soon' as const, price: 'Pricing to be confirmed', desc: 'Campaigns and social scheduling — not yet live.' },
  { name: 'Website & custom domain', status: 'coming-soon' as const, price: 'Pricing to be confirmed', desc: 'A booking page and brand presence on your own domain — not yet live.' },
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
              <ul>
                {p.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <Link href={(p as any).custom ? '/contact' : '/signup'} className={p.popular ? 'btn' : 'btn ghost'}>
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
          <p className="muted">Add-ons tied to beta or coming-soon capabilities don’t have final pricing yet — we’d rather say that than guess.</p>
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
