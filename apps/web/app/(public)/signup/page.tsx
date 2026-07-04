'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { SofilicMark } from '../../../components/Logo';

const FALLBACK_MODULES = [
  { key: 'FIELD_SERVICES', label: 'Field Services', tagline: 'HVAC, plumbing, electrical, repair — any mobile workforce.' },
  { key: 'PROPERTY_MANAGEMENT', label: 'Property Management', tagline: 'Tenant requests, vendor dispatch, unit history.' },
  { key: 'SERVICE_AGENCIES', label: 'Service Agencies', tagline: 'Client work, cases and retainers for service firms.' },
];

export default function SignupPage() {
  const router = useRouter();
  const [modules, setModules] = useState(FALLBACK_MODULES);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [industry, setIndustry] = useState('FIELD_SERVICES');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.industryModules().then((m) => { if (m?.length) setModules(m); }).catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await api.signup(name, email, password, industry);
      // Auto-login with the owner credentials just created.
      const res = await api.login(email, password);
      window.localStorage.setItem('aiow_token', res.accessToken);
      window.localStorage.setItem('aiow_user', JSON.stringify(res.user ?? {}));
      router.push('/dashboard');
    } catch (err: any) {
      const msg = String(err?.message ?? '');
      setError(
        msg.includes('409') || msg.toLowerCase().includes('exists')
          ? 'A workspace with that email already exists. Try logging in instead.'
          : 'Could not create your workspace. Please check your details and try again.',
      );
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <SofilicMark size={40} animated />
        <h1>Create your Sofilic workspace</h1>
        <p className="sub">Your business, your industry module, your AI workforce — live in minutes.</p>
        {error && <div className="auth-err">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="name">Business name</label>
            <input
              id="name" type="text" required
              placeholder="Acme HVAC & Plumbing"
              value={name} onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="email">Owner email</label>
            <input
              id="email" type="email" required autoComplete="email"
              placeholder="you@yourcompany.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password" type="password" required autoComplete="new-password" minLength={6}
              placeholder="At least 6 characters"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="industry">Industry module</label>
            <select id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)}>
              {modules.map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {modules.find((m) => m.key === industry)?.tagline}
            </div>
          </div>
          <button className="btn" type="submit" disabled={loading} style={{ width: '100%', marginTop: 6 }}>
            {loading ? 'Creating workspace…' : 'Get Started'}
          </button>
        </form>
        <div className="auth-foot">
          Already have a workspace? <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
