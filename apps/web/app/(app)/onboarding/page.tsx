'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';

type StepId = 'confirm' | 'modules' | 'first-lead' | 'integrations';
const STEPS: { id: StepId; label: string }[] = [
  { id: 'confirm', label: 'Confirm business' },
  { id: 'modules', label: 'Your modules' },
  { id: 'first-lead', label: 'First lead' },
  { id: 'integrations', label: 'Connect tools' },
];

/**
 * First-time onboarding (Website Release 2). Not a Rev-2 sidebar item —
 * reached only via the post-signup redirect (and re-visitable directly at
 * /onboarding). Adapts its copy to the tenant's resolved module config
 * (vocabulary, industry label) instead of hardcoding one industry's terms.
 * Every step is skippable; progress persists in Tenant.settings so leaving
 * and coming back doesn't restart it, and nothing here ever blocks reaching
 * the real dashboard.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [tenant, setTenant] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [loaded, setLoaded] = useState(false);

  // lead form
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadSaved, setLeadSaved] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.currentTenant().catch(() => null), api.moduleConfig().catch(() => null)]).then(([t, c]) => {
      setTenant(t);
      setConfig(c);
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

  const leadVocab = config?.entities?.find((e: any) => e.backing === 'lead');
  const leadSingular = leadVocab?.singular ?? 'lead';
  const isFieldService = tenant?.industryModule === 'FIELD_SERVICES';

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
          <div className="grid-2" style={{ marginBottom: 20 }}>
            <div className="field"><label>Business name</label><input value={tenant?.name ?? ''} disabled /></div>
            <div className="field"><label>Industry</label><input value={config?.label ?? tenant?.industryModule ?? ''} disabled /></div>
          </div>
          <p className="muted">{config?.tagline}</p>
          <button className="btn" onClick={() => goNext('confirm')}>Looks good, continue</button>
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
          <h3>Connect the tools you use</h3>
          <p className="muted" style={{ marginBottom: 16 }}>
            These connect from Settings whenever you&rsquo;re ready — nothing here is required to start using Sofilic.
          </p>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 20 }}>
            <div className="card"><span className="ico" style={{ fontSize: 18 }}>💳</span><div className="name" style={{ marginTop: 8, fontWeight: 600 }}>Stripe</div><div className="muted" style={{ fontSize: 12.5 }}>Payments & invoicing</div></div>
            <div className="card"><span className="ico" style={{ fontSize: 18 }}>💬</span><div className="name" style={{ marginTop: 8, fontWeight: 600 }}>Twilio</div><div className="muted" style={{ fontSize: 12.5 }}>SMS messaging</div></div>
            <div className="card"><span className="ico" style={{ fontSize: 18 }}>✉️</span><div className="name" style={{ marginTop: 8, fontWeight: 600 }}>SendGrid</div><div className="muted" style={{ fontSize: 12.5 }}>Email delivery</div></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/settings" className="btn">Go to Settings</Link>
            <button className="btn ghost" onClick={finish}>Skip — take me to the dashboard</button>
          </div>
        </div>
      )}
    </>
  );
}
