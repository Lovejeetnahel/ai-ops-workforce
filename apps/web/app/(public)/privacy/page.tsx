import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sofilic Privacy Policy',
  description: 'What Sofilic collects, how it’s stored, and how to request export or deletion.',
  alternates: { canonical: 'https://sofilic.com/privacy' },
};

export default function PrivacyPage() {
  return (
    <main className="mk-main">
      <div className="legal-doc">
        <h1>Privacy Policy</h1>
        <p className="updated">This policy explains how Sofilic (“Sofilic,” “we,” “us”) handles information collected through our website and application. It may be updated from time to time as our service develops — see “Changes to this policy” below.</p>

        <h2>Information we collect</h2>
        <p>
          <strong>Account and business information:</strong> when you create a Sofilic account, we collect
          your business name, owner email, password (stored as a salted hash, never in plain text), and
          the industry you select.
        </p>
        <p>
          <strong>Product usage information:</strong> the business data you or your team enter into the
          product — contacts, leads, jobs, invoices and similar records. This data belongs to your
          account and is isolated from every other account; see our <a href="/security" style={{ color: 'var(--cyan)' }}>Security page</a> for
          how that isolation works.
        </p>
        <p>
          <strong>Contact form submissions:</strong> when you use our contact form, we collect the name,
          email, company (optional), topic and message you submit, along with a one-way cryptographic
          hash of the submitting IP address for spam-abuse prevention — not the IP address itself.
        </p>
        <p>
          <strong>What we don’t collect:</strong> our website does not load third-party analytics,
          advertising or tracking scripts. The application uses your browser’s local storage only to hold
          your own sign-in session — this is never shared with a third party for advertising purposes.
        </p>

        <h2>Service providers</h2>
        <p>
          If you connect a third-party integration (for example, a payment or messaging provider), that
          provider processes the data necessary to perform its function, under its own privacy policy. See
          the integration status on our <a href="/features" style={{ color: 'var(--cyan)' }}>Features page</a>.
        </p>

        <h2>Data security</h2>
        <p>
          Every request to the product is scoped to your business by a fail-closed access guard, integration
          credentials are encrypted at rest, and access to your account is controlled by role. Full detail
          is on our <a href="/security" style={{ color: 'var(--cyan)' }}>Security page</a>.
        </p>

        <h2>Retention</h2>
        <p>
          We keep account and product data for as long as your account is active, and contact form
          submissions for as long as needed to respond to and resolve your inquiry.
        </p>

        <h2>Your requests</h2>
        <p>
          You can request export or deletion of data associated with your account at any time through our <a href="/contact" style={{ color: 'var(--cyan)' }}>contact form</a>.
          We do not sell personal data.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          We may update this policy as Sofilic’s product and business details develop. We’ll keep this
          page current rather than leave it stale.
        </p>

        <h2>Contact us</h2>
        <p>
          Questions about this policy: use our <a href="/contact" style={{ color: 'var(--cyan)' }}>contact form</a>.
        </p>

        <p className="status-note" style={{ marginTop: 30 }}>
          This page describes our practices in plain language and is not a certification of compliance
          with any specific legal or regulatory framework.
        </p>
      </div>
    </main>
  );
}
