'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';
import { Modal } from '../../../components/Modal';
import { useToast } from '../../../components/Toast';

interface Stage { value: string; label: string; color: string; hidden?: boolean }

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

/**
 * Sales — the connected commercial pipeline. Columns come from the tenant's
 * industry preset; every card opens the full opportunity (value, source,
 * campaign attribution, owner, activities, conversations, documents,
 * payments). Won/lost transitions capture real outcomes — no fabricated
 * revenue anywhere.
 */
export default function SalesPage() {
  const toast = useToast();
  const [stages, setStages] = useState<Stage[]>([]);
  const [board, setBoard] = useState<Record<string, any[]>>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [tasks, setTasks] = useState<any[] | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');

  // Opportunity drawer
  const [openLead, setOpenLead] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [edit, setEdit] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [team, setTeam] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  // Won / lost dialogs
  const [outcome, setOutcome] = useState<{ leadId: string; kind: 'won' | 'lost' } | null>(null);
  const [outcomeValue, setOutcomeValue] = useState('');
  const [lostReason, setLostReason] = useState('');

  // New opportunity
  const [newOpen, setNewOpen] = useState(false);
  const [nl, setNl] = useState({ contactName: '', phone: '', email: '', serviceType: '', location: '', urgency: 'NORMAL' });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [config, data] = await Promise.all([api.moduleConfig(), api.board()]);
      setStages((config.pipeline ?? []).filter((s: Stage) => !s.hidden));
      setLabels(config.labels ?? {});
      setBoard(Object.fromEntries(data.map((c: any) => [c.stage, c.leads])));
      setStatus('ready');
    } catch { setStatus('unavailable'); }
  }, []);

  useEffect(() => {
    load();
    api.tasks().then(setTasks).catch(() => setTasks([]));
    api.team().then(setTeam).catch(() => setTeam([]));
    api.campaigns().then(setCampaigns).catch(() => setCampaigns([]));
  }, [load]);

  const filteredBoard = useMemo(() => {
    if (!q.trim()) return board;
    const needle = q.toLowerCase();
    return Object.fromEntries(
      Object.entries(board).map(([stage, leads]) => [
        stage,
        (leads as any[]).filter((l) =>
          [l.contact?.name, l.serviceType, l.location, l.source].some((v) => v?.toLowerCase?.().includes(needle)),
        ),
      ]),
    );
  }, [board, q]);

  const columnValue = (stage: string) =>
    (filteredBoard[stage] ?? []).reduce((s: number, l: any) => s + Number(l.estimatedValue ?? 0), 0);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const lead = await api.lead(id);
      setOpenLead(lead);
      setEdit({
        estimatedValue: lead.estimatedValue ?? '', actualValue: lead.actualValue ?? '',
        source: lead.source ?? '', assignedToId: lead.assignedToId ?? '', campaignId: lead.campaignId ?? '',
        serviceType: lead.serviceType ?? '', location: lead.location ?? '',
      });
    } catch { toast.error('Could not load the opportunity'); }
    finally { setDetailLoading(false); }
  };

  const saveEdit = async () => {
    if (!openLead) return;
    setSaving(true);
    try {
      await api.patchLead(openLead.id, {
        estimatedValue: edit.estimatedValue === '' ? null : Number(edit.estimatedValue),
        actualValue: edit.actualValue === '' ? null : Number(edit.actualValue),
        source: edit.source || null,
        assignedToId: edit.assignedToId || null,
        campaignId: edit.campaignId || null,
        serviceType: edit.serviceType || null,
        location: edit.location || null,
      });
      toast.success('Opportunity updated');
      await openDetail(openLead.id); load();
    } catch { toast.error('Could not save changes'); }
    finally { setSaving(false); }
  };

  const move = async (leadId: string, stage: string) => {
    if (stage === 'COMPLETED') { setOutcome({ leadId, kind: 'won' }); setOutcomeValue(''); return; }
    if (stage === 'LOST') { setOutcome({ leadId, kind: 'lost' }); setLostReason(''); return; }
    try { await api.moveStage(leadId, stage); load(); if (openLead?.id === leadId) openDetail(leadId); }
    catch { toast.error('Could not move stage'); }
  };

  const confirmOutcome = async () => {
    if (!outcome) return;
    try {
      if (outcome.kind === 'won')
        await api.moveStageWithOutcome(outcome.leadId, 'COMPLETED', outcomeValue ? { actualValue: Number(outcomeValue) } : {});
      else await api.moveStageWithOutcome(outcome.leadId, 'LOST', { lostReason: lostReason || undefined });
      toast.success(outcome.kind === 'won' ? 'Marked won' : 'Marked lost');
      setOutcome(null); load();
      if (openLead?.id === outcome.leadId) openDetail(outcome.leadId);
    } catch { toast.error('Could not record the outcome'); }
  };

  const createLead = async () => {
    if (!nl.contactName.trim()) return;
    setCreating(true);
    try {
      await api.createLead({ contactName: nl.contactName.trim(), phone: nl.phone || undefined, email: nl.email || undefined, serviceType: nl.serviceType || undefined, urgency: nl.urgency, location: nl.location || undefined });
      setNewOpen(false); setNl({ contactName: '', phone: '', email: '', serviceType: '', location: '', urgency: 'NORMAL' });
      load(); toast.success('Opportunity added');
    } catch { toast.error('Could not add the opportunity'); }
    finally { setCreating(false); }
  };

  const pipelineLabel = labels.pipeline ?? 'Pipeline';

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Sales</h2>
          <span className="muted">{pipelineLabel}, opportunities and follow-ups — live data only</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div className="search-trigger" style={{ minWidth: 180 }}>
            🔎
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter opportunities…"
              style={{ background: 'none', border: 0, outline: 'none', color: 'var(--text)', fontSize: 13, width: '100%' }} />
          </div>
          <button className="btn sm" onClick={() => setNewOpen(true)}>+ Add opportunity</button>
        </div>
      </div>

      {status === 'loading' && <div className="panel"><div className="skeleton" style={{ height: 220 }} /></div>}
      {status === 'unavailable' && (
        <div className="empty-state panel">
          <div className="e-ico">▲</div><h4>Pipeline unavailable</h4><p>We couldn&rsquo;t load your pipeline right now. Try refreshing the page.</p>
        </div>
      )}
      {status === 'ready' && (
        <div className="board">
          {stages.map((s) => (
            <div className="column" key={s.value}>
              <h3>
                <span className="dot" style={{ background: s.color }} /> {s.label}
                <span className="muted" style={{ marginLeft: 'auto', fontSize: 11 }}>
                  {(filteredBoard[s.value] ?? []).length}{columnValue(s.value) > 0 ? ` · ${money(columnValue(s.value))}` : ''}
                </span>
              </h3>
              {(filteredBoard[s.value] ?? []).length === 0 && (
                <div className="muted" style={{ fontSize: 12, padding: '10px 4px' }}>No {s.label.toLowerCase()} yet</div>
              )}
              {(filteredBoard[s.value] ?? []).map((lead: any) => (
                <button className="card" key={lead.id} onClick={() => openDetail(lead.id)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', color: 'var(--text)' }}>
                  <div className="name">{lead.contact?.name ?? 'Unknown'}</div>
                  <div className="meta">{lead.serviceType ?? '—'}{lead.location ? ` · ${lead.location}` : ''}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {lead.estimatedValue != null && <span className="tag">{money(Number(lead.estimatedValue))}</span>}
                    {lead.assignedTo && <span className="muted" style={{ fontSize: 11 }}>{lead.assignedTo.name}</span>}
                    {lead.urgency === 'EMERGENCY' && <span className="tag" style={{ color: '#fca5a5', borderColor: '#7f1d1d' }}>🚨</span>}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="panel" style={{ marginTop: 20 }}>
        <h3>Follow-ups</h3>
        {tasks === null ? (
          <div className="skeleton" style={{ height: 80 }} />
        ) : tasks.length === 0 ? (
          <div className="empty-state" style={{ padding: '28px 16px' }}>
            <div className="e-ico">✓</div><h4>No follow-ups due</h4><p>Tasks tied to your opportunities will show up here.</p>
          </div>
        ) : (
          tasks.map((t) => (
            <div className="agent-row" key={t.id}>
              <span style={{ flex: 1 }}>{t.title}</span>
              {t.dueAt && <span className="muted">{new Date(t.dueAt).toLocaleDateString()}</span>}
            </div>
          ))
        )}
      </div>

      {/* ── Opportunity drawer ─────────────────────────────────────── */}
      <Modal open={!!openLead || detailLoading} onClose={() => setOpenLead(null)} title={openLead?.contact?.name ?? 'Opportunity'}>
        {detailLoading && <div className="skeleton" style={{ height: 200 }} />}
        {openLead && !detailLoading && (
          <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: 4 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {stages.concat([{ value: 'LOST', label: 'Lost', color: '#f87171' }]).map((s) => (
                <button key={s.value} className="btn ghost sm" onClick={() => move(openLead.id, s.value)}
                  style={openLead.stage === s.value ? { borderColor: s.color, color: s.color } : {}}>
                  {s.label}
                </button>
              ))}
            </div>
            {openLead.stage === 'LOST' && openLead.lostReason && (
              <p className="muted" style={{ fontSize: 12 }}>Lost reason: {openLead.lostReason}</p>
            )}
            {openLead.wonAt && (
              <p className="muted" style={{ fontSize: 12 }}>Won {new Date(openLead.wonAt).toLocaleDateString()}{openLead.actualValue != null ? ` — ${money(Number(openLead.actualValue))} actual` : ''}</p>
            )}

            <div className="grid-2">
              <div className="field"><label>Expected value ($)</label>
                <input type="number" value={edit.estimatedValue} onChange={(e) => setEdit({ ...edit, estimatedValue: e.target.value })} /></div>
              <div className="field"><label>Actual value ($)</label>
                <input type="number" value={edit.actualValue} onChange={(e) => setEdit({ ...edit, actualValue: e.target.value })} /></div>
              <div className="field"><label>Owner</label>
                <select value={edit.assignedToId} onChange={(e) => setEdit({ ...edit, assignedToId: e.target.value })}>
                  <option value="">Unassigned</option>
                  {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select></div>
              <div className="field"><label>Source</label>
                <input value={edit.source} onChange={(e) => setEdit({ ...edit, source: e.target.value })} placeholder="referral, web form…" /></div>
              <div className="field"><label>Campaign attribution</label>
                <select value={edit.campaignId} onChange={(e) => setEdit({ ...edit, campaignId: e.target.value })}>
                  <option value="">None</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
              <div className="field"><label>Service</label>
                <input value={edit.serviceType} onChange={(e) => setEdit({ ...edit, serviceType: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
              <button className="btn sm" onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
            </div>

            {openLead.conversations?.length > 0 && (
              <>
                <h4 style={{ margin: '10px 0 6px' }}>Conversations</h4>
                {openLead.conversations.map((c: any) => (
                  <div className="agent-row" key={c.id}>
                    <span style={{ flex: 1 }}>{c.channel} · {c.status}</span>
                    <span className="muted" style={{ fontSize: 11 }}>{c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleDateString() : ''}</span>
                  </div>
                ))}
              </>
            )}
            {openLead.documents?.length > 0 && (
              <>
                <h4 style={{ margin: '10px 0 6px' }}>Documents</h4>
                {openLead.documents.map((d: any) => (
                  <div className="agent-row" key={d.id}>
                    <span style={{ flex: 1 }}>{d.type} — {d.title}</span>
                    {d.amount != null && <span>{money(Number(d.amount))}</span>}
                    <span className="chip warn" style={{ fontSize: 10 }}>{d.status}</span>
                  </div>
                ))}
              </>
            )}
            {openLead.payments?.length > 0 && (
              <>
                <h4 style={{ margin: '10px 0 6px' }}>Payments</h4>
                {openLead.payments.map((p: any) => (
                  <div className="agent-row" key={p.id}>
                    <span style={{ flex: 1 }}>{money(Number(p.amount))}</span>
                    <span className={`chip ${p.status === 'SUCCEEDED' ? 'ok' : p.status === 'FAILED' ? 'err' : 'warn'}`} style={{ fontSize: 10 }}>{p.status}</span>
                    <span className="muted" style={{ fontSize: 11 }}>{new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </>
            )}
            <h4 style={{ margin: '10px 0 6px' }}>Activity</h4>
            {(openLead.activities ?? []).length === 0 ? (
              <p className="muted" style={{ fontSize: 12 }}>No recorded activity yet.</p>
            ) : (
              openLead.activities.map((a: any) => (
                <div className="agent-row" key={a.id}>
                  <span className="tag" style={{ fontSize: 10 }}>{a.type}</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{a.title}</span>
                  <span className="muted" style={{ fontSize: 11 }}>{new Date(a.createdAt).toLocaleDateString()}</span>
                </div>
              ))
            )}
          </div>
        )}
      </Modal>

      {/* Won / lost capture */}
      <Modal open={!!outcome} onClose={() => setOutcome(null)} title={outcome?.kind === 'won' ? 'Mark as won' : 'Mark as lost'}>
        {outcome?.kind === 'won' ? (
          <div className="field">
            <label htmlFor="won-value">Actual value ($, optional — real numbers only)</label>
            <input id="won-value" type="number" value={outcomeValue} onChange={(e) => setOutcomeValue(e.target.value)} placeholder="e.g. 1250" />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="lost-reason">Lost reason (optional)</label>
            <input id="lost-reason" value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="price, timing, competitor…" />
          </div>
        )}
        <div className="modal-actions">
          <button className="btn ghost sm" onClick={() => setOutcome(null)}>Cancel</button>
          <button className="btn sm" onClick={confirmOutcome}>{outcome?.kind === 'won' ? 'Mark won' : 'Mark lost'}</button>
        </div>
      </Modal>

      {/* New opportunity */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Add an opportunity">
        <div className="field"><label htmlFor="nl-name">Contact name</label>
          <input id="nl-name" value={nl.contactName} onChange={(e) => setNl({ ...nl, contactName: e.target.value })} /></div>
        <div className="grid-2">
          <div className="field"><label htmlFor="nl-phone">Phone</label>
            <input id="nl-phone" value={nl.phone} onChange={(e) => setNl({ ...nl, phone: e.target.value })} /></div>
          <div className="field"><label htmlFor="nl-email">Email</label>
            <input id="nl-email" value={nl.email} onChange={(e) => setNl({ ...nl, email: e.target.value })} /></div>
          <div className="field"><label htmlFor="nl-service">Service</label>
            <input id="nl-service" value={nl.serviceType} onChange={(e) => setNl({ ...nl, serviceType: e.target.value })} /></div>
          <div className="field"><label htmlFor="nl-urgency">Urgency</label>
            <select id="nl-urgency" value={nl.urgency} onChange={(e) => setNl({ ...nl, urgency: e.target.value })}>
              {['LOW', 'NORMAL', 'HIGH', 'EMERGENCY'].map((u) => <option key={u} value={u}>{u}</option>)}
            </select></div>
        </div>
        <div className="field"><label htmlFor="nl-location">Location</label>
          <input id="nl-location" value={nl.location} onChange={(e) => setNl({ ...nl, location: e.target.value })} /></div>
        <div className="modal-actions">
          <button className="btn ghost sm" onClick={() => setNewOpen(false)}>Cancel</button>
          <button className="btn sm" disabled={creating || !nl.contactName.trim()} onClick={createLead}>
            {creating ? 'Adding…' : 'Add opportunity'}
          </button>
        </div>
      </Modal>
    </>
  );
}
