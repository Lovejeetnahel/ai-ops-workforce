'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Modal } from '../../../components/Modal';
import { useToast } from '../../../components/Toast';

const TABS = ['General', 'Team', 'Locations', 'Integrations', 'Industry preset', 'Billing & usage', 'Security & audit'] as const;
type Tab = (typeof TABS)[number];

const ROLES = ['STAFF', 'ADMIN'];

/**
 * Settings — coherent, real configuration: company/tenant profile, team &
 * roles, honest integration status, industry preset (same-engine switch),
 * billing/usage, and the audit trail. No secrets are ever displayed.
 */
export default function SettingsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('General');
  const [config, setConfig] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [team, setTeam] = useState<any[] | null>(null);
  const [integrations, setIntegrations] = useState<any[] | null>(null);
  const [presets, setPresets] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[] | null>(null);
  const [billing, setBilling] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [timezone, setTimezone] = useState('');
  const [savingTz, setSavingTz] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('STAFF');
  const [saving, setSaving] = useState(false);

  const [presetConfirm, setPresetConfirm] = useState<any>(null);
  const [changingPreset, setChangingPreset] = useState(false);
  // Sprint 3
  const [locations, setLocations] = useState<any[] | null>(null);
  const [newLoc, setNewLoc] = useState({ name: '', address: '', phone: '' });
  const [usageDetail, setUsageDetail] = useState<any>(null);
  const [sessions, setSessions] = useState<any[] | null>(null);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwBusy, setPwBusy] = useState(false);

  const load = useCallback(() => {
    api.moduleConfig().then(setConfig).catch(() => {});
    api.currentTenant().then((t) => { setTenant(t); setTimezone(t.timezone); }).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (tab === 'Team' && team === null) api.team().then(setTeam).catch(() => setTeam([]));
    if (tab === 'Integrations' && integrations === null) api.integrationsStatus().then(setIntegrations).catch(() => setIntegrations([]));
    if (tab === 'Industry preset' && presets.length === 0) api.industryPresets().then(setPresets).catch(() => {});
    if (tab === 'Security & audit' && audit === null) api.auditHistory().then(setAudit).catch(() => setAudit([]));
    if (tab === 'Security & audit' && sessions === null) api.sessions().then(setSessions).catch(() => setSessions([]));
    if (tab === 'Locations' && locations === null) api.locations().then(setLocations).catch(() => setLocations([]));
    if (tab === 'Billing & usage') {
      if (!billing) api.billingSummary().then(setBilling).catch(() => setBilling(false));
      if (!usage) api.workforceUsage().then(setUsage).catch(() => setUsage(false));
      if (!usageDetail) api.billingUsage().then(setUsageDetail).catch(() => setUsageDetail(false));
    }
  }, [tab, team, integrations, presets.length, audit, billing, usage, sessions, locations, usageDetail]);

  const invite = async () => {
    if (!name.trim() || !email.trim()) return;
    setSaving(true);
    try {
      const tempPassword = Math.random().toString(36).slice(2, 10) + 'A1!';
      await api.inviteStaff({ email: email.trim(), password: tempPassword, name: name.trim(), role });
      toast.success('Team member added', `${name} can sign in with the temporary password you share with them.`);
      setName(''); setEmail(''); setInviteOpen(false); setTeam(null);
      api.team().then(setTeam).catch(() => {});
    } catch (e: any) {
      toast.error('Could not add team member', String(e?.message ?? '').slice(0, 180));
    } finally { setSaving(false); }
  };

  const saveTimezone = async () => {
    setSavingTz(true);
    try { await api.patchTenantProfile({ timezone }); toast.success('Timezone updated'); }
    catch (e: any) { toast.error('Invalid timezone', String(e?.message ?? '').slice(0, 160)); }
    finally { setSavingTz(false); }
  };

  const changePreset = async () => {
    if (!presetConfirm) return;
    setChangingPreset(true);
    try {
      await api.changePreset(presetConfirm.key);
      toast.success('Preset changed', `Now running the ${presetConfirm.label} preset.`);
      setPresetConfirm(null); load();
    } catch (e: any) {
      toast.error('Could not change preset', String(e?.message ?? '').replace(/^\d+\s*/, '').slice(0, 220));
    } finally { setChangingPreset(false); }
  };

  const sameEnginePresets = presets.filter((p) => p.engine === tenant?.industryModule);

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Settings</h2>
          <span className="muted">Business settings and configuration</span>
        </div>
        {tenant && <span className="badge">{tenant.name}</span>}
      </div>

      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        {TABS.map((t) => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === 'General' && (
        <div className="grid">
          <div className="panel">
            <h3>Company</h3>
            <p className="muted" style={{ fontSize: 13 }}>{tenant?.name ?? '…'} · {config?.label ?? ''}</p>
            <div className="field"><label htmlFor="tz">Timezone (IANA)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input id="tz" style={{ flex: 1 }} value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="America/Toronto" />
                <button className="btn sm" onClick={saveTimezone} disabled={savingTz || !timezone.trim()}>{savingTz ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
            <p className="muted" style={{ fontSize: 12 }}>Scheduling, AI employee work hours and reports use this timezone.</p>
          </div>
          <div className="panel">
            <h3>Company profile &amp; Business Brain</h3>
            <p className="muted" style={{ fontSize: 13 }}>Identity, mission, brand voice, business rules, goals and KPIs live in the Business Brain — every AI employee reads them.</p>
            <Link href="/business-brain" className="btn ghost sm">Open Business Brain</Link>
          </div>
          <div className="panel">
            <h3>AI authority &amp; approvals</h3>
            <p className="muted" style={{ fontSize: 13 }}>Every AI employee defaults to approval-first. Authority levels and pending approvals are managed in the AI Workforce.</p>
            <Link href="/ai-workforce" className="btn ghost sm">Open AI Workforce</Link>
          </div>
          <div className="panel">
            <h3>Notifications</h3>
            <p className="muted" style={{ fontSize: 13 }}>In-app notifications are live (bell icon). Email/SMS notification preferences ship with a future release — honestly not built yet.</p>
            <button className="btn ghost sm" disabled>Preferences — coming soon</button>
          </div>
          <div className="panel">
            <h3>Data controls</h3>
            <p className="muted" style={{ fontSize: 13 }}>Your data is tenant-isolated at the database layer. Self-serve export and deletion tooling is planned; today, contact support and we run it for you.</p>
            <Link href="/support" className="btn ghost sm">Contact support</Link>
          </div>
        </div>
      )}

      {tab === 'Team' && (
        <div className="panel">
          <div className="topbar" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Team &amp; roles</h3>
            <button className="btn sm" onClick={() => setInviteOpen(true)}>+ Invite team member</button>
          </div>
          {team === null ? <div className="skeleton" style={{ height: 100 }} /> :
          team.length === 0 ? <p className="muted">No team members found.</p> : (
            <table className="t">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead>
              <tbody>
                {team.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td className="muted">{u.email}</td>
                    <td><span className="tag">{u.role}</span></td>
                    <td><span className={`chip ${u.status === 'ACTIVE' ? 'ok' : 'warn'}`}>{u.status}</span></td>
                    <td className="muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Roles: Owner (everything) → Admin (manage &amp; approve) → Staff (work) → Customer (portal only). Permissions are enforced server-side on every endpoint.
          </p>
        </div>
      )}

      {tab === 'Locations' && (
        <div className="panel">
          <h3>Locations</h3>
          <p className="muted" style={{ fontSize: 12.5 }}>
            Optional — single-location businesses can ignore this entirely. Locations let you group staff, appointments and pipeline by branch, with a cross-location executive view on the dashboard.
          </p>
          {locations === null ? <div className="skeleton" style={{ height: 60 }} /> : (
            <>
              {locations.map((l) => (
                <div className="agent-row" key={l.id}>
                  <span style={{ flex: 1 }}><strong>{l.name}</strong><span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{l.address ?? ''}{l.phone ? ` · ${l.phone}` : ''}</span></span>
                  <button className="btn ghost sm" onClick={async () => { await api.updateLocation(l.id, { active: !l.active }).catch(() => {}); setLocations(null); }}>{l.active ? 'Active' : 'Inactive'}</button>
                </div>
              ))}
              <div className="grid-2" style={{ marginTop: 10 }}>
                <div className="field"><label>Name</label><input value={newLoc.name} onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })} placeholder="Downtown branch" /></div>
                <div className="field"><label>Address</label><input value={newLoc.address} onChange={(e) => setNewLoc({ ...newLoc, address: e.target.value })} /></div>
              </div>
              <button className="btn sm" disabled={!newLoc.name.trim()} onClick={async () => {
                try { await api.createLocation(newLoc); setNewLoc({ name: '', address: '', phone: '' }); setLocations(null); toast.success('Location added'); }
                catch { toast.error('Could not add the location (owner only)'); }
              }}>+ Add location</button>
            </>
          )}
        </div>
      )}

      {tab === 'Integrations' && (
        <div className="panel">
          <h3>Integrations</h3>
          {integrations === null ? <div className="skeleton" style={{ height: 100 }} /> : (
            integrations.map((i) => (
              <div className="agent-row" key={i.key}>
                <span style={{ flex: 1 }}>
                  <strong>{i.label}</strong>
                  <span className="muted" style={{ display: 'block', fontSize: 11 }}>Enables: {(i.enables ?? []).join(' · ')}</span>
                </span>
                {i.configured ? <span className="chip ok">Connected ({i.source})</span> : <span className="chip warn">Setup required</span>}
              </div>
            ))
          )}
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Credentials are configured on the server (or per-tenant via encrypted storage) and are never displayed here. Anything not connected says &ldquo;setup required&rdquo; — features depending on it refuse to pretend.
          </p>
        </div>
      )}

      {tab === 'Industry preset' && (
        <div className="panel">
          <h3>Industry preset</h3>
          <p className="muted" style={{ fontSize: 13 }}>
            Current: <strong>{config?.preset ? `${config.preset.icon} ${config.preset.label}` : config?.label ?? '…'}</strong> — drives your terminology, pipeline stages, dashboard widgets, recommended automations and AI employee suggestions.
          </p>
          {sameEnginePresets.length > 1 ? (
            <>
              <p className="muted" style={{ fontSize: 12 }}>You can switch between presets that run on your current engine ({tenant?.industryModule}) — your data is untouched, only vocabulary and configuration change. Owner only.</p>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                {sameEnginePresets.map((p) => (
                  <div className="card" key={p.key}>
                    <div className="name">{p.icon} {p.label}</div>
                    <div className="meta" style={{ minHeight: 36, margin: '6px 0' }}>{p.tagline}</div>
                    {config?.preset?.key === p.key
                      ? <span className="chip ok">Active</span>
                      : <button className="btn ghost sm" onClick={() => setPresetConfirm(p)}>Switch</button>}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="muted" style={{ fontSize: 12 }}>No other presets are available on your engine. Presets on a different engine can&rsquo;t be applied to existing data.</p>
          )}
        </div>
      )}

      {tab === 'Billing & usage' && (
        <div className="grid-2">
          <div className="panel">
            <h3>Billing</h3>
            {billing === null ? <div className="skeleton" style={{ height: 60 }} /> :
            billing === false ? <p className="muted" style={{ fontSize: 13 }}>Billing details unavailable right now.</p> : (
              <>
                {billing?.plan?.name && <p><strong>{billing.plan.name}</strong></p>}
                {billing?.revenue?.net != null && <p className="muted" style={{ fontSize: 13 }}>Collected through the platform: ${Number(billing.revenue.net).toLocaleString()}</p>}
                {!billing?.plan?.name && <p className="muted" style={{ fontSize: 13 }}>No live subscription record — plans are listed on the public pricing page.</p>}
              </>
            )}
          </div>
          <div className="panel">
            <h3>AI usage</h3>
            {usage === null ? <div className="skeleton" style={{ height: 60 }} /> :
            usage === false ? <p className="muted" style={{ fontSize: 13 }}>Usage unavailable right now.</p> : (
              <>
                <p className="muted" style={{ fontSize: 13 }}>
                  This month: {usage?.month?.tasks ?? usage?.tasks ?? 0} AI task{(usage?.month?.tasks ?? usage?.tasks ?? 0) === 1 ? '' : 's'}
                  {usage?.month?.costUsd != null && ` · $${Number(usage.month.costUsd).toFixed(2)} model cost`}
                </p>
                <Link href="/ai-workforce" className="btn ghost sm">Per-employee breakdown</Link>
              </>
            )}
          </div>
          <div className="panel" style={{ gridColumn: '1 / -1' }}>
            <h3>Usage vs plan limits</h3>
            {usageDetail === null ? <div className="skeleton" style={{ height: 80 }} /> :
            usageDetail === false ? <p className="muted" style={{ fontSize: 13 }}>Usage unavailable right now.</p> : (
              <>
                <p className="muted" style={{ fontSize: 12.5 }}>
                  Plan: <strong>{usageDetail.plan.name}</strong> · state: <span className="tag">{usageDetail.state}</span>
                  {usageDetail.state === 'no_subscription' && ' — no subscription on file; nothing is enforced yet.'}
                </p>
                <div className="agent-row"><span style={{ flex: 1 }}>Staff seats</span><span className={usageDetail.usage.staffUsers.over ? 'chip err' : 'chip ok'}>{usageDetail.usage.staffUsers.used} / {usageDetail.usage.staffUsers.limit}</span></div>
                <div className="agent-row"><span style={{ flex: 1 }}>AI tasks this month</span><span className={usageDetail.usage.aiTasksThisMonth.over ? 'chip err' : 'chip ok'}>{usageDetail.usage.aiTasksThisMonth.used} / {usageDetail.usage.aiTasksThisMonth.limit}</span></div>
                <div className="agent-row"><span style={{ flex: 1 }}>Voice calls / minutes (30d)</span><span className="muted" style={{ fontSize: 12 }}>{usageDetail.usage.voice.calls} calls · {usageDetail.usage.voice.minutes ?? '—'} min</span></div>
                <div className="agent-row"><span style={{ flex: 1 }}>Messages this month</span><span className="muted" style={{ fontSize: 12 }}>{usageDetail.usage.messagesThisMonth.conversationReplies} replies · {usageDetail.usage.messagesThisMonth.campaignSends} campaign sends</span></div>
                <div className="agent-row"><span style={{ flex: 1 }}>Locations / API keys</span><span className="muted" style={{ fontSize: 12 }}>{usageDetail.usage.locations.used} · {usageDetail.usage.apiKeys.used}</span></div>
                <div className="agent-row"><span style={{ flex: 1 }}>Storage</span><span className="muted" style={{ fontSize: 12 }}>{usageDetail.usage.storage.note}</span></div>
                <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>{usageDetail.billingPortal.note}</p>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'Security & audit' && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div className="panel">
            <h3>Security</h3>
            <div style={{ borderBottom: '1px solid rgba(128,128,128,0.2)', paddingBottom: 12, marginBottom: 8 }}>
              <strong style={{ fontSize: 13 }}>Change password</strong>
              <div className="grid-2" style={{ marginTop: 6 }}>
                <input type="password" placeholder="Current password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
                <input type="password" placeholder="New password (10+ chars)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              </div>
              <button className="btn sm" style={{ marginTop: 8 }} disabled={pwBusy || pw.current.length < 8 || pw.next.length < 10} onClick={async () => {
                setPwBusy(true);
                try { const r = await api.changePassword(pw.current, pw.next); toast.success('Password changed', r.note); setPw({ current: '', next: '' }); }
                catch (e: any) { toast.error('Could not change password', String(e?.message ?? '').replace(/^\d+\s*/, '').slice(0, 160)); }
                finally { setPwBusy(false); }
              }}>{pwBusy ? 'Changing…' : 'Change password'}</button>
              <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>Changing your password signs out every session, everywhere.</p>
            </div>
            <div style={{ borderBottom: '1px solid rgba(128,128,128,0.2)', paddingBottom: 12, marginBottom: 8 }}>
              <strong style={{ fontSize: 13 }}>Active sessions</strong>
              {sessions === null ? <div className="skeleton" style={{ height: 40, marginTop: 6 }} /> :
              sessions.length === 0 ? <p className="muted" style={{ fontSize: 12 }}>No other live sessions.</p> : (
                sessions.map((sn) => (
                  <div className="agent-row" key={sn.id}>
                    <span style={{ flex: 1, fontSize: 12 }}>Signed in {new Date(sn.createdAt).toLocaleString()}<span className="muted"> · expires {new Date(sn.expiresAt).toLocaleDateString()}</span></span>
                    <button className="btn ghost sm" onClick={async () => { await api.revokeSession(sn.id).catch(() => {}); setSessions(null); }}>Sign out</button>
                  </div>
                ))
              )}
            </div>
            <div style={{ borderBottom: '1px solid rgba(128,128,128,0.2)', paddingBottom: 12, marginBottom: 8 }}>
              <strong style={{ fontSize: 13 }}>Data controls (owner)</strong>
              <p className="muted" style={{ fontSize: 12 }}>Requests are durably recorded and audited; fulfillment is handled by our team — never silently claimed as done.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn ghost sm" onClick={async () => { try { const r = await api.dataRequest('EXPORT'); toast.success('Export requested', r.note); } catch { toast.error('Owner only'); } }}>Request data export</button>
                <button className="btn ghost sm" onClick={async () => { try { const r = await api.dataRequest('DELETE'); toast.success('Deletion requested', r.note); } catch { toast.error('Owner only'); } }}>Request account deletion</button>
              </div>
            </div>
            <div className="agent-row"><span style={{ flex: 1 }}>Sessions</span><span className="muted" style={{ fontSize: 12 }}>Access tokens expire in 15m; refresh tokens are revocable server-side</span></div>
            <div className="agent-row"><span style={{ flex: 1 }}>Tenant isolation</span><span className="muted" style={{ fontSize: 12 }}>Enforced at the database client for every query</span></div>
            <div className="agent-row"><span style={{ flex: 1 }}>Two-factor authentication</span><button className="btn ghost sm" disabled>Coming soon</button></div>
          </div>
          <div className="panel">
            <h3>Audit history</h3>
            {audit === null ? <div className="skeleton" style={{ height: 100 }} /> :
            audit.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>No audited actions recorded yet. Sensitive actions (role changes, approvals, authority changes) land here.</p>
            ) : (
              audit.map((a) => (
                <div className="agent-row" key={a.id}>
                  <span style={{ flex: 1 }}><code style={{ fontSize: 12 }}>{a.action}</code>{a.entity && <span className="muted" style={{ fontSize: 11 }}> · {a.entity}</span>}</span>
                  <span className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(a.createdAt).toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite a team member">
        <div className="field">
          <label htmlFor="iname">Name</label>
          <input id="iname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jamie Rivera" />
        </div>
        <div className="field">
          <label htmlFor="iemail">Email</label>
          <input id="iemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jamie@yourcompany.com" />
        </div>
        <div className="field">
          <label htmlFor="irole">Role</label>
          <select id="irole" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
        <div className="modal-actions">
          <button className="btn ghost sm" onClick={() => setInviteOpen(false)}>Cancel</button>
          <button className="btn sm" disabled={saving || !name.trim() || !email.trim()} onClick={invite}>
            {saving ? 'Sending…' : 'Send invite'}
          </button>
        </div>
      </Modal>

      <Modal open={!!presetConfirm} onClose={() => setPresetConfirm(null)} title="Switch industry preset">
        {presetConfirm && (
          <>
            <p style={{ fontSize: 13 }}>
              Switch to <strong>{presetConfirm.icon} {presetConfirm.label}</strong>? Your data (contacts, leads, jobs, invoices) is untouched — terminology, pipeline labels, dashboard widgets and recommendations change immediately for everyone in the workspace.
            </p>
            <div className="modal-actions">
              <button className="btn ghost sm" onClick={() => setPresetConfirm(null)}>Cancel</button>
              <button className="btn sm" disabled={changingPreset} onClick={changePreset}>{changingPreset ? 'Switching…' : 'Switch preset'}</button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
