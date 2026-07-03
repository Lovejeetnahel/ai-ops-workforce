import Link from 'next/link';

const SCRIPT = [
  { who: 'Customer', text: 'My A/C stopped working and it’s 95° in here.', tone: 'in' },
  { who: 'AI Receptionist', text: 'Sorry to hear that — that qualifies as an emergency. I can have a technician out today at 10:30 AM. Does that work?', tone: 'ai' },
  { who: 'Customer', text: 'Yes please, as soon as possible.', tone: 'in' },
  { who: 'AI Receptionist', text: 'Booked ✅ Tina is on her way at 10:30 AM. You’ll get a text when she’s en route, and you can track everything in your customer portal.', tone: 'ai' },
  { who: 'Smart Dispatch', text: 'Assigned emergency job to Tina Tech — Eastside zone, Heating/Cooling skills, on-call now.', tone: 'sys' },
  { who: 'Document AI', text: 'Generated invoice #4821 with a Stripe pay link after job completion.', tone: 'sys' },
  { who: 'Follow-up AI', text: 'Sent a review request 2 hours after completion. Customer left ★★★★★.', tone: 'sys' },
];

export default function DemoPage() {
  return (
    <main className="mk-main">
      <section className="hero" style={{ padding: '64px 0 24px' }}>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 48px)' }}>
          Watch a lead become <span className="grad-text">revenue</span>
        </h1>
        <p className="hero-sub">
          This is a real conversation flow from the platform — the AI receptionist answers, qualifies,
          books, dispatches, invoices and follows up without a human touching it.
        </p>
      </section>

      <section className="mk-section" style={{ paddingTop: 12 }}>
        <div className="panel" style={{ maxWidth: 720, margin: '0 auto', padding: 26 }}>
          <h3 style={{ marginBottom: 18 }}>🎬 Emergency A/C call — end to end</h3>
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

      <section className="mk-section" style={{ paddingTop: 0 }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', maxWidth: 960, margin: '0 auto' }}>
          <div className="panel" style={{ textAlign: 'center' }}>
            <div className="kpi">90 sec</div>
            <div className="muted">from missed call to booked job</div>
          </div>
          <div className="panel" style={{ textAlign: 'center' }}>
            <div className="kpi">0</div>
            <div className="muted">humans needed for intake → invoice</div>
          </div>
          <div className="panel" style={{ textAlign: 'center' }}>
            <div className="kpi">24/7</div>
            <div className="muted">your AI workforce never sleeps</div>
          </div>
        </div>
      </section>

      <section className="final-cta">
        <h2>Try it with your own business in minutes.</h2>
        <p className="muted" style={{ maxWidth: 480, margin: '0 auto 24px' }}>
          Sign up, pick your industry module, and explore the full dashboard with live demo data — no credit card required.
        </p>
        <div className="hero-ctas">
          <Link href="/signup" className="btn">Start Free Demo</Link>
          <Link href="/login" className="btn ghost">Login</Link>
        </div>
      </section>
    </main>
  );
}
