import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sofilic Example Workflow — See How a Lead Could Flow Through',
  description: 'A fictional, illustrative walkthrough of how a lead could move through Sofilic — not a recording of a real call or a real customer.',
  alternates: { canonical: 'https://sofilic.com/demo' },
};

const SCRIPT = [
  { who: 'Customer', text: 'My A/C stopped working and it’s 95° in here.', tone: 'in' },
  { who: 'AI Receptionist', text: 'Sorry to hear that — that qualifies as an emergency. I can have a technician out today at 10:30 AM. Does that work?', tone: 'ai' },
  { who: 'Customer', text: 'Yes please, as soon as possible.', tone: 'in' },
  { who: 'AI Receptionist', text: 'Booked ✅ Tina is on her way at 10:30 AM. You’ll get a text when she’s en route.', tone: 'ai' },
  { who: 'Field Operations', text: 'Job assigned to Tina Tech — Eastside zone, on-call now.', tone: 'sys' },
  { who: 'Payments', text: 'Invoice #4821 generated with a Stripe pay link after job completion.', tone: 'sys' },
];

export default function DemoPage() {
  return (
    <main className="mk-main">
      <section className="hero" style={{ padding: '64px 0 24px' }}>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 48px)' }}>
          See a <span className="grad-text">Sofilic workflow</span>
        </h1>
        <p className="hero-sub">
          This is a fictional, illustrative example of how a lead could move through Sofilic today — not
          a recording of a real call, and not a guarantee of how every step behaves for every account.
          Automated voice call-answering is in beta rollout; see our <Link href="/features" style={{ color: 'var(--cyan)' }}>Features page</Link> for exact status.
        </p>
      </section>

      <section className="mk-section" style={{ paddingTop: 12 }}>
        <span className="sample-flag" style={{ display: 'block', width: 'fit-content', margin: '0 auto 16px' }}>
          ◔ Fictional example — no real customer, call or invoice
        </span>
        <div className="panel" style={{ maxWidth: 720, margin: '0 auto', padding: 26 }}>
          <h3 style={{ marginBottom: 18 }}>🎬 Example: an emergency A/C call</h3>
          {SCRIPT.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < SCRIPT.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span
                className="agent-pill"
                style={{
                  color: m.tone === 'ai' ? '#60a5fa' : m.tone === 'sys' ? '#34d399' : 'var(--muted)',
                  minWidth: 110, textAlign: 'center',
                }}
              >
                {m.who}
              </span>
              <span style={{ fontSize: 14, lineHeight: 1.55 }}>{m.text}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <h2>Try it with your own business in minutes.</h2>
        <p className="muted" style={{ maxWidth: 480, margin: '0 auto 24px' }}>
          Sign up, pick your industry, and explore the dashboard yourself — no credit card required.
        </p>
        <div className="hero-ctas">
          <Link href="/signup" className="btn">Get Started</Link>
          <Link href="/login" className="btn ghost">Login</Link>
        </div>
      </section>
    </main>
  );
}
