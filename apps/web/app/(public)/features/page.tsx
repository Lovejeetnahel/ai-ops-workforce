import Link from 'next/link';

const GROUPS = [
  {
    kicker: 'Revenue engine',
    title: 'Never lose another lead',
    items: [
      { ico: '📇', name: 'CRM & Pipeline', desc: 'Industry-aware stages with drag-free one-click moves. Leads from calls, chat, forms and referrals land in one board with urgency flags and service types.' },
      { ico: '🤖', name: 'Sales AI', desc: 'Scores every lead, qualifies with follow-up questions, drafts quotes, and chases silence — autonomously or with your approval.' },
      { ico: '📞', name: 'Missed-call text-back', desc: 'A missed call becomes an SMS with a booking link within seconds. The single highest-ROI automation in field services.' },
      { ico: '📄', name: 'Quotes & Invoices', desc: 'Generate, send, e-sign, and get paid. Invoices carry Stripe pay links and reconcile automatically on payment.' },
    ],
  },
  {
    kicker: 'Operations engine',
    title: 'Dispatch and deliver without the whiteboard',
    items: [
      { ico: '🚚', name: 'Smart Dispatch', desc: 'Assignment by skill, service zone, availability and urgency. Emergencies fast-track to the nearest on-call tech.' },
      { ico: '📱', name: 'Field Team App', desc: 'Clock-in/out, breaks, job start/stop, travel tracking with mileage, daily route view, and timesheets.' },
      { ico: '🧭', name: 'AI Field Copilot', desc: 'Job summaries, customer history, SOP answers, troubleshooting and safety guidance — in the tech’s pocket.' },
      { ico: '📅', name: 'Scheduling', desc: 'Working hours, time-off, conflict-free slot search and a global calendar across the whole team.' },
    ],
  },
  {
    kicker: 'Customer engine',
    title: 'A portal your customers actually use',
    items: [
      { ico: '🏠', name: 'Customer Portal', desc: 'Scoped secure login where customers see bookings, documents, invoices and their conversation history.' },
      { ico: '💬', name: 'Omnichannel inbox', desc: 'Voice, SMS, chat and email threads unified per customer with AI handling the routine volume.' },
      { ico: '⭐', name: 'Review engine', desc: 'Automated post-job review requests timed for when customers are happiest.' },
      { ico: '🔔', name: 'Notifications', desc: 'Appointment confirmations, tech-en-route alerts and payment receipts across channels.' },
    ],
  },
  {
    kicker: 'Intelligence engine',
    title: 'Know what to do next, every day',
    items: [
      { ico: '📊', name: 'Analytics', desc: 'Revenue, net value, conversion, pipeline value and job KPIs — computed live from the value ledger, not estimates.' },
      { ico: '🧠', name: 'Executive Briefing', desc: 'A daily AI-generated brief: 30-day revenue forecast, overdue invoices, pending approvals, urgent jobs, and a prioritized action list.' },
      { ico: '🏆', name: 'AI Leaderboard', desc: 'Every AI employee reports tasks completed, revenue generated, and success rate. Fire the ones that don’t perform.' },
      { ico: '⚙️', name: 'Automation health', desc: 'Every workflow run is logged with outcomes, so you can see what your automations earned you.' },
    ],
  },
  {
    kicker: 'Platform engine',
    title: 'Extend it, integrate it, audit it',
    items: [
      { ico: '🧩', name: 'Marketplace', desc: 'Install AI employees, workflow packs, industry template packs and integrations in one click.' },
      { ico: '🔌', name: 'Public API', desc: 'Scoped API keys with per-key rate limits over /v1 REST endpoints for leads, jobs, invoices and account.' },
      { ico: '🛡️', name: 'Compliance & Audit', desc: 'Audit logs, consent records, retention policies, GDPR/PIPEDA export and erasure.' },
      { ico: '🔒', name: 'Enterprise security', desc: 'Fail-closed tenant isolation, RBAC on every route, AES-256 encrypted credentials, JWT with refresh rotation.' },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <main className="mk-main">
      <section className="hero" style={{ padding: '64px 0 20px' }}>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 48px)' }}>
          One platform. <span className="grad-text">Five engines.</span>
        </h1>
        <p className="hero-sub">
          Everything below ships in the box — no add-on modules, no per-feature pricing surprises.
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
                <div className="feature-ico">{f.ico}</div>
                <h4>{f.name}</h4>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="final-cta">
        <h2>See every module live in one demo.</h2>
        <div className="hero-ctas" style={{ marginTop: 20 }}>
          <Link href="/signup" className="btn">Start Free Demo</Link>
          <Link href="/pricing" className="btn ghost">View Pricing</Link>
        </div>
      </section>
    </main>
  );
}
