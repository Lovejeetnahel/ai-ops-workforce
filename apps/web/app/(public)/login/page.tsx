'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { api, saveSession } from '../../../lib/api';
import { parseApiError } from '../../../lib/api-error';
import { SofilicMark } from '../../../components/Logo';
import { PasswordField } from '../../../components/PasswordField';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(email.trim().toLowerCase(), password);
      saveSession(res);
      router.push('/dashboard');
      // Deliberately leave loading=true through the redirect — the button
      // should stay disabled until the browser actually navigates away.
    } catch (err: any) {
      const { status, text } = parseApiError(err);
      if (status === 401) setError('Invalid email or password.');
      else if (status === 403) setError(text || 'This account is not active. Contact support for help.');
      else if (status === 429) setError('Too many attempts. Please wait a minute and try again.');
      else if (status !== null) setError('Could not sign in. Please try again.');
      else setError('Network error — check your connection and try again.');
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <SofilicMark size={40} animated />
        <h1>Welcome back to Sofilic</h1>
        <p className="sub">Sign in to your AI Business Operating System.</p>
        {error && <div className="auth-err" role="alert" aria-live="polite">{error}</div>}
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email" type="email" required autoComplete="email" inputMode="email" enterKeyHint="next"
              placeholder="you@yourcompany.com" disabled={loading}
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <PasswordField
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            placeholder="••••••••"
          />
          <div className="auth-links-row">
            <span />
            <Link href="/forgot-password">Forgot password?</Link>
          </div>
          <button className="btn" type="submit" disabled={loading} style={{ width: '100%', marginTop: 6 }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="auth-foot">
          New here? <Link href="/signup">Create your account</Link>
          <br />
          Need help? <Link href="/support">Contact Support</Link>
        </div>
      </div>
    </div>
  );
}
