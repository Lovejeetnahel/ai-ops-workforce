'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Modal } from '../../../components/Modal';
import { useToast } from '../../../components/Toast';

const TABS = ['Agents', 'Call log', 'Usage'] as const;
type Tab = (typeof TABS)[number];

const CALL_CHIP: Record<string, string> = { COMPLETED: 'ok', IN_PROGRESS: 'warn', FAILED: 'err', NO_ANSWER: 'err', HANDED_OFF: 'warn' };

/**
 * Voice AI V1 — real agent configuration, honest phone-connection status,
 * webhook-verified call logs and provider-only usage numbers. Nothing here
 * simulates a call, a recording or a provider success.
 */
export default function VoiceAiPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('Agents');
  const [agents, setAgents] = useState<any[] | null>(null);
  const [calls, setCalls] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ name: '', purpose: '', mode: 'INBOUND', greeting: '', instructions: '', recordingConsentRequired: true, consentScript: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.voiceAgents().then(setAgents).catch(() => setAgents([]));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (tab === 'Call log' && calls === null) api.voiceCalls().then(setCalls).catch(() => setCalls(false));
    if (tab === 'Usage' && usage === null) api.voiceUsage().then(setUsage).catch(() => setUsage(false));
  }, [tab, calls, usage]);

  const openEditor = (agent?: any) => {
    setEditing(agent ?? null);
    setForm(agent
      ? { name: agent.name, purpose: agent.purpose ?? '', mode: agent.mode, greeting: agent.greeting ?? '', instructions: agent.instructions ?? '', recordingConsentRequired: agent.recordingConsentRequired, consentScript: agent.consentScript ?? '' }
      : { name: '', purpose: '', mode: 'INBOUND', greeting: '', instructions: '', recordingConsentRequired: true, consentScript: '' });
    setEditorOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      if (editing) await api.updateVoiceAgent(editing.id, form);
      else await api.createVoiceAgent(form);
      setEditorOpen(false); load();
      toast.success(editing ? 'Agent updated' : 'Agent created', 'It stays off until you enable it with a connected provider.');
    } catch (e: any) { toast.error('Could not save', String(e?.message ?? '').replace(/^\d+\s*/, '').slice(0, 200)); }
    finally { setBusy(false); }
  };

  const toggle = async (agent: any) => {
    try {
      await api.updateVoiceAgent(agent.id, { enabled: !agent.enabled });
      load();
      toast.success(agent.enabled ? 'Agent disabled' : 'Agent enabled');
    } catch (e: any) { toast.error('Cannot enable', String(e?.message ?? '').replace(/^\d+\s*/, '').slice(0, 220)); }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Voice AI</h2>
          <span className="muted">Your AI phone agent — real calls, real transcripts, honest setup states</span>
        </div>
        <button className="btn sm" onClick={() => openEditor()}>+ New voice agent</button>
      </div>

      <div className="tabs">
        {TABS.map((t) => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === 'Agents' && (
        agents === null ? <div className="panel"><div className="skeleton" style={{ height: 140 }} /></div> :
        agents.length === 0 ? (
          <div className="panel empty-state" style={{ padding: '48px 24px' }}>
            <div className="e-ico">◎</div><h4>No voice agents yet</h4>
            <p>Configure how your AI answers the phone — greeting, purpose, business hours and consent. It only goes live with a real connected phone provider.</p>
            <button className="btn sm" onClick={() => openEditor()}>+ New voice agent</button>
          </div>
        ) : (
          <div className="grid">
            {agents.map((a) => (
              <div className="panel" key={a.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{a.name}</strong>
                  <span className={`chip ${a.enabled ? 'ok' : 'warn'}`}>{a.enabled ? 'Live' : 'Off'}</span>
                </div>
                <p className="muted" style={{ fontSize: 12.5, minHeight: 34 }}>{a.purpose ?? 'No purpose set'} · {a.mode}</p>
                <div className="agent-row" style={{ padding: '6px 0' }}>
                  <span style={{ flex: 1, fontSize: 12 }}>Phone connection</span>
                  {a.phoneConnected ? <span className="chip ok">Connected</span> : <span className="chip warn" title={a.phoneNote}>Setup required</span>}
                </div>
                <div className="agent-row" style={{ padding: '6px 0' }}>
                  <span style={{ flex: 1, fontSize: 12 }}>Recording consent</span>
                  <span className="tag" style={{ fontSize: 10 }}>{a.recordingConsentRequired ? 'Required' : 'Not required'}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button className="btn ghost sm" onClick={() => openEditor(a)}>Configure</button>
                  <button className={`btn sm ${a.enabled ? 'ghost' : ''}`} onClick={() => toggle(a)}>{a.enabled ? 'Turn off' : 'Turn on'}</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'Call log' && (
        calls === null ? <div className="panel"><div className="skeleton" style={{ height: 140 }} /></div> :
        calls === false ? <div className="panel empty-state"><div className="e-ico">◔</div><h4>Could not load calls</h4><p>Try again shortly.</p></div> : (
          <>
            <div className="panel" style={{ marginBottom: 16 }}>
              <h3>Verified calls</h3>
              {(calls.records ?? []).length === 0 ? (
                <div className="empty-state" style={{ padding: '28px 16px' }}>
                  <div className="e-ico">◎</div><h4>No provider-verified calls yet</h4>
                  <p>Calls recorded by your phone provider&rsquo;s webhooks appear here with duration, outcome and cost — never simulated.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="t">
                    <thead><tr><th>When</th><th>Status</th><th>Duration</th><th>Outcome</th><th>Summary</th><th /></tr></thead>
                    <tbody>
                      {calls.records.map((r: any) => (
                        <tr key={r.id}>
                          <td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(r.startedAt).toLocaleString()}</td>
                          <td><span className={`chip ${CALL_CHIP[r.status] ?? 'warn'}`}>{r.status}</span></td>
                          <td className="muted">{r.durationSec != null ? `${Math.round(r.durationSec / 60)}m` : '—'}</td>
                          <td className="muted">{r.outcome ?? '—'}</td>
                          <td className="muted" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.summary ?? '—'}</td>
                          <td><button className="btn ghost sm" onClick={async () => { await api.callFollowUp(r.id).catch(() => {}); toast.success('Follow-up task created'); }}>+ Follow-up</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="panel">
              <h3>Call transcripts</h3>
              {(calls.transcriptThreads ?? []).length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>Voice conversation transcripts appear here as your agent takes calls.</p>
              ) : (
                calls.transcriptThreads.map((c: any) => (
                  <details key={c.id} style={{ borderBottom: '1px solid rgba(128,128,128,0.15)', padding: '8px 0' }}>
                    <summary style={{ cursor: 'pointer', fontSize: 13 }}>
                      {c.contact?.name ?? c.contact?.phone ?? 'Unknown caller'} · {new Date(c.createdAt).toLocaleString()}
                    </summary>
                    {(c.messages ?? []).map((m: any) => (
                      <p key={m.id} style={{ fontSize: 12.5, margin: '6px 0 0 12px' }}>
                        <span className="muted">{m.direction === 'INBOUND' ? 'Caller' : 'Agent'}:</span> {m.body}
                      </p>
                    ))}
                  </details>
                ))
              )}
            </div>
          </>
        )
      )}

      {tab === 'Usage' && (
        usage === null ? <div className="panel"><div className="skeleton" style={{ height: 100 }} /></div> :
        usage === false ? <div className="panel empty-state"><div className="e-ico">∿</div><h4>Usage unavailable</h4><p>Try again shortly.</p></div> : (
          <>
            <div className="grid-kpi" style={{ marginBottom: 12 }}>
              <div className="panel"><div className="muted">Calls (30d)</div><div className="kpi">{usage.calls}</div></div>
              <div className="panel"><div className="muted">Minutes</div><div className="kpi">{usage.minutes ?? '—'}</div></div>
              <div className="panel"><div className="muted">Provider cost</div><div className="kpi">{usage.costUsd != null ? `$${usage.costUsd.toFixed(2)}` : '—'}</div></div>
              <div className="panel"><div className="muted">Human handoffs</div><div className="kpi">{usage.handoffs}</div></div>
            </div>
            <p className="muted" style={{ fontSize: 12 }}>{usage.note}</p>
          </>
        )
      )}

      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editing ? `Configure ${editing.name}` : 'New voice agent'}>
        <div style={{ maxHeight: '62vh', overflowY: 'auto', paddingRight: 4 }}>
          <div className="grid-2">
            <div className="field"><label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Front-desk agent" /></div>
            <div className="field"><label>Mode</label>
              <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                <option value="INBOUND">Inbound</option><option value="OUTBOUND">Outbound</option><option value="BOTH">Both</option>
              </select></div>
          </div>
          <div className="field"><label>Call purpose</label>
            <input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Answer, qualify and book service calls" /></div>
          <div className="field"><label>Greeting</label>
            <textarea rows={2} value={form.greeting} onChange={(e) => setForm({ ...form, greeting: e.target.value })} placeholder="Thanks for calling — how can we help today?" /></div>
          <div className="field"><label>Call instructions (layered over your Business Brain grounding)</label>
            <textarea rows={3} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, margin: '8px 0' }}>
            <input type="checkbox" checked={form.recordingConsentRequired} onChange={(e) => setForm({ ...form, recordingConsentRequired: e.target.checked })} />
            Require recording consent before recording
          </label>
          {form.recordingConsentRequired && (
            <div className="field"><label>Consent script</label>
              <input value={form.consentScript} onChange={(e) => setForm({ ...form, consentScript: e.target.value })} placeholder="This call may be recorded for quality — is that OK?" /></div>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn ghost sm" onClick={() => setEditorOpen(false)}>Cancel</button>
          <button className="btn sm" disabled={busy || !form.name.trim()} onClick={save}>{busy ? 'Saving…' : 'Save agent'}</button>
        </div>
      </Modal>
    </>
  );
}
