import Link from 'next/link';
import type { Metadata } from 'next';
import { StatusBadge } from '../../../components/StatusBadge';
import { industryStatusList, INDUSTRIES_COMING_SOON } from '../../../lib/product-status';

export const metadata: Metadata = {
  title: 'Sofilic Industries — Which Businesses Sofilic Supports Today',
  description: 'The exact industries available at signup today, read from the same catalog the signup form uses — plus what’s coming next.',
  alternates: { canonical: 'https://sofilic.com/industries' },
};

export default function IndustriesPage() {
  const live = industryStatusList();

  return (
    <main className="mk-main">
      <section className="hero" style={{ padding: '64px 0 20px' }}>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 48px)' }}>
          Pick your industry. <span className="grad-text">Sofilic configures itself.</span>
        </h1>
        <p className="hero-sub">
          Sofilic is one product, one backend and one data model. Choosing your industry at signup
          applies a preset on top of it — your vocabulary, your navigation, and your seeded
          automations — without a separate app to build or maintain.
        </p>
      </section>

      <section className="mk-section" style={{ paddingTop: 30 }}>
        <div className="mk-section-head" style={{ marginBottom: 28 }}>
          <span className="mk-kicker">Live today</span>
          <h2 className="mk-h2" style={{ fontSize: 'clamp(22px, 3vw, 30px)' }}>{live.length} industries, ready at signup</h2>
          <p className="muted">This count comes directly from the same industry catalog the signup form uses — it can’t drift out of sync.</p>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {live.map((ind) => (
            <div className="panel lift feature-card" key={ind.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="feature-ico">{ind.icon}</div>
                <StatusBadge status={ind.status} />
              </div>
              <h4>{ind.label}</h4>
              <p>{ind.tagline}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mk-section" style={{ paddingTop: 10 }}>
        <div className="panel" style={{ padding: '32px 30px' }}>
          <span className="mk-kicker">How this actually works</span>
          <h2 className="mk-h2" style={{ fontSize: 'clamp(20px, 3vw, 26px)', marginTop: 8 }}>Engines, presets and universal workspaces</h2>
          <p className="muted" style={{ maxWidth: 720, lineHeight: 1.75 }}>
            Under the hood, every tenant runs on one of a small number of shared <strong>engines</strong>{' '}
            (the core data model and workflow logic — for example, the field-service engine covers jobs,
            dispatch and quotes). An industry <strong>preset</strong>{' '}
            layers your vocabulary, navigation
            and starter automations on top of the right engine, and every tenant — regardless of
            industry — shares the same <strong>universal workspaces</strong>: CRM, Automation, Payments,
            Dashboard and Settings. This is deliberate: it means adding support for a new trade is a
            configuration change, not a new product to build and maintain separately.
          </p>
        </div>
      </section>

      <section className="mk-section" style={{ paddingTop: 10 }}>
        <div className="mk-section-head" style={{ marginBottom: 28 }}>
          <span className="mk-kicker">Rolling out next</span>
          <h2 className="mk-h2" style={{ fontSize: 'clamp(22px, 3vw, 30px)' }}>The rest of local business</h2>
          <p className="muted">These don’t have a preset yet — picking your industry at signup won’t include them today.</p>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {INDUSTRIES_COMING_SOON.map((ind) => (
            <div className="industry-pill" key={ind.label} style={{ justifyContent: 'space-between' }}>
              <span><span>{ind.icon}</span> {ind.label}</span>
              <StatusBadge status="coming-soon" />
            </div>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <h2>Don’t see your trade? General Field Services adapts to most mobile workforces.</h2>
        <div className="hero-ctas" style={{ marginTop: 20 }}>
          <Link href="/signup" className="btn">Get Started</Link>
        </div>
      </section>
    </main>
  );
}
