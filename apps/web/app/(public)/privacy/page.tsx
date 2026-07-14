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
        <p className="updated">Last updated: this policy describes the product as it exists today and will be revised as the product and company details are finalized.</p>

        <p>
          This policy covers the Sofilic website (sofilic.com) and the Sofilic application. It is written
          in plain language and describes what actually happens in the product today — it does not
          assert a specific legal entity name, registered address or jurisdiction, which will be added
          here once finalized.
        </p>

        <h2>What we collect</h2>
        <p>
          <strong>When you sign up:</strong> the business name, owner email, password (stored as a
          salted hash, never in plain text), and the industry you select.
        </p>
        <p>
          <strong>When you use the product:</strong> the business data you or your team enter — contacts,
          leads, jobs, invoices and similar records — which belongs to your account and is isolated from
          every other account by a fail-closed guard described on our <a href="/security" style={{ color: 'var(--cyan)' }}>Security page</a>.
        </p>
        <p>
          <strong>When you use the contact form:</strong> the name, email, company (optional), topic and
          message you submit. We also keep a one-way cryptographic hash of the submitting IP address for
          spam-abuse triage — not the IP address itself.
        </p>
        <p>
          <strong>What we don’t currently use:</strong> as of this policy, the public website doesn’t load
          any third-party analytics, advertising or tracking scripts. The application uses your browser’s
          local storage only to hold your own sign-in session token — nothing is shared with a third
          party for advertising purposes.
        </p>

        <h2>How we use it</h2>
        <p>
          To operate your account, respond to messages you send us, and to run the automations and AI
          features you configure inside your own account. We do not sell personal data.
        </p>

        <h2>Third-party services</h2>
        <p>
          If you connect a third-party integration (for example, a payment or messaging provider), that
          provider processes the data necessary to perform its function under its own privacy policy. See
          the integration status on our <a href="/features" style={{ color: 'var(--cyan)' }}>Features page</a>.
        </p>

        <h2>Data export and deletion</h2>
        <p>
          You can request export or deletion of data associated with your account by contacting us. See
          our <a href="/security" style={{ color: 'var(--cyan)' }}>Security page</a> for how this is handled technically.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy: use our <a href="/contact" style={{ color: 'var(--cyan)' }}>contact form</a>.
        </p>
      </div>
    </main>
  );
}
