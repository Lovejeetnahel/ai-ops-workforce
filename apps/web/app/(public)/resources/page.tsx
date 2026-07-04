import Link from 'next/link';

const GUIDES = [
  { ico: '🚀', t: 'Getting started with Sofilic', d: 'Provision your workspace, pick an industry module, invite staff and connect integrations — the full first-week playbook.', tag: 'Guide' },
  { ico: '🤖', t: 'Hiring your first AI employee', d: 'How authority levels work, when to run autonomous vs. approval mode, and how to read the ROI leaderboard.', tag: 'Guide' },
  { ico: '📞', t: 'The missed-call text-back playbook', d: 'Why the highest-ROI automation in field services works, and how to tune the message for your trade.', tag: 'Playbook' },
  { ico: '🚚', t: 'Designing dispatch zones', d: 'Setting up service zones, skills and on-call rotations so smart dispatch makes the right call every time.', tag: 'Guide' },
  { ico: '💳', t: 'Payments & reconciliation', d: 'Connecting Stripe, understanding the value ledger, and why settlements in Sofilic can never double-book.', tag: 'Docs' },
  { ico: '🔌', t: 'Public API reference', d: 'Scoped API keys, rate limits, and the /v1 REST surface for leads, jobs, invoices and account.', tag: 'Docs' },
  { ico: '🛡️', t: 'Security & compliance overview', d: 'Tenant isolation, RBAC, encrypted credentials, audit logs and GDPR/PIPEDA export — how Sofilic protects your data.', tag: 'Docs' },
  { ico: '📊', t: 'Reading your executive briefing', d: 'What the daily AI brief includes, how the 30-day forecast is computed, and how to act on recommendations.', tag: 'Guide' },
];

export default function ResourcesPage() {
  return (
    <main className="mk-main">
      <section className="hero" style={{ padding: '64px 0 24px' }}>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 48px)' }}>
          Resources & <span className="grad-text">documentation</span>
        </h1>
        <p className="hero-sub">
          Everything you need to get the most out of Sofilic — from first login to running a
          multi-crew operation on autopilot.
        </p>
      </section>

      <section className="mk-section" style={{ paddingTop: 20 }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {GUIDES.map((g) => (
            <div className="panel lift feature-card" key={g.t}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="feature-ico">{g.ico}</div>
                <span className="tag">{g.tag}</span>
              </div>
              <h4>{g.t}</h4>
              <p>{g.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <h2>Prefer to learn by doing?</h2>
        <p className="muted" style={{ maxWidth: 460, margin: '0 auto 24px' }}>
          Spin up a workspace and explore every module with live demo data.
        </p>
        <div className="hero-ctas">
          <Link href="/signup" className="btn">Get Started</Link>
          <Link href="/demo" className="btn ghost">See the demo flow</Link>
        </div>
      </section>
    </main>
  );
}
