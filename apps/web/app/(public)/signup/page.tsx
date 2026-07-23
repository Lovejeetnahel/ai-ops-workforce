'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { listPresets } from '@aiow/config';
import { api, saveSession } from '../../../lib/api';
import { parseApiError } from '../../../lib/api-error';
import { SofilicMark } from '../../../components/Logo';
import { PasswordField } from '../../../components/PasswordField';

/**
 * Offline fallback if `/tenants/presets` doesn't respond — read from the same
 * `@aiow/config` catalog the API serves, not a hand-maintained duplicate, so
 * this can never list a different set of industries than the live endpoint.
 */
const FALLBACK_PRESETS: { key: string; engine: string; label: string; tagline: string; icon: string }[] =
  listPresets().map((p) => ({ key: p.key, engine: p.engine as string, label: p.label, tagline: p.tagline, icon: p.icon }));

const COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Australia', 'New Zealand', 'Ireland', 'Other'];
const BUSINESS_SIZES = ['Just me', '2–5 people', '6–15 people', '16–50 people', '50+ people'];
/** Sensible default headcount for "how many will actually use Sofilic" per business-size bucket. */
const SUGGESTED_TEAM_SIZE: Record<string, string> = {
  'Just me': '1',
  '2–5 people': '3',
  '6–15 people': '8',
  '16–50 people': '20',
  '50+ people': '50',
};
const PASSWORD_HINT = 'At least 8 characters, with at least one letter and one number.';
const PASSWORD_PATTERN = /(?=.*[A-Za-z])(?=.*\d)/;

export default function SignupPage() {
  const router = useRouter();
  const [presets, setPresets] = useState(FALLBACK_PRESETS);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('United States');
  const [presetKey, setPresetKey] = useState('hvac');
  const [businessSize, setBusinessSize] = useState('2–5 people');
  const [teamSize, setTeamSize] = useState('3');
  const [teamSizeTouched, setTeamSizeTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    api.industryPresets().then((p) => { if (p?.length) setPresets(p); }).catch(() => {});
  }, []);

  // Auto-suggest a team size when business size changes, unless the user has
  // already typed their own value — keeps the two fields from feeling like
  // pure duplicates without ever overwriting a deliberate answer.
  useEffect(() => {
    if (!teamSizeTouched) setTeamSize(SUGGESTED_TEAM_SIZE[businessSize] ?? teamSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessSize]);

  const selected = useMemo(() => presets.find((p) => p.key === presetKey), [presets, presetKey]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    setError(null);

    if (!termsAccepted) {
      setError('You must accept the Terms of Service and Privacy Policy to continue.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!PASSWORD_PATTERN.test(password) || password.length < 8) {
      setError(PASSWORD_HINT);
      return;
    }

    submitting.current = true;
    setLoading(true);
    try {
      await api.signup({
        name,
        firstName,
        lastName,
        ownerEmail: email.trim().toLowerCase(),
        ownerPassword: password,
        industryModule: selected?.engine ?? 'FIELD_SERVICES',
        presetKey,
        country,
        businessSize,
        teamSize,
        termsAccepted,
        marketingConsent,
      });
      const res = await api.login(email.trim().toLowerCase(), password);
      saveSession(res);
      router.push('/onboarding');
    } catch (err) {
      const { status, text, correlationId } = parseApiError(err);
      const ref = correlationId ? ` If this keeps happening, contact support and quote reference ${correlationId}.` : '';
      if (status === 409) setError(text || 'An account with that email already exists. Try signing in instead.');
      else if (status === 400) setError(text || 'Please check your details and try again.');
      else if (status !== null) setError(`Could not create your account — something went wrong on our side, not with your details.${ref}`);
      else setError('Network error — check your connection and try again.');
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card auth-card-wide">
        <SofilicMark size={40} animated />
        <h1>Create your Sofilic account</h1>
        <p className="sub">Pick your industry and Sofilic configures itself for how your business runs.</p>
        {error && <div className="auth-err" role="alert" aria-live="polite">{error}</div>}
        <form onSubmit={submit} noValidate>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label htmlFor="firstName">First name</label>
              <input
                id="firstName" type="text" required autoComplete="given-name" enterKeyHint="next"
                placeholder="Jamie" disabled={loading}
                value={firstName} onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="lastName">Last name</label>
              <input
                id="lastName" type="text" required autoComplete="family-name" enterKeyHint="next"
                placeholder="Rivera" disabled={loading}
                value={lastName} onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="name">Business name</label>
            <input
              id="name" type="text" required enterKeyHint="next"
              placeholder="Eastside Plumbing Co." disabled={loading}
              value={name} onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="country">Country</label>
            <select id="country" value={country} disabled={loading} onChange={(e) => setCountry(e.target.value)}>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="industry">Industry</label>
            <select id="industry" value={presetKey} disabled={loading} onChange={(e) => setPresetKey(e.target.value)}>
              {presets.map((p) => (
                <option key={p.key} value={p.key}>{p.icon} {p.label}</option>
              ))}
            </select>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{selected?.tagline}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label htmlFor="bsize">Business size</label>
              <select id="bsize" value={businessSize} disabled={loading} onChange={(e) => setBusinessSize(e.target.value)}>
                {BUSINESS_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="field-hint">Your company&rsquo;s overall size.</div>
            </div>
            <div className="field">
              <label htmlFor="tsize">Team size</label>
              <input
                id="tsize" type="number" min={1} max={500} enterKeyHint="next" disabled={loading}
                value={teamSize}
                onChange={(e) => { setTeamSizeTouched(true); setTeamSize(e.target.value); }}
              />
              <div className="field-hint">How many people will log into Sofilic.</div>
            </div>
          </div>
          <div className="field">
            <label htmlFor="email">Owner email</label>
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
            autoComplete="new-password"
            minLength={8}
            placeholder="At least 8 characters"
            hint={PASSWORD_HINT}
          />
          <PasswordField
            label="Confirm password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            minLength={8}
          />
          <div className="auth-checkbox-row">
            <input
              id="terms" type="checkbox" required checked={termsAccepted} disabled={loading}
              onChange={(e) => setTermsAccepted(e.target.checked)}
            />
            <label htmlFor="terms">
              I agree to the <Link href="/terms" target="_blank">Terms of Service</Link> and <Link href="/privacy" target="_blank">Privacy Policy</Link>.
            </label>
          </div>
          <div className="auth-checkbox-row">
            <input
              id="marketing" type="checkbox" checked={marketingConsent} disabled={loading}
              onChange={(e) => setMarketingConsent(e.target.checked)}
            />
            <label htmlFor="marketing">Send me occasional product updates and tips (optional).</label>
          </div>
          <button className="btn" type="submit" disabled={loading} style={{ width: '100%', marginTop: 6 }}>
            {loading ? 'Setting up your business…' : 'Get Started'}
          </button>
        </form>
        <div className="auth-foot">
          Already have an account? <Link href="/login">Sign in</Link>
          <br />
          Need help? <Link href="/support">Contact Support</Link>
        </div>
      </div>
    </div>
  );
}
