import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sofilic Resources',
  description: 'Where to go for what Sofilic is, what it costs, how it’s secured, and how to reach us.',
  alternates: { canonical: 'https://sofilic.com/resources' },
};

/** Every card here links somewhere real. We'd rather have a short honest list
 *  than a wall of article cards that go nowhere. */
const LINKS = [
  { ico: '🧭', t: 'What’s live, beta and coming soon', d: 'The full module-by-module status of the platform.', href: '/features' },
  { ico: '🏭', t: 'Industries & how presets work', d: 'Which industries are ready today, and how one product adapts per trade.', href: '/industries' },
  { ico: '💳', t: 'Pricing & plans', d: 'Plans, add-ons and their honest status, in USD.', href: '/pricing' },
  { ico: '🔒', t: 'Security', d: 'Tenant isolation, encryption, access control and data handling.', href: '/security' },
  { ico: '🎬', t: 'Example workflow', d: 'A fictional walkthrough of how a lead could move through Sofilic.', href: '/demo' },
  { ico: '✉️', t: 'Contact & support', d: 'Reach us directly with a question, or get help with your account.', href: '/contact' },
];

export default function ResourcesPage() {
  return (
    <main className="mk-main">
      <section className="hero" style={{ padding: '64px 0 24px' }}>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 48px)' }}>
          Resources
        </h1>
        <p className="hero-sub">
          A short, honest list — every link below goes somewhere real. A full guide and documentation
          library is planned as the product matures.
        </p>
      </section>

      <section className="mk-section" style={{ paddingTop: 20 }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {LINKS.map((g) => (
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
