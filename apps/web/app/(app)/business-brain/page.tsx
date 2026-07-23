'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';

/**
 * Business Brain (Sprint 1) — the single source of truth every AI employee
 * reads: company profile, business memory, goals, KPIs and the executive
 * dashboard. Every number on this page is derived from real tenant data;
 * empty states are honest and say what to do next. Reads are visible to the
 * whole team; writes and the executive view are ADMIN+ (server-enforced —
 * this page just surfaces the 403 honestly).
 */

type TabId = 'executive' | 'goals' | 'kpis' | 'profile' | 'memory';
const TABS: { id: TabId; label: string }[] = [
  { id: 'executive', label: 'Executive' },
  { id: 'goals', label: 'Goals' },
  { id: 'kpis', label: 'KPIs' },
  { id: 'profile', label: 'Company Profile' },
  { id: 'memory', label: 'Business Memory' },
];

const GOAL_HEALTH_CHIP: Record<string, string> = { ON_TRACK: 'ok', AT_RISK: 'warn', OVERDUE: 'err', DONE: 'ok', INACTIVE: 'muted' };
const KPI_HEALTH_CHIP: Record<string, string> = { HEALTHY: 'ok', WATCH: 'warn', AT_RISK: 'err', UNTRACKED: 'muted' };
const TREND_ARROW: Record<string, string> = { UP: '▲', DOWN: '▼', FLAT: '▬', UNKNOWN: '·' };
const METRIC_KEYS = ['revenue', 'cost', 'net_value', 'outstanding_invoices', 'avg_job_value', 'leads_new', 'leads_won', 'conversion_rate', 'pipeline_value', 'jobs_completed', 'jobs_open', 'active_staff'];
const MEMORY_TYPES = ['POLICY', 'FAQ', 'PRICING', 'SERVICE', 'SOP', 'NOTE'];
const DEPARTMENTS = ['Sales', 'Finance', 'Operations', 'Marketing', 'Customer Success', 'People', 'Front Office', 'Leadership'];

function fmtValue(v: number | null | undefined, unit?: string | null): string {
  if (v === null || v === undefined) return '—';
  const n = Math.abs(v) >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return unit === '$' ? `$${n}` : unit ? `${n} ${unit}` : n;
}

export default function BusinessBrainPage() {
  const [tab, setTab] = useState<TabId>('executive');
  const [notice, setNotice] = useState<string | null>(null);

  const fail = useCallback((e: unknown, what: string) => {
    const msg = String((e as Error)?.message ?? '');
    setNotice(msg.startsWith('403') ? `Only admins and owners can ${what}.` : `Could not ${what} — nothing was changed.`);
  }, []);

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Business Brain</h2>
          <span className="muted">What your business is, knows and is working toward — every AI employee reads this.</span>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => { setTab(t.id); setNotice(null); }}>
            {t.label}
          </button>
        ))}
      </div>

      {notice && <div className="auth-err">{notice}</div>}

      {tab === 'executive' && <ExecutiveTab onError={fail} />}
      {tab === 'goals' && <GoalsTab onError={fail} />}
      {tab === 'kpis' && <KpisTab onError={fail} />}
      {tab === 'profile' && <ProfileTab onError={fail} />}
      {tab === 'memory' && <MemoryTab onError={fail} />}
    </>
  );
}

// ── Executive dashboard ──────────────────────────────────────────────────────

function ExecutiveTab({ onError }: { onError: (e: unknown, what: string) => void }) {
  const [data, setData] = useState<any>(undefined);
  useEffect(() => {
    api.executiveDashboard().then(setData).catch((e) => { setData(null); onError(e, 'view the executive dashboard'); });
  }, [onError]);

  if (data === undefined) return <div className="panel"><div className="skeleton" style={{ height: 180 }} /></div>;
  if (data === null) return <div className="panel"><p className="muted">The executive dashboard is available to admins and owners.</p></div>;

  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: 16 }}>
        <div className="panel" style={{ textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 12 }}>Business Health</div>
          <div style={{ fontSize: 42, fontWeight: 700 }}>{data.healthScore}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            goals {data.healthComponents.goals}/40 · KPIs {data.healthComponents.kpis}/40 · ops {data.healthComponents.operations}/20
          </div>
        </div>
        <div className="panel" style={{ textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 12 }}>Active goals</div>
          <div style={{ fontSize: 42, fontWeight: 700 }}>{data.goals.active.length}</div>
          <div className="muted" style={{ fontSize: 12 }}>{data.goals.atRiskCount} at risk · {data.goals.achievedCount} achieved</div>
        </div>
        <div className="panel" style={{ textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 12 }}>Tracked KPIs</div>
          <div style={{ fontSize: 42, fontWeight: 700 }}>{data.kpis.length}</div>
          <div className="muted" style={{ fontSize: 12 }}>{data.kpis.filter((k: any) => k.health === 'AT_RISK').length} off target</div>
        </div>
        <div className="panel" style={{ textAlign: 'center' }}>
          <div className="muted" style={{ fontSize: 12 }}>Pending AI approvals</div>
          <div style={{ fontSize: 42, fontWeight: 700 }}>{data.pendingApprovals.length}</div>
          <Link href="/ai-workforce" className="muted" style={{ fontSize: 12 }}>review in AI Workforce →</Link>
        </div>
      </div>

      {data.kpis.length > 0 && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <h3>KPI trends</h3>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {data.kpis.map((k: any) => (
              <div className="card" key={k.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span className="name" style={{ fontWeight: 600 }}>{k.name}</span>
                  <span className={`chip ${KPI_HEALTH_CHIP[k.health] ?? 'muted'}`}>{k.health.replace('_', ' ').toLowerCase()}</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, margin: '6px 0 2px' }}>
                  {TREND_ARROW[k.trend]} {fmtValue(k.currentValue, k.unit)}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  target {fmtValue(k.targetValue, k.unit)}{k.attainmentPct !== null ? ` · ${k.attainmentPct}%` : ''}
                  {k.metricKey ? ` · auto (${k.metricKey}, ${k.metricWindowDays}d)` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="panel">
          <h3>Risks</h3>
          {data.risks.length === 0 ? (
            <p className="muted">No open risks detected from your goals, KPIs, invoices or AI tasks.</p>
          ) : (
            data.risks.map((r: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 8 }}>
                <span className={`chip ${r.severity === 'HIGH' ? 'err' : 'warn'}`}>{r.severity.toLowerCase()}</span>
                <span><strong>{r.title}</strong> <span className="muted">{r.detail}</span></span>
              </div>
            ))
          )}
        </div>
        <div className="panel">
          <h3>Opportunities</h3>
          {data.opportunities.length === 0 ? (
            <p className="muted">Nothing actionable is sitting idle right now.</p>
          ) : (
            data.opportunities.map((o: any, i: number) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <strong>{o.title}</strong> <span className="muted">{o.detail}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <h3>Recommendations</h3>
        {data.recommendations.length === 0 ? (
          <p className="muted">Nothing urgent — goals, KPIs and operations all look in order.</p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {data.recommendations.map((r: string, i: number) => <li key={i} style={{ marginBottom: 6 }}>{r}</li>)}
          </ol>
        )}
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Derived from your live goals, KPIs, invoices, leads and approvals — not generated filler.
        </p>
      </div>
    </>
  );
}

// ── Goals ────────────────────────────────────────────────────────────────────

function GoalsTab({ onError }: { onError: (e: unknown, what: string) => void }) {
  const [goals, setGoals] = useState<any[] | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ title: '', description: '', priority: 'MEDIUM', department: '', dueAt: '', agentKeys: [] });

  const refresh = useCallback(() => {
    api.goals().then(setGoals).catch(() => setGoals([]));
    api.employees().then(setEmployees).catch(() => setEmployees([]));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const create = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await api.createGoal({
        title: form.title, description: form.description || undefined, priority: form.priority,
        department: form.department || undefined, dueAt: form.dueAt || undefined,
        agentKeys: form.agentKeys.length ? form.agentKeys : undefined,
      });
      setForm({ title: '', description: '', priority: 'MEDIUM', department: '', dueAt: '', agentKeys: [] });
      setShowForm(false);
      refresh();
    } catch (e) { onError(e, 'create that goal'); } finally { setSaving(false); }
  };

  const setProgress = async (g: any, progress: number) => {
    try { await api.setGoalProgress(g.id, progress); refresh(); } catch (e) { onError(e, 'update goal progress'); }
  };

  const archive = async (g: any) => {
    try { await api.archiveGoal(g.id); refresh(); } catch (e) { onError(e, 'archive that goal'); }
  };

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Goals</h3>
        <button className="btn sm" onClick={() => setShowForm(!showForm)}>{showForm ? 'Close' : 'New goal'}</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div className="grid-2" style={{ marginBottom: 10 }}>
            <div className="field"><label>Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Book 30 jobs this quarter" /></div>
            <div className="field">
              <label>Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Department (optional)</label>
              <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                <option value="">Company-wide</option>
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="field"><label>Due date (optional)</label><input type="date" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} /></div>
          </div>
          <div className="field" style={{ marginBottom: 10 }}>
            <label>Description (optional)</label>
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>AI employees supporting this goal (optional)</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {employees.map((emp) => {
                const on = form.agentKeys.includes(emp.key);
                return (
                  <button key={emp.key} type="button" className={`chip ${on ? 'ok' : 'muted'}`} style={{ cursor: 'pointer' }}
                    onClick={() => setForm({ ...form, agentKeys: on ? form.agentKeys.filter((k: string) => k !== emp.key) : [...form.agentKeys, emp.key] })}>
                    {emp.name}
                  </button>
                );
              })}
            </div>
          </div>
          <button className="btn" disabled={saving || !form.title.trim()} onClick={create}>{saving ? 'Saving…' : 'Create goal'}</button>
        </div>
      )}

      {goals === null ? (
        <div className="skeleton" style={{ height: 120 }} />
      ) : goals.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 16px' }}>
          <div className="e-ico">◉</div>
          <h4>No goals yet</h4>
          <p>Define your first goal — every AI employee will see it and work toward it.</p>
        </div>
      ) : (
        goals.filter((g) => g.status !== 'ARCHIVED').map((g) => (
          <div className="card" key={g.id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <strong>{g.title}</strong>
                <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                  {g.priority.toLowerCase()} · {g.department ?? 'company-wide'}{g.dueAt ? ` · due ${String(g.dueAt).slice(0, 10)}` : ''}
                </span>
              </div>
              <span className={`chip ${GOAL_HEALTH_CHIP[g.health] ?? 'muted'}`}>{g.health.replace('_', ' ').toLowerCase()}</span>
            </div>
            {g.description && <div className="muted" style={{ fontSize: 13, margin: '6px 0' }}>{g.description}</div>}
            {g.agentKeys?.length > 0 && (
              <div className="muted" style={{ fontSize: 12, margin: '4px 0' }}>AI: {g.agentKeys.join(', ')}</div>
            )}
            {g.kpis?.length > 0 && (
              <div className="muted" style={{ fontSize: 12, margin: '4px 0' }}>KPIs: {g.kpis.map((k: any) => k.name).join(', ')}</div>
            )}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              <input type="range" min={0} max={100} defaultValue={g.progress} style={{ flex: 1, minWidth: 120 }}
                onMouseUp={(e) => setProgress(g, Number((e.target as HTMLInputElement).value))}
                onTouchEnd={(e) => setProgress(g, Number((e.target as HTMLInputElement).value))} />
              <span style={{ minWidth: 44, fontWeight: 600 }}>{g.progress}%</span>
              <button className="btn ghost sm" onClick={() => archive(g)}>Archive</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── KPIs ─────────────────────────────────────────────────────────────────────

function KpisTab({ onError }: { onError: (e: unknown, what: string) => void }) {
  const [kpis, setKpis] = useState<any[] | null>(null);
  const [goals, setGoals] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ name: '', unit: '', direction: 'UP_IS_GOOD', metricKey: '', targetValue: '', goalId: '' });
  const [manualValue, setManualValue] = useState<Record<string, string>>({});

  const refresh = useCallback(() => {
    api.kpis().then(setKpis).catch(() => setKpis([]));
    api.goals().then(setGoals).catch(() => setGoals([]));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const create = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await api.createKpi({
        name: form.name, unit: form.unit || undefined, direction: form.direction,
        metricKey: form.metricKey || undefined,
        targetValue: form.targetValue === '' ? undefined : Number(form.targetValue),
        goalId: form.goalId || undefined,
      });
      setForm({ name: '', unit: '', direction: 'UP_IS_GOOD', metricKey: '', targetValue: '', goalId: '' });
      setShowForm(false);
      refresh();
    } catch (e) { onError(e, 'create that KPI'); } finally { setSaving(false); }
  };

  const record = async (k: any) => {
    const raw = manualValue[k.id];
    if (raw === undefined || raw === '') return;
    try {
      await api.recordKpiValue(k.id, Number(raw));
      setManualValue({ ...manualValue, [k.id]: '' });
      refresh();
    } catch (e) { onError(e, 'record that KPI value'); }
  };

  const remove = async (k: any) => {
    try { await api.deleteKpi(k.id); refresh(); } catch (e) { onError(e, 'delete that KPI'); }
  };

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>KPIs</h3>
        <button className="btn sm" onClick={() => setShowForm(!showForm)}>{showForm ? 'Close' : 'New KPI'}</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div className="field"><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Monthly revenue" /></div>
            <div className="field">
              <label>Source</label>
              <select value={form.metricKey} onChange={(e) => setForm({ ...form, metricKey: e.target.value })}>
                <option value="">Manual — I record values myself</option>
                {METRIC_KEYS.map((k) => <option key={k} value={k}>Auto from platform data: {k}</option>)}
              </select>
            </div>
            <div className="field"><label>Unit (optional)</label><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="$ / % / leads" /></div>
            <div className="field">
              <label>Direction</label>
              <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
                <option value="UP_IS_GOOD">Higher is better</option>
                <option value="DOWN_IS_GOOD">Lower is better</option>
              </select>
            </div>
            <div className="field"><label>Target (optional)</label><input type="number" value={form.targetValue} onChange={(e) => setForm({ ...form, targetValue: e.target.value })} /></div>
            <div className="field">
              <label>Linked goal (optional)</label>
              <select value={form.goalId} onChange={(e) => setForm({ ...form, goalId: e.target.value })}>
                <option value="">None</option>
                {goals.filter((g) => g.status === 'ACTIVE').map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
          </div>
          <button className="btn" disabled={saving || !form.name.trim()} onClick={create}>{saving ? 'Saving…' : 'Create KPI'}</button>
        </div>
      )}

      {kpis === null ? (
        <div className="skeleton" style={{ height: 120 }} />
      ) : kpis.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 16px' }}>
          <div className="e-ico">📈</div>
          <h4>No KPIs yet</h4>
          <p>Add a KPI — bind it to real platform data (revenue, leads, jobs) or record values yourself.</p>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {kpis.map((k) => (
            <div className="card" key={k.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong>{k.name}</strong>
                <span className={`chip ${KPI_HEALTH_CHIP[k.health] ?? 'muted'}`}>{k.health.replace('_', ' ').toLowerCase()}</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, margin: '6px 0 2px' }}>
                {TREND_ARROW[k.trend]} {fmtValue(k.currentValue, k.unit)}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                target {fmtValue(k.targetValue, k.unit)}{k.attainmentPct !== null ? ` · ${k.attainmentPct}% attained` : ' · set a target to track health'}
              </div>
              <div className="muted" style={{ fontSize: 12, margin: '4px 0' }}>
                {k.metricKey ? `Auto from real data: ${k.metricKey} (last ${k.metricWindowDays} days)` : 'Manual values'}
                {k.goal ? ` · goal: ${k.goal.title}` : ''}
                {` · ${k.snapshots?.length ?? 0} recorded value(s)`}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {!k.metricKey && (
                  <>
                    <input type="number" placeholder="New value" style={{ width: 110 }} value={manualValue[k.id] ?? ''}
                      onChange={(e) => setManualValue({ ...manualValue, [k.id]: e.target.value })} />
                    <button className="btn ghost sm" onClick={() => record(k)}>Record</button>
                  </>
                )}
                <button className="btn ghost sm" onClick={() => remove(k)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Company profile ──────────────────────────────────────────────────────────

const PROFILE_FIELDS: { key: string; label: string; rows?: number; placeholder: string }[] = [
  { key: 'brandName', label: 'Brand name', placeholder: 'The name customers know you by' },
  { key: 'legalName', label: 'Legal name', placeholder: 'Registered business name' },
  { key: 'tagline', label: 'Tagline', placeholder: 'One line on what you do' },
  { key: 'mission', label: 'Mission', rows: 2, placeholder: 'Why this business exists' },
  { key: 'vision', label: 'Vision', rows: 2, placeholder: 'Where it is going' },
  { key: 'brandVoice', label: 'Brand voice', rows: 2, placeholder: 'How every AI employee should sound — e.g. friendly, direct, no jargon' },
  { key: 'targetMarket', label: 'Target market', rows: 2, placeholder: 'Who you serve and where' },
];
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function ProfileTab({ onError }: { onError: (e: unknown, what: string) => void }) {
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rules, setRules] = useState('');
  const [hours, setHours] = useState<Record<string, string>>({});
  const [locations, setLocations] = useState<{ label: string; address: string; phone: string }[]>([]);

  useEffect(() => {
    api.brainProfile().then((p) => {
      setProfile(p);
      setRules((p.businessRules ?? []).join('\n'));
      setHours(Object.fromEntries(DAYS.map((d) => [d, (p.workingHours ?? {})[d] ?? ''])));
      setLocations((p.locations ?? []).map((l: any) => ({ label: l.label ?? '', address: l.address ?? '', phone: l.phone ?? '' })));
    }).catch(() => setProfile(false));
  }, []);

  if (profile === null) return <div className="panel"><div className="skeleton" style={{ height: 180 }} /></div>;
  if (profile === false) return <div className="panel"><p className="muted">Could not load the company profile.</p></div>;

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const patch: Record<string, unknown> = {};
      for (const f of PROFILE_FIELDS) patch[f.key] = profile[f.key] ?? '';
      patch.businessRules = rules.split('\n').map((r) => r.trim()).filter(Boolean);
      patch.workingHours = Object.fromEntries(DAYS.filter((d) => hours[d]?.trim()).map((d) => [d, hours[d].trim()]));
      patch.locations = locations.filter((l) => l.label.trim() || l.address.trim());
      await api.patchBrainProfile(patch);
      setSaved(true);
    } catch (e) { onError(e, 'save the company profile'); } finally { setSaving(false); }
  };

  return (
    <div className="panel">
      <h3>Company profile</h3>
      <p className="muted" style={{ marginBottom: 16 }}>
        Injected into every AI employee&rsquo;s context — identity, voice and standing rules. Business name and
        timezone come from <Link href="/settings" style={{ color: 'var(--cyan)' }}>Settings</Link>:{' '}
        <strong>{profile.businessName}</strong> · {profile.timezone}.
      </p>

      <div className="grid-2" style={{ marginBottom: 12 }}>
        {PROFILE_FIELDS.map((f) => (
          <div className="field" key={f.key} style={f.rows ? { gridColumn: 'span 1' } : undefined}>
            <label>{f.label}</label>
            {f.rows ? (
              <textarea rows={f.rows} value={profile[f.key] ?? ''} placeholder={f.placeholder}
                onChange={(e) => setProfile({ ...profile, [f.key]: e.target.value })} />
            ) : (
              <input value={profile[f.key] ?? ''} placeholder={f.placeholder}
                onChange={(e) => setProfile({ ...profile, [f.key]: e.target.value })} />
            )}
          </div>
        ))}
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>Business rules — one per line (every AI employee must follow these)</label>
        <textarea rows={4} value={rules} placeholder={'Never discount more than 10%\nAlways offer the maintenance plan on jobs over $500'}
          onChange={(e) => setRules(e.target.value)} />
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>Working hours (e.g. 8:00–17:00, or leave blank for closed)</label>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
          {DAYS.map((d) => (
            <div key={d} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span className="muted" style={{ width: 34, textTransform: 'uppercase', fontSize: 11 }}>{d}</span>
              <input value={hours[d] ?? ''} placeholder="closed" onChange={(e) => setHours({ ...hours, [d]: e.target.value })} />
            </div>
          ))}
        </div>
      </div>

      <div className="field" style={{ marginBottom: 16 }}>
        <label>Locations</label>
        {locations.map((l, i) => (
          <div key={i} className="grid" style={{ gridTemplateColumns: '1fr 2fr 1fr auto', gap: 8, marginBottom: 6 }}>
            <input value={l.label} placeholder="Label (Main shop)" onChange={(e) => setLocations(locations.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
            <input value={l.address} placeholder="Address" onChange={(e) => setLocations(locations.map((x, j) => j === i ? { ...x, address: e.target.value } : x))} />
            <input value={l.phone} placeholder="Phone (optional)" onChange={(e) => setLocations(locations.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))} />
            <button className="btn ghost sm" onClick={() => setLocations(locations.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button className="btn ghost sm" onClick={() => setLocations([...locations, { label: '', address: '', phone: '' }])}>+ Add location</button>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button className="btn" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save profile'}</button>
        {saved && <span className="chip ok">Saved</span>}
      </div>
    </div>
  );
}

// ── Business memory (existing Brain knowledge) ───────────────────────────────

function MemoryTab({ onError }: { onError: (e: unknown, what: string) => void }) {
  const [docs, setDocs] = useState<any[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: 'POLICY', title: '', content: '' });

  const refresh = useCallback(() => {
    api.knowledgeList().then(setDocs).catch(() => setDocs([]));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const create = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      await api.knowledgeIngest(form);
      setForm({ type: 'POLICY', title: '', content: '' });
      setShowForm(false);
      refresh();
    } catch (e) { onError(e, 'save that memory entry'); } finally { setSaving(false); }
  };

  const archive = async (d: any) => {
    try { await api.knowledgeArchive(d.id); refresh(); } catch (e) { onError(e, 'archive that entry'); }
  };

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Business memory</h3>
          <span className="muted" style={{ fontSize: 13 }}>
            Policies, pricing, services, FAQs and SOPs — searchable knowledge every AI employee retrieves and cites.
          </span>
        </div>
        <button className="btn sm" onClick={() => setShowForm(!showForm)}>{showForm ? 'Close' : 'Add entry'}</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16, padding: 16 }}>
          <div className="grid-2" style={{ marginBottom: 10 }}>
            <div className="field">
              <label>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {MEMORY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field"><label>Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Refund policy" /></div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Content</label>
            <textarea rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Exactly what your AI employees should know and say about this." />
          </div>
          <button className="btn" disabled={saving || !form.title.trim() || !form.content.trim()} onClick={create}>{saving ? 'Saving…' : 'Save entry'}</button>
        </div>
      )}

      {docs === null ? (
        <div className="skeleton" style={{ height: 120 }} />
      ) : docs.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 16px' }}>
          <div className="e-ico">🧠</div>
          <h4>No memory entries yet</h4>
          <p>Add your policies, pricing and FAQs so AI employees answer from your facts, not guesses.</p>
        </div>
      ) : (
        docs.map((d) => (
          <div className="card" key={d.id} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <span className="chip muted" style={{ marginRight: 8 }}>{d.type}</span>
                <strong>{d.title}</strong>
              </div>
              <button className="btn ghost sm" onClick={() => archive(d)}>Archive</button>
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 6, whiteSpace: 'pre-wrap' }}>
              {String(d.content ?? '').slice(0, 400)}{String(d.content ?? '').length > 400 ? '…' : ''}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
