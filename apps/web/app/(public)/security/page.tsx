import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sofilic Security',
  description: 'How Sofilic isolates tenant data, controls access, encrypts credentials and handles data export and deletion.',
  alternates: { canonical: 'https://sofilic.com/security' },
};

export default function SecurityPage() {
  return (
    <main className="mk-main">
      <section className="hero" style={{ padding: '64px 0 20px' }}>
        <h1 style={{ fontSize: 'clamp(30px, 5vw, 44px)' }}>Security</h1>
        <p className="hero-sub">
          The engineering detail behind the plain-language promises on our other pages. We don’t hold a
          formal compliance certification today — this page describes what’s actually built, not a legal
          claim of certification.
        </p>
      </section>

      <div className="legal-doc">
        <h2>Tenant data isolation</h2>
        <p>
          Every database query in the product goes through a query-layer guard that scopes it to the
          requesting business. The design is <strong>fail-closed</strong>: if a query can’t be proven to
          be scoped to the right business, it throws an error rather than silently returning — or
          writing — another business’s data. We have directly tested this by creating two separate
          accounts and confirming one account’s dashboard shows zero data belonging to the other.
        </p>

        <h2>Access control</h2>
        <p>
          Every account has a role — Customer, Staff, Admin or Owner — ranked in that order, and each API
          route declares the minimum role it requires. A lower-ranked role is rejected before it can read
          or write anything on a higher-ranked route.
        </p>

        <h2>Authentication</h2>
        <p>
          Sign-in uses a short-lived access token plus a longer-lived refresh token; a refresh token
          cannot be used in place of an access token. Customer-portal sessions use a separately scoped
          token type that cannot be used against staff routes.
        </p>

        <h2>Encrypted credentials</h2>
        <p>
          Third-party integration credentials (for example, a connected messaging or payment account) are
          encrypted at rest with AES-256, not stored in plain text.
        </p>

        <h2>Payment correctness</h2>
        <p>
          Payment settlement is designed to avoid double-booked revenue if the same event is delivered
          more than once — a payment can only move from pending to settled once, checked inside a single
          database transaction.
        </p>

        <h2>Public API</h2>
        <p>
          API keys carry their own scopes (for example, read-only access to leads or invoices) and their
          own rate limit, enforced per key.
        </p>

        <h2>Audit logging</h2>
        <p>
          Sensitive actions are written to an audit log you can review.
        </p>

        <h2>Data export and deletion</h2>
        <p>
          There is a built-in mechanism to export or erase a contact’s data on request. We don’t currently
          assert formal certification against any specific privacy framework (GDPR, PIPEDA or similar) —
          if that matters for your business, ask us directly via the <a href="/contact" style={{ color: 'var(--cyan)' }}>contact form</a>.
        </p>

        <h2>Infrastructure</h2>
        <p>
          The product runs as containerized services behind a reverse proxy that terminates TLS. The
          database and cache are not directly reachable from the public internet — only the application
          services are, through the proxy.
        </p>

        <h2>Questions</h2>
        <p>
          If you have a specific security question — a vendor security questionnaire, a request about
          data handling, anything else — use the <a href="/contact" style={{ color: 'var(--cyan)' }}>contact form</a> and choose “Security.”
        </p>
      </div>
    </main>
  );
}
