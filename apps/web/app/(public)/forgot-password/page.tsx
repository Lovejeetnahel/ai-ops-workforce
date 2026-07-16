'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { api } from '../../../lib/api';
import { parseApiError } from '../../../lib/api-error';
import { SofilicMark } from '../../../components/Logo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const submitting = useRef(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError(null);
    setLoading(true);
    try {
      await api.forgotPassword(email.trim().toLowerCase());
      // Always show the same success state, regardless of whether the email
      // matched an account — the API's response is deliberately generic too.
      setSent(true);
    } catch (err) {
      const { status } = parseApiError(err);
      if (status === 429) setError('Too many requests. Please wait a minute and try again.');
      else if (status !== null) setError('Something went wrong. Please try again.');
      else setError('Network error — check your connection and try again.');
      submitting.current = false;
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <SofilicMark size={40} animated />
          <h1>Check your email</h1>
          <p className="sub">If an eligible account exists and email delivery is available, reset instructions will be sent. The link expires in 1 hour and can only be used once.</p>
          <div className="auth-foot">
            <Link href="/login">Back to sign in</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <SofilicMark size={40} animated />
        <h1>Forgot your password?</h1>
        <p className="sub">Enter your email and we&rsquo;ll send you a link to reset it.</p>
        {error && <div className="auth-err" role="alert" aria-live="polite">{error}</div>}
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email" type="email" required autoComplete="email" inputMode="email" enterKeyHint="send"
              placeholder="you@yourcompany.com" disabled={loading}
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button className="btn" type="submit" disabled={loading} style={{ width: '100%', marginTop: 6 }}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        <div className="auth-foot">
          <Link href="/login">Back to sign in</Link>
          <br />
          Need help? <Link href="/support">Contact Support</Link>
        </div>
      </div>
    </div>
  );
}
