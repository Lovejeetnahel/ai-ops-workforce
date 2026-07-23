'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';

type StepId = 'confirm' | 'modules' | 'team' | 'first-lead' | 'integrations' | 'employees' | 'command';
const STEPS: { id: StepId; label: string }[] = [
  { id: 'confirm', label: 'Confirm business' },
  { id: 'modules', label: 'Your modules' },
  { id: 'team', label: 'Invite your team' },
  { id: 'first-lead', label: 'First lead' },
  { id: 'integrations', label: 'Connect tools' },
  { id: 'employees', label: 'AI employees' },
  { id: 'command', label: 'Try a command' },
];

/** Common IANA timezones for North American local-service businesses, plus a
 * few international ones. The API validates whatever is submitted against the
 * real IANA database, so this list is a convenience, not the boundary. */
const TIMEZONES = [
  'America/St_Johns', 'America/Halifax', 'America/Toronto', 'America/Winnipeg',
  'America/Regina', 'America/Edmonton', 'America/Vancouver',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix',
  'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
  'Europe/London', 'Europe/Berlin', 'Australia/Sydney',
];

/**
 * First-time onboarding (expanded in Release 3 to the full first-value flow:
 * business + timezone → modules → optional team invite → optional first lead
 * → optional integrations → AI employee review + authority choice → one safe
 * Command Center run → dashboard). Reached via the post-signup redirect and
 * re-visitable at /onboarding. Every step is skippable; progress persists in
 * Tenant.settings so leaving and coming back doesn't restart it, and nothing
 * here ever blocks reaching the real dashboard. No step fabricates activity —
 * the Command Center step runs a real request through the real gateway.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [tenant, setTenant] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);

  // timezone
  const [timezone, setTimezone] = useState('');
  const [tzError, setTzError] = useState<string | null>(null);
  const [tzSaving, setTzSaving] = useState(false);

  // team invite form
  const [invName, setInvName] = useState('');
  const [invEmail, setInvEmail] = useState('');
  const [invPassword, setInvPassword] = useState('');
  const [invRole, setInvRole] = useState('STAFF');
  const [invSaving, setInvSaving] = useState(false);
  const [invError, setInvError] = useState<string | null>(null);
  const [invited, setInvited] = useState<string[]>([]);

  // lead form
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadSaved, setLeadSaved] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // AI employees + authority
  const [employees, setEmployees] = useState<any[] | null>(null);
  const [authority, setAuthority] = useState<'APPROVE' | 'AUTONOMOUS'>('APPROVE');
  const [authoritySaving, setAuthoritySaving] = useState(false);
  const [authorityError, setAuthorityError] = useState<string | null>(null);

  // Command Center trial run
  const [cmdText, setCmdText] = useState("Show today's priorities");
  const [cmdRunning, setCmdRunning] = useState(false);
  const [cmdResult, setCmdResult] = useState<any>(null);
  const [cmdError, setCmdError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.currentTenant().catch(() => null), api.moduleConfig().catch(() => null)]).then(([t, c]) => {
      setTenant(t);
      setConfig(c);
      setTimezone(t?.timezone || 'America/Toronto');
      const progress = t?.settings?.onboardingProgress;
      if (progress?.dashboardReached) {
        router.replace('/dashboard');
        return;
      }
      const done: string[] = progress?.completedSteps ?? [];
      const firstIncomplete = STEPS.findIndex((s) => !done.includes(s.id));
      setStep(firstIncomplete === -1 ? 0 : firstIncomplete);
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the roster lazily when the employees step is first shown.
  useEffect(() => {
    if (loaded && STEPS[step].id === 'employees' && employees === null) {
      api.employees().then(setEmployees).catch(() => setEmployees([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, loaded]);

  const leadVocab = config?.entities?.find((e: any) => e.backing === 'lead');
  const leadSingular = leadVocab?.singular ?? 'lead';
  const isFieldService = tenant?.industryModule === 'FIELD_SERVICES';
  const detectedTz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';
  const tzOptions = detectedTz && !TIMEZONES.includes(detectedTz) ? [detectedTz, ...TIMEZONES] : TIMEZONES;

  const markComplete = async (id: StepId) => {
    await api.updateOnboarding({ completedSteps: [id] }).catch(() => undefined);
  };

  const goNext = async (id: StepId) => {
    await markComplete(id);
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish();
  };

  const finish = async () => {
    await api.updateOnboarding({ dashboardReached: true }).catch(() => undefined);
    router.push('/dashboard');
  };

  const skipAll = async () => {
    await api.updateOnboarding({ skipped: true, dashboardReached: true }).catch(() => undefined);
    router.push('/dashboard');
  };

  const confirmBusiness = async () => {
    setTzError(null);
    if (timezone && timezone !== tenant?.timezone) {
      setTzSaving(true);
      try {
        await api.patchTenantProfile({ timezone });
      } catch {
        // Saving the timezone is best-effort here (e.g. an invited admin
        // re-visiting onboarding isn't the owner) — say so and move on
        // rather than blocking the whole flow.
        setTzError('Could not save the timezone — you can set it later in Settings.');
      } finally {
        setTzSaving(false);
      }
    }
    await goNext('confirm');
  };

  const sendInvite = async () => {
    if (!invName.trim() || !invEmail.trim() || !invPassword) return;
    setInvSaving(true);
    setInvError(null);
    try {
      await api.inviteStaff({ name: invName.trim(), email: invEmail.trim(), password: invPassword, role: invRole });
      setInvited((prev) => [...prev, invEmail.trim()]);
      setInvName(''); setInvEmail(''); setInvPassword('');
    } catch (e: any) {
      setInvError(e?.message || 'Could not add that teammate — you can invite them later from Settings.');
    } finally {
      setInvSaving(false);
    }
  };

  const saveLead = async () => {
    if (!leadName.trim()) return;
    setSaving(true);
    setLeadError(null);
    try {
      await api.createLead({ contactName: leadName.trim(), phone: leadPhone.trim() || undefined });
      setLeadSaved(true);
    } catch {
      setLeadError('Could not save that — you can add it later from CRM instead.');
    } finally {
      setSaving(false);
    }
  };

  const applyAuthority = async () => {
    setAuthoritySaving(true);
    setAuthorityError(null);
    try {
      // Persist the explicit choice on every roster employee. APPROVE matches
      // the platform default, but recording it makes the choice deliberate.
      const keys = (employees ?? []).map((e) => e.key);
      const results = await Promise.allSettled(keys.map((k) => api.installEmployee(k, { authority })));
      if (results.some((r) => r.status === 'rejected')) {
        setAuthorityError('Could not save that for every employee — you can adjust each one on the AI Workforce page.');
        return;
      }
      await goNext('employees');
    } finally {
      setAuthoritySaving(false);
    }
  };

  const runFirstCommand = async () => {
    const text = cmdText.trim();
    if (text.length < 2) return;
    setCmdRunning(true);
    setCmdError(null);
    setCmdResult(null);
    try {
      const res = await api.runCommand(text);
      setCmdResult(res);
    } catch (e: any) {
      setCmdError(e?.message || 'That run failed — you can try again from the AI Workforce page.');
    } finally {
      setCmdRunning(false);
    }
  };

  if (!loaded) {
    return (
      <div className="panel">
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Welcome to Sofilic{tenant?.name ? `, ${tenant.name}` : ''}</h2>
          <span className="muted">A few quick steps to get set up — skip anything, anytime.</span>
        </div>
        <button className="btn ghost sm" onClick={skipAll}>Skip for now</button>
      </div>

      <div className="tabs">
        {STEPS.map((s, i) => (
          <button key={s.id} className={`tab ${i === step ? 'active' : ''}`} onClick={() => setStep(i)}>
            {i + 1}. {s.label}
          </button>
        ))}
      </div>

      {STEPS[step].id === 'confirm' && (
        <div className="panel">
          <h3>Confirm your business details</h3>
          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div className="field"><label>Business name</label><input value={tenant?.name ?? ''} disabled /></div>
            <div className="field"><label>Industry</label><input value={config?.label ?? tenant?.industryModule ?? ''} disabled /></div>
          </div>
          <div className="field" style={{ marginBottom: 12, maxWidth: 360 }}>
            <label>Timezone</label>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {tzOptions.map((tz) => (
                <option key={tz} value={tz}>{tz}{tz === detectedTz ? ' (detected)' : ''}</option>
              ))}
            </select>
            <span className="muted" style={{ fontSize: 12 }}>
              Scheduled AI employee runs and daily summaries follow this timezone.
            </span>
          </div>
          {tzError && <div className="auth-err">{tzError}</div>}
          <p className="muted">{config?.tagline}</p>
          <button className="btn" disabled={tzSaving} onClick={confirmBusiness}>{tzSaving ? 'Saving…' : 'Looks good, continue'}</button>
        </div>
      )}

      {STEPS[step].id === 'modules' && (
        <div className="panel">
          <h3>Your modules are ready</h3>
          <p className="muted" style={{ marginBottom: 16 }}>
            Sofilic configured itself for {config?.label ?? 'your industry'} — every tenant shares the same
            platform, just with the right vocabulary and starter automations.
          </p>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 20 }}>
            {[
              ['◈', 'CRM', 'Contacts, companies and tasks'],
              ['▲', 'Sales', `Your ${leadVocab?.plural ?? 'leads'} pipeline`],
              ['⟳', 'Automation', 'Seeded recipes for your industry'],
              ['▭', 'Payments', 'Invoices and estimates'],
              ...(isFieldService ? [['▣', 'Apps → Field Operations', 'Job tracking for your team']] : []),
            ].map(([ico, name, desc]) => (
              <div className="card" key={name}>
                <span className="ico" style={{ fontSize: 18 }}>{ico}</span>
                <div className="name" style={{ marginTop: 8, fontWeight: 600 }}>{name}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>{desc}</div>
              </div>
            ))}
          </div>
          <button className="btn" onClick={() => goNext('modules')}>Next</button>
        </div>
      )}

      {STEPS[step].id === 'team' && (
        <div className="panel">
          <h3>Invite your team (optional)</h3>
          <p className="muted" style={{ marginBottom: 16 }}>
            Add teammates now or later from Settings → Team. They sign in with the temporary password
            you set here and should change it after first login.
          </p>
          {invited.length > 0 && (
            <div className="empty-state" style={{ padding: '12px 16px', marginBottom: 12 }}>
              <p style={{ margin: 0 }}>✓ Added: {invited.join(', ')}</p>
            </div>
          )}
          {invError && <div className="auth-err">{invError}</div>}
          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div className="field"><label>Name</label><input value={invName} onChange={(e) => setInvName(e.target.value)} placeholder="Alex Dispatcher" /></div>
            <div className="field"><label>Email</label><input type="email" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} placeholder="alex@yourbusiness.com" /></div>
            <div className="field"><label>Temporary password</label><input type="password" value={invPassword} onChange={(e) => setInvPassword(e.target.value)} placeholder="At least 8 characters, a letter and a number" /></div>
            <div className="field">
              <label>Role</label>
              <select value={invRole} onChange={(e) => setInvRole(e.target.value)}>
                <option value="STAFF">Staff — day-to-day work</option>
                <option value="ADMIN">Admin — manage settings and AI approvals</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" disabled={invSaving || !invName.trim() || !invEmail.trim() || !invPassword} onClick={sendInvite}>
              {invSaving ? 'Adding…' : 'Add teammate'}
            </button>
            <button className="btn ghost" onClick={() => goNext('team')}>{invited.length ? 'Continue' : 'Skip this step'}</button>
          </div>
        </div>
      )}

      {STEPS[step].id === 'first-lead' && (
        <div className="panel">
          <h3>Add your first {leadSingular.toLowerCase()}</h3>
          {leadSaved ? (
            <div className="empty-state" style={{ padding: '24px 16px' }}>
              <div className="e-ico">✓</div>
              <h4>Added</h4>
              <p>You can see it in CRM → Contacts any time.</p>
              <button className="btn sm" onClick={() => goNext('first-lead')}>Next</button>
            </div>
          ) : (
            <>
              <p className="muted" style={{ marginBottom: 16 }}>
                Try it out — add a real {leadSingular.toLowerCase()} now, or skip and add one later from CRM.
              </p>
              {leadError && <div className="auth-err">{leadError}</div>}
              <div className="grid-2" style={{ marginBottom: 12 }}>
                <div className="field"><label>Name</label><input value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="Jane Customer" /></div>
                <div className="field"><label>Phone (optional)</label><input value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} placeholder="+1 555 000 0000" /></div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn" disabled={!leadName.trim() || saving} onClick={saveLead}>{saving ? 'Saving…' : 'Add & continue'}</button>
                <button className="btn ghost" onClick={() => goNext('first-lead')}>Skip this step</button>
              </div>
            </>
          )}
        </div>
      )}

      {STEPS[step].id === 'integrations' && (
        <div className="panel">
          <h3>Connect the tools you use (optional)</h3>
          <p className="muted" style={{ marginBottom: 16 }}>
            These connect from Settings whenever you&rsquo;re ready — nothing here is required to start using Sofilic.
          </p>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 20 }}>
            <div className="card"><span className="ico" style={{ fontSize: 18 }}>💳</span><div className="name" style={{ marginTop: 8, fontWeight: 600 }}>Stripe</div><div className="muted" style={{ fontSize: 12.5 }}>Payments & invoicing</div></div>
            <div className="card"><span className="ico" style={{ fontSize: 18 }}>💬</span><div className="name" style={{ marginTop: 8, fontWeight: 600 }}>Twilio</div><div className="muted" style={{ fontSize: 12.5 }}>SMS messaging</div></div>
            <div className="card"><span className="ico" style={{ fontSize: 18 }}>✉️</span><div className="name" style={{ marginTop: 8, fontWeight: 600 }}>SendGrid</div><div className="muted" style={{ fontSize: 12.5 }}>Email delivery</div></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/settings" className="btn ghost">Go to Settings</Link>
            <button className="btn" onClick={() => goNext('integrations')}>Next</button>
          </div>
        </div>
      )}

      {STEPS[step].id === 'employees' && (
        <div className="panel">
          <h3>Meet your AI employees</h3>
          <p className="muted" style={{ marginBottom: 16 }}>
            These roles are ready to work in your account. Decide how much authority they start with —
            you can change this per employee any time on the AI Workforce page.
          </p>
          {employees === null ? (
            <div className="skeleton" style={{ height: 120, marginBottom: 16 }} />
          ) : (
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 20 }}>
              {employees.map((e) => (
                <div className="card" key={e.key}>
                  <div className="name" style={{ fontWeight: 600 }}>{e.name}</div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{e.department}</div>
                  <div className="muted" style={{ fontSize: 12.5 }}>{e.description}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, maxWidth: 560 }}>
            <label className="card" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="radio" name="authority" checked={authority === 'APPROVE'} onChange={() => setAuthority('APPROVE')} style={{ marginTop: 3 }} />
              <span>
                <strong>Ask me first (recommended)</strong>
                <span className="muted" style={{ display: 'block', fontSize: 12.5 }}>
                  Internal work happens automatically, but anything with outside impact — messages,
                  documents, payment links — waits in your approval queue.
                </span>
              </span>
            </label>
            <label className="card" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="radio" name="authority" checked={authority === 'AUTONOMOUS'} onChange={() => setAuthority('AUTONOMOUS')} style={{ marginTop: 3 }} />
              <span>
                <strong>Act on their own</strong>
                <span className="muted" style={{ display: 'block', fontSize: 12.5 }}>
                  Employees send messages and documents without waiting for approval, within the
                  permissions each role has. You can still watch everything they do.
                </span>
              </span>
            </label>
          </div>
          {authorityError && <div className="auth-err">{authorityError}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn" disabled={authoritySaving || employees === null} onClick={applyAuthority}>
              {authoritySaving ? 'Saving…' : 'Save & continue'}
            </button>
            <button className="btn ghost" onClick={() => goNext('employees')}>Skip — decide later</button>
          </div>
        </div>
      )}

      {STEPS[step].id === 'command' && (
        <div className="panel">
          <h3>Try one Command Center request</h3>
          <p className="muted" style={{ marginBottom: 16 }}>
            Type a request in plain language and Sofilic plans it against your real data. Read-only
            requests like the one below are always safe; anything with outside impact respects the
            authority you just chose.
          </p>
          {cmdError && <div className="auth-err">{cmdError}</div>}
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Your request</label>
            <input value={cmdText} onChange={(e) => setCmdText(e.target.value)} maxLength={2000} />
          </div>
          {cmdResult && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                {cmdResult.runId ? `Run ${cmdResult.runId}` : 'Run complete'}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5 }}>
                {(cmdResult.output as any)?.response ?? (cmdResult as any).summary ?? 'Done — see AI Workforce for the full record.'}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            {cmdResult ? (
              <button className="btn" onClick={async () => { await markComplete('command'); finish(); }}>Finish — take me to my dashboard</button>
            ) : (
              <>
                <button className="btn" disabled={cmdRunning || cmdText.trim().length < 2} onClick={runFirstCommand}>
                  {cmdRunning ? 'Running…' : 'Run it'}
                </button>
                <button className="btn ghost" onClick={finish}>Skip — take me to the dashboard</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
