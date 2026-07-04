import Link from 'next/link';

const INDUSTRIES = [
  { ico: '🛡️', name: 'Security', desc: 'Guard scheduling, patrol dispatch, incident reporting and client site portals.', points: ['Shift & patrol dispatch', 'Incident reports with audit trail', 'Client site portal'] },
  { ico: '🧹', name: 'Cleaning', desc: 'Recurring job scheduling, crew routing, quality checklists and instant rebooking.', points: ['Recurring schedules', 'Crew route optimization', 'Post-clean review requests'] },
  { ico: '❄️', name: 'HVAC', desc: 'Emergency fast-track dispatch, seasonal tune-up campaigns and quote-to-invoice flow.', points: ['Emergency dispatch', 'Seasonal re-engagement', 'Equipment history per address'] },
  { ico: '🏠', name: 'Roofing', desc: 'Inspection-to-quote pipeline, weather-aware scheduling and progress photos for customers.', points: ['Inspection pipeline', 'Photo documentation', 'Insurance-ready reports'] },
  { ico: '🏢', name: 'Property Management', desc: 'Tenant requests, vendor dispatch, unit history and owner reporting in one place.', points: ['Tenant request portal', 'Vendor dispatch', 'Owner statements'] },
  { ico: '🔍', name: 'Inspection', desc: 'Booking, checklists, report generation and follow-up scheduling for inspectors.', points: ['Checklist templates', 'Auto report delivery', 'Re-inspection scheduling'] },
  { ico: '🌿', name: 'Landscaping', desc: 'Route-based crews, seasonal contracts, weather rescheduling and upsell prompts.', points: ['Route-day planning', 'Seasonal contracts', 'Upsell recommendations'] },
  { ico: '🔧', name: 'Appliance Repair', desc: 'Parts-aware scheduling, diagnostic AI copilot and warranty tracking.', points: ['Diagnostic copilot', 'Parts & warranty tracking', 'Same-day dispatch'] },
  { ico: '🚐', name: 'Field Services', desc: 'The general-purpose module: any mobile workforce with jobs, zones and skills.', points: ['Skill/zone dispatch', 'Time & travel tracking', 'Custom pipelines'] },
  { ico: '🏡', name: 'Home Services', desc: 'Multi-trade operators running plumbing, electrical and handyman under one roof.', points: ['Multi-trade dispatch', 'Cross-sell automation', 'Unified customer history'] },
];

export default function IndustriesPage() {
  return (
    <main className="mk-main">
      <section className="hero" style={{ padding: '64px 0 20px' }}>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 48px)' }}>
          Your industry, <span className="grad-text">your vocabulary</span>
        </h1>
        <p className="hero-sub">
          Industry modules change the pipeline stages, intake forms, templates and automations —
          so the platform speaks your language on day one.
        </p>
      </section>

      <section className="mk-section" style={{ paddingTop: 30 }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {INDUSTRIES.map((ind) => (
            <div className="panel feature-card" key={ind.name}>
              <div className="feature-ico">{ind.ico}</div>
              <h4>{ind.name}</h4>
              <p style={{ marginBottom: 12 }}>{ind.desc}</p>
              {ind.points.map((p) => (
                <div key={p} style={{ fontSize: 12.5, color: 'var(--muted)', padding: '3px 0' }}>
                  <span style={{ color: 'var(--green)', marginRight: 8 }}>✓</span>{p}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <h2>Don’t see your industry? The Field Services module adapts to any mobile workforce.</h2>
        <div className="hero-ctas" style={{ marginTop: 20 }}>
          <Link href="/signup" className="btn">Get Started</Link>
        </div>
      </section>
    </main>
  );
}
