import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sofilic Support',
  description: 'How to get help with your Sofilic account.',
  alternates: { canonical: 'https://sofilic.com/support' },
};

export default function SupportPage() {
  return (
    <main className="mk-main">
      <section className="hero" style={{ padding: '64px 0 20px' }}>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 44px)' }}>Support</h1>
        <p className="hero-sub">
          We don’t yet have a self-serve help center — the fastest way to reach a real person is the
          contact form below.
        </p>
      </section>
      <section className="mk-section" style={{ paddingTop: 10 }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <div className="panel feature-card">
            <div className="feature-ico">✉️</div>
            <h4>Account or billing question</h4>
            <p>Use the contact form and choose “Account support” — include your business name so we can find your workspace quickly.</p>
          </div>
          <div className="panel feature-card">
            <div className="feature-ico">🔒</div>
            <h4>Security concern</h4>
            <p>Use the contact form and choose “Security.” See our <Link href="/security" style={{ color: 'var(--cyan)' }}>Security page</Link> for how we handle data.</p>
          </div>
          <div className="panel feature-card">
            <div className="feature-ico">💼</div>
            <h4>Sales or Enterprise</h4>
            <p>Use the contact form and choose “Sales & Enterprise” to talk about multi-location pricing.</p>
          </div>
        </div>
      </section>
      <section className="final-cta">
        <h2>Get in touch</h2>
        <div className="hero-ctas" style={{ marginTop: 20 }}>
          <Link href="/contact" className="btn">Contact us</Link>
        </div>
      </section>
    </main>
  );
}
