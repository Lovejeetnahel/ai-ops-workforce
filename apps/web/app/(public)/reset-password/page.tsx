'use client';
import Link from 'next/link';
import { Suspense, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../../lib/api';
import { parseApiError } from '../../../lib/api-error';
import { SofilicMark } from '../../../components/Logo';
import { PasswordField } from '../../../components/PasswordField';

const PASSWORD_HINT = 'At least 8 characters, with at least one letter and one number.';
const PASSWORD_PATTERN = /(?=.*[A-Za-z])(?=.*\d)/;

function ResetPasswordForm() {
  const token = useSearchParams().get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const submitting = useRef(false);

  if (!token) {
    return (
      <div className="auth-card">
        <SofilicMark size={40} animated />
        <h1>Invalid reset link</h1>
        <p className="sub">This password reset link is missing its token. Request a new one below.</p>
        <div className="auth-foot">
          <Link href="/forgot-password">Request a new reset link</Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="auth-card">
        <SofilicMark size={40} animated />
        <h1>Password updated</h1>
        <p className="sub">Your password has been changed and you&rsquo;ve been signed out everywhere else. Sign in with your new password.</p>
        <Link href="/login" className="btn" style={{ width: '100%', display: 'block', textAlign: 'center', marginTop: 6 }}>
          Go to sign in
        </Link>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!PASSWORD_PATTERN.test(password) || password.length < 8) {
      setError(PASSWORD_HINT);
      return;
    }
    submitting.current = true;
    setError(null);
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      const { status, text } = parseApiError(err);
      if (status === 401) setError('This reset link is invalid or has expired. Request a new one below.');
      else if (status === 400) setError(text || PASSWORD_HINT);
      else if (status !== null) setError('Something went wrong. Please try again.');
      else setError('Network error — check your connection and try again.');
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <SofilicMark size={40} animated />
      <h1>Set a new password</h1>
      <p className="sub">Choose a new password for your account.</p>
      {error && (
        <div className="auth-err" role="alert" aria-live="polite">
          {error}
          {error.includes('invalid or has expired') && (
            <>
              {' '}
              <Link href="/forgot-password" style={{ color: 'var(--red)', textDecoration: 'underline' }}>Request a new link</Link>
            </>
          )}
        </div>
      )}
      <form onSubmit={submit} noValidate>
        <PasswordField
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
          hint={PASSWORD_HINT}
        />
        <PasswordField
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          minLength={8}
        />
        <button className="btn" type="submit" disabled={loading} style={{ width: '100%', marginTop: 6 }}>
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
      <div className="auth-foot">
        <Link href="/login">Back to sign in</Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="auth-wrap">
      <Suspense fallback={<div className="auth-card"><SofilicMark size={40} /><p className="sub">Loading…</p></div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
