import Link from 'next/link';
import type { Metadata } from 'next';
import { GUIDES } from '../../../lib/guides';

export const metadata: Metadata = {
  title: 'Sofilic Resources & Guides',
  description: 'Real product guides — getting started, AI employees, approvals, the Command Center, security, billing, the public API and troubleshooting — plus honest platform references.',
  alternates: { canonical: 'https://sofilic.com/resources' },
};

/** Every card here links somewhere real — a written guide or a live reference
 *  page. No dead cards, no placeholder articles. */
const REFERENCE_LINKS = [
  { ico: '🧭', t: 'What’s live, beta and coming soon', d: 'The full module-by-module status of the platform.', href: '/features' },
  { ico: '🏭', t: 'Industries & how presets work', d: 'Which industries are ready today, and how one product adapts per trade.', href: '/industries' },
  { ico: '💳', t: 'Pricing & plans', d: 'Plans, add-ons and their honest status, in USD.', href: '/pricing' },
  { ico: '🎬', t: 'Example workflow', d: 'A fictional walkthrough of how a lead could move through Sofilic.', href: '/demo' },
  { ico: '✉️', t: 'Contact & support', d: 'Reach us directly with a question, or get help with your account.', href: '/contact' },
  { ico: '🔒', t: 'Security (full detail)', d: 'Tenant isolation, encryption, access control and data handling.', href: '/security' },
];

export default function ResourcesPage() {
  return (
    <main className="mk-main">
      <section className="hero" style={{ padding: '64px 0 24px' }}>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 48px)' }}>
          Resources & guides
        </h1>
        <p className="hero-sub">
          Written from how the product actually works — every card below opens a real guide or a real
          reference page.
        </p>
      </section>

      <section className="mk-section" style={{ paddingTop: 20 }}>
        <div className="mk-section-head" style={{ marginBottom: 24 }}>
          <span className="mk-kicker">Guides</span>
          <h2 className="mk-h2" style={{ fontSize: 'clamp(22px, 3vw, 30px)' }}>Learn Sofilic step by step</h2>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {GUIDES.map((g) => (
            <Link href={`/resources/${g.slug}`} key={g.slug} className="panel lift feature-card" style={{ textDecoration: 'none', display: 'block' }}>
              <div className="feature-ico">{g.icon}</div>
              <h4>{g.title}</h4>
              <p>{g.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mk-section" style={{ paddingTop: 20 }}>
        <div className="mk-section-head" style={{ marginBottom: 24 }}>
          <span className="mk-kicker">References</span>
          <h2 className="mk-h2" style={{ fontSize: 'clamp(22px, 3vw, 30px)' }}>Platform references</h2>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {REFERENCE_LINKS.map((g) => (
            <Link href={g.href} key={g.t} className="panel lift feature-card" style={{ textDecoration: 'none', display: 'block' }}>
              <div className="feature-ico">{g.ico}</div>
              <h4>{g.t}</h4>
              <p>{g.d}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <h2>Prefer to learn by doing?</h2>
        <p className="muted" style={{ maxWidth: 460, margin: '0 auto 24px' }}>
          Spin up a workspace and explore the platform yourself.
        </p>
        <div className="hero-ctas">
          <Link href="/signup" className="btn">Get Started</Link>
          <Link href="/demo" className="btn ghost">See the example workflow</Link>
        </div>
      </section>
    </main>
  );
}
