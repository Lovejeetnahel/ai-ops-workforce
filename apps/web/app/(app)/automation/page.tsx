'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Modal } from '../../../components/Modal';
import { useToast } from '../../../components/Toast';

const TABS = ['Rules', 'Recipes', 'History', 'Workflows'] as const;
type Tab = (typeof TABS)[number];

const ACTION_TYPES = ['SEND_SMS', 'SEND_EMAIL', 'CREATE_TASK', 'UPDATE_STAGE', 'ASSIGN_STAFF', 'TRIGGER_AGENT', 'CREATE_BOOKING', 'GENERATE_DOCUMENT'];

/**
 * Automation V1 — the tenant's real rule engine: enable/disable rules, build
 * new ones from the live event catalog, adopt industry recipes, and read the
 * actual execution history (EventLog: processed vs failed, with errors).
 */
export default function AutomationPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('Rules');
  const [rules, setRules] = useState<any[] | null>(null);
  const [recipes, setRecipes] = useState<any[] | null>(null);
  const [history, setHistory] = useState<any[] | null>(null);
  const [historyFilter, setHistoryFilter] = useState<string>('');
  const [workflows, setWorkflows] = useState<any[] | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [nb, setNb] = useState<any>({ name: '', triggerEvent: '', actionType: 'SEND_SMS', template: '', to: 'contact', enabled: true });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.automationRules().then(setRules).catch(() => setRules([]));
    api.automationRecipes().then(setRecipes).catch(() => setRecipes([]));
    api.workflows().then(setWorkflows).catch(() => setWorkflows([]));
    api.automationEvents().then(setEvents).catch(() => setEvents([]));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (tab === 'History') api.automationHistory(historyFilter || undefined).then(setHistory).catch(() => setHistory([]));
  }, [tab, historyFilter]);

  const toggle = async (rule: any) => {
    try { await api.toggleAutomationRule(rule.id, !rule.enabled); load(); toast.success(rule.enabled ? 'Rule paused' : 'Rule activated'); }
    catch { toast.error('Could not update the rule'); }
  };

  const createRule = async () => {
    if (!nb.name.trim() || !nb.triggerEvent) return;
    setBusy(true);
    try {
      const params: any = {};
      if (['SEND_SMS', 'SEND_EMAIL'].includes(nb.actionType)) { params.template = nb.template; params.to = nb.to; }
      if (nb.actionType === 'CREATE_TASK') params.title = nb.template || 'Follow up';
      if (nb.actionType === 'UPDATE_STAGE') params.stage = nb.template || 'CONTACTED';
      await api.createAutomationRule({
        name: nb.name.trim(), triggerEvent: nb.triggerEvent, conditions: [],
        actions: [{ type: nb.actionType, params }], enabled: nb.enabled,
      });
      setBuilderOpen(false); setNb({ name: '', triggerEvent: '', actionType: 'SEND_SMS', template: '', to: 'contact', enabled: true });
      load(); toast.success('Rule created');
    } catch (e: any) { toast.error('Could not create the rule', String(e?.message ?? '').slice(0, 180)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Automation</h2>
          <span className="muted">Rules that react to real events — with a real execution history</span>
        </div>
        <button className="btn sm" onClick={() => setBuilderOpen(true)}>+ New rule</button>
      </div>

      <div className="tabs">
        {TABS.map((t) => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === 'Rules' && (
        rules === null ? <div className="panel"><div className="skeleton" style={{ height: 140 }} /></div> :
        rules.length === 0 ? (
          <div className="panel empty-state" style={{ padding: '48px 24px' }}>
            <div className="e-ico">⟳</div><h4>No automation rules yet</h4>
            <p>Your industry recipes are one tab over, or build a rule from scratch.</p>
            <button className="btn sm" onClick={() => setBuilderOpen(true)}>+ New rule</button>
          </div>
        ) : (
          <div className="panel">
            {rules.map((r) => (
              <div className="agent-row" key={r.id}>
                <span style={{ flex: 1 }}>
                  <strong>{r.name}</strong>
                  {r.presetKey && <span className="tag" style={{ marginLeft: 6, fontSize: 10 }}>industry recipe</span>}
                  <span className="muted" style={{ display: 'block', fontSize: 11 }}>
                    on <code>{r.triggerEvent}</code> → {(r.actions ?? []).map((a: any) => a.type).join(', ') || 'no actions'}
                  </span>
                </span>
                <button className={`btn sm ${r.enabled ? '' : 'ghost'}`} onClick={() => toggle(r)}>
                  {r.enabled ? 'On' : 'Off'}
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'Recipes' && (
        recipes === null ? <div className="panel"><div className="skeleton" style={{ height: 120 }} /></div> :
        <div className="grid">
          {recipes.map((rec) => (
            <div className="panel" key={rec.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong>{rec.name}</strong>
                {rec.enabled ? <span className="chip ok">Active</span> : <span className="chip warn">Off</span>}
              </div>
              <p className="muted" style={{ fontSize: 12.5, minHeight: 48 }}>{rec.description}</p>
              <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>Trigger: <code>{rec.triggerEvent}</code></div>
              {rec.ruleId ? (
                <button className={`btn sm ${rec.enabled ? 'ghost' : ''}`} onClick={async () => {
                  await api.toggleAutomationRule(rec.ruleId, !rec.enabled).catch(() => toast.error('Could not toggle'));
                  load();
                }}>{rec.enabled ? 'Turn off' : 'Turn on'}</button>
              ) : (
                <span className="muted" style={{ fontSize: 11 }}>Not seeded for this workspace</span>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'History' && (
        <>
          <div className="tabs">
            {([['', 'All'], ['PROCESSED', 'Processed'], ['FAILED', 'Failed'], ['RECEIVED', 'Queued']] as const).map(([k, label]) => (
              <button key={k || 'all'} className={`tab ${historyFilter === k ? 'active' : ''}`} onClick={() => setHistoryFilter(k)}>{label}</button>
            ))}
          </div>
          <div className="panel">
            {history === null ? <div className="skeleton" style={{ height: 140 }} /> :
            history.length === 0 ? (
              <div className="empty-state" style={{ padding: '36px 16px' }}>
                <div className="e-ico">∿</div><h4>No events {historyFilter ? `with status ${historyFilter}` : 'yet'}</h4>
                <p>Every domain event and its automation outcome is recorded here as it happens.</p>
              </div>
            ) : (
              <table className="t">
                <thead><tr><th>Event</th><th>Source</th><th>Status</th><th>Error</th><th>When</th></tr></thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td><code style={{ fontSize: 12 }}>{h.name}</code></td>
                      <td className="muted">{h.source}</td>
                      <td><span className={`chip ${h.status === 'PROCESSED' ? 'ok' : h.status === 'FAILED' ? 'err' : 'warn'}`}>{h.status}</span></td>
                      <td className="muted" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h.error ?? ''}>{h.error ?? '—'}</td>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(h.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'Workflows' && (
        workflows === null ? <div className="panel"><div className="skeleton" style={{ height: 100 }} /></div> :
        workflows.length === 0 ? (
          <div className="panel empty-state" style={{ padding: '48px 24px' }}>
            <div className="e-ico">⇶</div><h4>No multi-step workflows yet</h4>
            <p>The workflow engine (drafts, versions, runs) is live in the API. Single-trigger rules on the Rules tab cover most day-to-day automation; a visual multi-step builder is on the roadmap.</p>
          </div>
        ) : (
          <div className="panel">
            {workflows.map((w) => (
              <div className="agent-row" key={w.id}>
                <span style={{ flex: 1 }}><strong>{w.name}</strong><span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{w.status}</span></span>
                <span className="muted" style={{ fontSize: 11 }}>{new Date(w.updatedAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )
      )}

      <Modal open={builderOpen} onClose={() => setBuilderOpen(false)} title="New automation rule">
        <div className="field"><label>Name</label>
          <input value={nb.name} onChange={(e) => setNb({ ...nb, name: e.target.value })} placeholder="Text new leads within a minute" /></div>
        <div className="grid-2">
          <div className="field"><label>When this happens (trigger)</label>
            <select value={nb.triggerEvent} onChange={(e) => setNb({ ...nb, triggerEvent: e.target.value })}>
              <option value="">Choose an event…</option>
              {events.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
            </select></div>
          <div className="field"><label>Do this (action)</label>
            <select value={nb.actionType} onChange={(e) => setNb({ ...nb, actionType: e.target.value })}>
              {ACTION_TYPES.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
            </select></div>
        </div>
        {['SEND_SMS', 'SEND_EMAIL'].includes(nb.actionType) && (
          <div className="field"><label>Message template ({'{{contact.name}}'} etc. interpolate from the event)</label>
            <textarea rows={3} value={nb.template} onChange={(e) => setNb({ ...nb, template: e.target.value })} /></div>
        )}
        {nb.actionType === 'CREATE_TASK' && (
          <div className="field"><label>Task title</label>
            <input value={nb.template} onChange={(e) => setNb({ ...nb, template: e.target.value })} /></div>
        )}
        {nb.actionType === 'UPDATE_STAGE' && (
          <div className="field"><label>Move lead to stage</label>
            <select value={nb.template} onChange={(e) => setNb({ ...nb, template: e.target.value })}>
              {['NEW', 'CONTACTED', 'QUALIFIED', 'BOOKED', 'COMPLETED', 'LOST'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select></div>
        )}
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, margin: '8px 0' }}>
          <input type="checkbox" checked={nb.enabled} onChange={(e) => setNb({ ...nb, enabled: e.target.checked })} /> Enable immediately
        </label>
        <div className="modal-actions">
          <button className="btn ghost sm" onClick={() => setBuilderOpen(false)}>Cancel</button>
          <button className="btn sm" disabled={busy || !nb.name.trim() || !nb.triggerEvent} onClick={createRule}>
            {busy ? 'Creating…' : 'Create rule'}
          </button>
        </div>
      </Modal>
    </>
  );
}
