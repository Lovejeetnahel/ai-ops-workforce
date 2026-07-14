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
        <p className="updated">Last updated: these terms describe the product as it exists today and will be revised as the product and company details are finalized.</p>

        <p>
          These terms govern your use of the Sofilic website (sofilic.com) and application. This is
          written in plain language and does not assert a specific legal entity name, registered address
          or governing jurisdiction, which will be added here once finalized. If anything here is unclear
          before you sign up, ask us via the <a href="/contact" style={{ color: 'var(--cyan)' }}>contact form</a>.
        </p>

        <h2>Your account</h2>
        <p>
          You’re responsible for the accuracy of the information you provide and for keeping your login
          credentials confidential. You’re responsible for what your staff users do inside your account.
        </p>

        <h2>What’s included in your plan</h2>
        <p>
          Plan features are described on our <a href="/pricing" style={{ color: 'var(--cyan)' }}>Pricing page</a>, with an honest status
          (live, beta or coming soon) for every capability. Features marked beta or coming soon are not
          guaranteed to be available on any specific date.
        </p>

        <h2>Acceptable use</h2>
        <p>
          Don’t use Sofilic to send unlawful communications, to store data you don’t have the right to
          store, or to attempt to access another account’s data.
        </p>

        <h2>Your data</h2>
        <p>
          You own the business data you enter into Sofilic. See our <a href="/privacy" style={{ color: 'var(--cyan)' }}>Privacy Policy</a> for
          how it’s handled, and our <a href="/security" style={{ color: 'var(--cyan)' }}>Security page</a> for how it’s isolated from other
          accounts.
        </p>

        <h2>Changes to the service</h2>
        <p>
          Because parts of the product are actively in beta or still being built, features, pricing and
          these terms may change. We’ll aim to keep the status labels on our Features and Pricing pages
          accurate as that happens.
        </p>

        <h2>No warranty</h2>
        <p>
          The service is provided as described on our Features and Pricing pages, without guarantees
          beyond what’s stated there. We do not claim the product is free of errors or uninterrupted.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms: use our <a href="/contact" style={{ color: 'var(--cyan)' }}>contact form</a>.
        </p>
      </div>
    </main>
  );
}
