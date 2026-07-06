'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';
import { SofilicMark } from '../../../components/Logo';

/** Offline fallback mirroring the Phase 1 preset catalog served by /tenants/presets. */
const FALLBACK_PRESETS = [
  { key: 'hvac', engine: 'FIELD_SERVICES', label: 'HVAC', tagline: 'Answer every call, book every job, dispatch the right tech.', icon: '❄️' },
  { key: 'plumbing', engine: 'FIELD_SERVICES', label: 'Plumbing', tagline: 'From burst-pipe emergency to paid invoice.', icon: '🔧' },
  { key: 'electrical', engine: 'FIELD_SERVICES', label: 'Electrical', tagline: 'Book service calls and win project quotes.', icon: '⚡' },
  { key: 'roofing', engine: 'FIELD_SERVICES', label: 'Roofing', tagline: 'Inspections to insurance to installed roof.', icon: '🏠' },
  { key: 'cleaning', engine: 'FIELD_SERVICES', label: 'Cleaning Services', tagline: 'Recurring schedules, five-star clients.', icon: '🧹' },
  { key: 'landscaping', engine: 'FIELD_SERVICES', label: 'Landscaping', tagline: 'Seasonal contracts that run themselves.', icon: '🌿' },
  { key: 'pest_control', engine: 'FIELD_SERVICES', label: 'Pest Control', tagline: 'Treatments, plans and compliance logs.', icon: '🐜' },
  { key: 'locksmith', engine: 'FIELD_SERVICES', label: 'Locksmith', tagline: 'Win the lockout call in sixty seconds.', icon: '🔑' },
  { key: 'appliance_repair', engine: 'FIELD_SERVICES', label: 'Appliance Repair', tagline: 'Diagnose, order parts, return, fix.', icon: '🔌' },
  { key: 'garage_door', engine: 'FIELD_SERVICES', label: 'Garage Door Services', tagline: 'Repairs and installs booked while you sleep.', icon: '🚪' },
  { key: 'painting', engine: 'FIELD_SERVICES', label: 'Painting', tagline: 'Estimates and crews that fill your calendar.', icon: '🎨' },
  { key: 'pressure_washing', engine: 'FIELD_SERVICES', label: 'Pressure Washing', tagline: 'Quote fast, book routes, rebook seasons.', icon: '💦' },
  { key: 'window_cleaning', engine: 'FIELD_SERVICES', label: 'Window Cleaning', tagline: 'Recurring routes on autopilot.', icon: '🪟' },
  { key: 'junk_removal', engine: 'FIELD_SERVICES', label: 'Junk Removal', tagline: 'Photo quotes, same-day dispatch.', icon: '🚛' },
  { key: 'field_services', engine: 'FIELD_SERVICES', label: 'Field Services (General)', tagline: 'Any mobile workforce.', icon: '🚐' },
  { key: 'property_management', engine: 'PROPERTY_MANAGEMENT', label: 'Property Management', tagline: 'Tenants, vendors, owners in one place.', icon: '🏢' },
  { key: 'service_agencies', engine: 'SERVICE_AGENCIES', label: 'Service Agency', tagline: 'Client work, cases and retainers.', icon: '💼' },
];

const COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Australia', 'New Zealand', 'Ireland', 'Other'];
const BUSINESS_SIZES = ['Just me', '2–5 people', '6–15 people', '16–50 people', '50+ people'];

export default function SignupPage() {
  const router = useRouter();
  const [presets, setPresets] = useState(FALLBACK_PRESETS);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('United States');
  const [presetKey, setPresetKey] = useState('hvac');
  const [businessSize, setBusinessSize] = useState('2–5 people');
  const [teamSize, setTeamSize] = useState('2');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.industryPresets().then((p) => { if (p?.length) setPresets(p); }).catch(() => {});
  }, []);

  const selected = useMemo(() => presets.find((p) => p.key === presetKey), [presets, presetKey]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await api.signup({
        name,
        ownerEmail: email,
        ownerPassword: password,
        industryModule: selected?.engine ?? 'FIELD_SERVICES',
        presetKey,
        country,
        businessSize,
        teamSize,
      });
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
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <SofilicMark size={40} animated />
        <h1>Create your Sofilic workspace</h1>
        <p className="sub">Pick your industry and Sofilic configures itself for how your business runs.</p>
        {error && <div className="auth-err">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="name">Business name</label>
            <input
              id="name" type="text" required
              placeholder="Eastside Plumbing Co."
              value={name} onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="country">Country</label>
            <select id="country" value={country} onChange={(e) => setCountry(e.target.value)}>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="industry">Industry</label>
            <select id="industry" value={presetKey} onChange={(e) => setPresetKey(e.target.value)}>
              {presets.map((p) => (
                <option key={p.key} value={p.key}>{p.icon} {p.label}</option>
              ))}
            </select>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{selected?.tagline}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label htmlFor="bsize">Business size</label>
              <select id="bsize" value={businessSize} onChange={(e) => setBusinessSize(e.target.value)}>
                {BUSINESS_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="tsize">Team size</label>
              <input
                id="tsize" type="number" min={1} max={500}
                value={teamSize} onChange={(e) => setTeamSize(e.target.value)}
              />
            </div>
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
          <button className="btn" type="submit" disabled={loading} style={{ width: '100%', marginTop: 6 }}>
            {loading ? 'Configuring your workspace…' : 'Get Started'}
          </button>
        </form>
        <div className="auth-foot">
          Already have a workspace? <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
