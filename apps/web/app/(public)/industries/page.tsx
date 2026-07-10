import Link from 'next/link';

/** Phase 1 catalog: 14 field-service trades live now, plus the two other live engines. */
const LIVE_NOW = [
  { ico: '❄️', name: 'HVAC', desc: 'Emergency triage, seasonal tune-up campaigns and equipment history per home.' },
  { ico: '🔧', name: 'Plumbing', desc: 'From burst-pipe emergency to paid invoice without a missed call.' },
  { ico: '⚡', name: 'Electrical', desc: 'Service calls and project quotes with permit tracking built in.' },
  { ico: '🏠', name: 'Roofing', desc: 'Inspection-to-insurance-to-install pipeline with photo reports.' },
  { ico: '🧹', name: 'Cleaning Services', desc: 'Recurring schedules, crew routing and quality checklists.' },
  { ico: '🌿', name: 'Landscaping', desc: 'Seasonal contracts, route days and weather rescheduling.' },
  { ico: '🐜', name: 'Pest Control', desc: 'Treatment plans, chemical logs and quarterly recurring billing.' },
  { ico: '🔑', name: 'Locksmith', desc: 'Win the lockout call — AI answers, quotes and dispatches in seconds.' },
  { ico: '🔌', name: 'Appliance Repair', desc: 'Diagnose, order parts, return visit — tracked end to end.' },
  { ico: '🚪', name: 'Garage Door', desc: 'Emergency repairs and install projects booked while you sleep.' },
  { ico: '🎨', name: 'Painting', desc: 'Estimates, crews and follow-ups that fill your calendar.' },
  { ico: '💦', name: 'Pressure Washing', desc: 'Quote fast, book routes, rebook every season automatically.' },
  { ico: '🪟', name: 'Window Cleaning', desc: 'Recurring residential routes and commercial contracts.' },
  { ico: '🚛', name: 'Junk Removal', desc: 'Photo quotes, same-day dispatch and instant payment.' },
  { ico: '🏢', name: 'Real Estate', desc: 'Leasing, property management, brokerages and investors — tenant requests, vendor dispatch and owner reporting in one place.' },
  { ico: '💼', name: 'Professional Services', desc: 'Client work, cases and retainers for law firms, accountants, consultants and agencies.' },
];

const COMING = [
  ['💇', 'Hair Salons & Barbershops'], ['💅', 'Nail Salons & Spas'], ['🚗', 'Auto Repair & Detailing'],
  ['🐕', 'Pet Grooming & Boarding'], ['🏋️', 'Gyms & Studios'], ['🩺', 'Clinics & Wellness'],
  ['🛡️', 'Security Companies'], ['🍽️', 'Restaurants & Cafes'],
];

export default function IndustriesPage() {
  return (
    <main className="mk-main">
      <section className="hero" style={{ padding: '64px 0 20px' }}>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 48px)' }}>
          Pick your industry. <span className="grad-text">Sofilic does the rest.</span>
        </h1>
        <p className="hero-sub">
          Choose your business type at signup and Sofilic configures the pipeline, vocabulary,
          documents and automations for how your industry actually works.
        </p>
      </section>

      <section className="mk-section" style={{ paddingTop: 30 }}>
        <div className="mk-section-head" style={{ marginBottom: 28 }}>
          <span className="mk-kicker">Live today</span>
          <h2 className="mk-h2" style={{ fontSize: 'clamp(22px, 3vw, 30px)' }}>16 industries, ready at signup</h2>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {LIVE_NOW.map((ind) => (
            <div className="panel lift feature-card" key={ind.name}>
              <div className="feature-ico">{ind.ico}</div>
              <h4>{ind.name}</h4>
              <p>{ind.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-section" style={{ paddingTop: 10 }}>
        <div className="mk-section-head" style={{ marginBottom: 28 }}>
          <span className="mk-kicker">Rolling out next</span>
          <h2 className="mk-h2" style={{ fontSize: 'clamp(22px, 3vw, 30px)' }}>The rest of local business</h2>
          <p className="muted">Appointments, coverage and professional-service industries land in the next waves.</p>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {COMING.map(([ico, name]) => (
            <div className="industry-pill" key={name}><span>{ico}</span> {name}</div>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <h2>Don’t see your trade? The general Field Services setup adapts to any mobile workforce.</h2>
        <div className="hero-ctas" style={{ marginTop: 20 }}>
          <Link href="/signup" className="btn">Get Started</Link>
        </div>
      </section>
    </main>
  );
}
