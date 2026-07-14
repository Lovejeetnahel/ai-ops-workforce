import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sofilic Terms of Service',
  description: 'The terms for using the Sofilic website and application.',
  alternates: { canonical: 'https://sofilic.com/terms' },
};

export default function TermsPage() {
  return (
    <main className="mk-main">
      <div className="legal-doc">
        <h1>Terms of Service</h1>
        <p className="updated">These terms govern your use of the Sofilic (“Sofilic,” “we,” “us”) website and application. They may be updated from time to time as our service develops — see “Changes to the service” below. If anything here is unclear before you sign up, ask us via the <a href="/contact" style={{ color: 'var(--cyan)' }}>contact form</a>.</p>

        <h2>Service access</h2>
        <p>
          Creating an account gives you access to Sofilic under the plan you choose. We may introduce,
          change or retire individual features over time — the <a href="/features" style={{ color: 'var(--cyan)' }}>Features page</a> reflects
          current availability.
        </p>

        <h2>Your account</h2>
        <p>
          You’re responsible for the accuracy of the information you provide and for keeping your login
          credentials confidential. You’re responsible for what your staff users do inside your account.
        </p>

        <h2>Acceptable use</h2>
        <p>
          Don’t use Sofilic to send unlawful communications, to store data you don’t have the right to
          store, or to attempt to access another account’s data.
        </p>

        <h2>Subscription and pricing</h2>
        <p>
          Plan features, pricing and add-on availability are described on our <a href="/pricing" style={{ color: 'var(--cyan)' }}>Pricing page</a>.
          You can upgrade or downgrade your plan at any time from Billing in Settings.
        </p>

        <h2>Beta and coming-soon functionality</h2>
        <p>
          Some capabilities are labeled beta or coming soon on our <a href="/features" style={{ color: 'var(--cyan)' }}>Features page</a> and{' '}
          <a href="/pricing" style={{ color: 'var(--cyan)' }}>Pricing page</a>. These are not guaranteed to be available on any specific date, and
          their behavior may change as they’re completed.
        </p>

        <h2>Intellectual property</h2>
        <p>
          Sofilic and its branding, design and underlying software are owned by us. You own the business
          data you enter into Sofilic. See our <a href="/privacy" style={{ color: 'var(--cyan)' }}>Privacy Policy</a> for how it’s handled,
          and our <a href="/security" style={{ color: 'var(--cyan)' }}>Security page</a> for how it’s isolated from other accounts.
        </p>

        <h2>Service availability</h2>
        <p>
          We aim to keep Sofilic available and reliable, but the service is provided as described on our
          Features and Pricing pages without guarantees beyond what’s stated there — we do not claim the
          product is free of errors or uninterrupted.
        </p>

        <h2>Suspension and termination</h2>
        <p>
          We may suspend or terminate access to an account that violates acceptable use, and you may stop
          using Sofilic and close your account at any time by contacting us.
        </p>

        <h2>Changes to the service</h2>
        <p>
          Because parts of the product are actively in beta or still being built, features, pricing and
          these terms may change. We aim to keep the status labels on our Features and Pricing pages
          accurate as that happens.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms: use our <a href="/contact" style={{ color: 'var(--cyan)' }}>contact form</a>.
        </p>

        <p className="status-note" style={{ marginTop: 30 }}>
          These terms describe our service in plain language and are not legal advice or a certification
          of compliance with any specific legal or regulatory framework.
        </p>
      </div>
    </main>
  );
}
