import Link from 'next/link';
import type { Metadata } from 'next';
import { StatusBadge } from '../../../components/StatusBadge';
import { Availability, INTEGRATION_STATUS } from '../../../lib/product-status';

export const metadata: Metadata = {
  title: 'Sofilic Features — What’s Live, Beta and Coming Soon',
  description: 'Every Sofilic module, honestly labeled: what’s live today, what’s in beta, and what’s still coming — plus how the platform connects to Stripe, Twilio and more.',
  alternates: { canonical: 'https://sofilic.com/features' },
};

type Item = { ico: string; name: string; desc: string; status: Availability };

const SELL: Item[] = [
  { ico: '📇', name: 'CRM & Pipeline', desc: 'Leads from calls, chat, forms and referrals land in one board with urgency flags and service types.', status: 'live' },
  { ico: '💼', name: 'Sales pipeline & follow-ups', desc: 'A live board so a lead never sits without a next step or an owner.', status: 'live' },
  { ico: '📄', name: 'Quotes & Invoices', desc: 'Generate and send invoices with Stripe pay links that reconcile automatically on payment.', status: 'live' },
  { ico: '🤖', name: 'Sales AI', desc: 'An AI employee role you can configure to score and follow up on leads.', status: 'beta' },
];

const OPERATE: Item[] = [
  { ico: '📱', name: 'Field Operations', desc: 'Job tracking and status updates for techs in the field, in the Apps workspace.', status: 'live' },
  { ico: '⚙️', name: 'Automation', desc: 'When-this-then-that recipes and a visual workflow builder, with a full run history you can audit.', status: 'live' },
  { ico: '🚚', name: 'Dispatch & Scheduling', desc: 'Assignment and calendar logic exists on the backend today; a dedicated dispatch/scheduling screen is coming to the app.', status: 'coming-soon' },
];

const CUSTOMER: Item[] = [
  { ico: '🏠', name: 'Customer Portal', desc: 'A scoped login for your customers to see their own bookings and documents. Currently viewable as a staff preview.', status: 'beta' },
  { ico: '💬', name: 'Unified Conversations', desc: 'One inbox for voice, SMS, chat and email threads per customer.', status: 'coming-soon' },
  { ico: '⭐', name: 'Reviews & Reputation', desc: 'Automated post-job review requests and reputation management.', status: 'coming-soon' },
  { ico: '🔔', name: 'Notifications', desc: 'Appointment confirmations and payment receipts across channels.', status: 'coming-soon' },
];

const KNOW: Item[] = [
  { ico: '📊', name: 'Dashboard & Analytics', desc: 'Revenue, pipeline and job KPIs computed live from your own data — no fabricated numbers, ever.', status: 'live' },
  { ico: '🏆', name: 'AI employee roster', desc: 'Configure named AI roles (Sales, Receptionist, Collections and more) from the Voice AI workspace.', status: 'beta' },
  { ico: '🧠', name: 'Executive Briefing', desc: 'A daily AI-written summary of your numbers and what needs attention.', status: 'coming-soon' },
];

const EXTEND: Item[] = [
  { ico: '🧩', name: 'Apps & Marketplace', desc: 'Install optional capabilities — Field Operations, Inventory, Fleet, HR — as you need them.', status: 'live' },
  { ico: '🔌', name: 'Public API', desc: 'Scoped API keys with per-key rate limits over a /v1 REST surface for leads, jobs, invoices and account data.', status: 'live' },
  { ico: '📣', name: 'Marketing Studio & Social', desc: 'Campaigns, brand kit and scheduled social posting.', status: 'coming-soon' },
  { ico: '🌐', name: 'Websites & SEO', desc: 'Landing pages, forms and a booking presence on your own domain.', status: 'coming-soon' },
];

const GROUPS: { kicker: string; title: string; items: Item[] }[] = [
  { kicker: 'Sell more', title: 'Track every lead to a next step', items: SELL },
  { kicker: 'Run operations', title: 'Dispatch and deliver without a whiteboard', items: OPERATE },
  { kicker: 'Serve customers', title: 'A portal your customers can actually use', items: CUSTOMER },
  { kicker: 'Know what’s working', title: 'Real numbers, not estimates', items: KNOW },
  { kicker: 'Extend it', title: 'Optional apps, the public API, and what’s next', items: EXTEND },
];

export default function FeaturesPage() {
  return (
    <main className="mk-main">
      <section className="hero" style={{ padding: '64px 0 20px' }}>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 48px)' }}>
          One platform. <span className="grad-text">Every module labeled honestly.</span>
        </h1>
        <p className="hero-sub">
          Some modules are live today, some are in beta, and some are still coming. We’d rather tell you
          which is which than have you find out after you sign up.
        </p>
      </section>

      {GROUPS.map((g) => (
        <section className="mk-section" key={g.title} style={{ paddingTop: 36 }}>
          <div className="mk-section-head" style={{ marginBottom: 28 }}>
            <span className="mk-kicker">{g.kicker}</span>
            <h2 className="mk-h2" style={{ fontSize: 'clamp(22px, 3vw, 30px)' }}>{g.title}</h2>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {g.items.map((f) => (
              <div className="panel feature-card" key={f.name}>
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
      ))}

      {/* Integrations — truthful availability, not a generic logo wall */}
      <section className="mk-section" style={{ paddingTop: 10 }}>
        <div className="mk-section-head" style={{ marginBottom: 28 }}>
          <span className="mk-kicker">Integrations</span>
          <h2 className="mk-h2" style={{ fontSize: 'clamp(22px, 3vw, 30px)' }}>What connects to Sofilic today</h2>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {INTEGRATION_STATUS.map((i) => (
            <div className="panel" key={i.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <strong style={{ fontSize: 14 }}>{i.label}</strong>
                <StatusBadge status={i.status} />
              </div>
              {i.note && <p className="status-note">{i.note}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* Platform & security — plain language first, technical depth lives on /security */}
      <section className="mk-section" style={{ paddingTop: 10 }}>
        <div className="panel" style={{ padding: '36px 32px' }}>
          <span className="mk-kicker">Platform & security</span>
          <h2 className="mk-h2" style={{ fontSize: 'clamp(22px, 3vw, 28px)', marginTop: 8 }}>Your data stays yours</h2>
          <p className="muted" style={{ maxWidth: 640, lineHeight: 1.7 }}>
            Every business's data is kept separate from every other business's, access is controlled by
            role, and sensitive actions are logged. If you want the engineering detail — how tenant
            isolation is enforced, how credentials are encrypted, how the API is rate-limited — see the
            full <Link href="/security" style={{ color: 'var(--cyan)' }}>Security page</Link>.
          </p>
        </div>
      </section>

      <section className="final-cta">
        <h2>See it running with your own business.</h2>
        <div className="hero-ctas" style={{ marginTop: 20 }}>
          <Link href="/signup" className="btn">Get Started</Link>
          <Link href="/pricing" className="btn ghost">View Pricing</Link>
        </div>
      </section>
    </main>
  );
}
