'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../lib/api';
import { Modal } from '../../../components/Modal';
import { useToast } from '../../../components/Toast';

const CHANNEL_ICON: Record<string, string> = { VOICE: '◎', SMS: '▤', WHATSAPP: '▤', EMAIL: '✉', WEBCHAT: '❖', PORTAL: '◉', INTERNAL: '▣' };
const STATUS_CHIP: Record<string, string> = { OPEN: 'ok', WAITING: 'warn', CLOSED: '' };

function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/**
 * Unified Inbox V1 — real two-pane inbox over live conversations. Replies are
 * provider-honest (the API refuses stub sends); AI suggestions are drafts the
 * human must send. No fabricated threads, ever.
 */
export default function ConversationsPage() {
  const toast = useToast();
  const [list, setList] = useState<any[] | null>(null);
  const [filters, setFilters] = useState<{ status?: string; channel?: string; assigned?: string; unread?: boolean }>({});
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [composer, setComposer] = useState('');
  const [composerMode, setComposerMode] = useState<'reply' | 'note'>('reply');
  const [sending, setSending] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [team, setTeam] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[] | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [nc, setNc] = useState({ contactName: '', phone: '', email: '', channel: 'SMS', subject: '', body: '' });
  const [creating, setCreating] = useState(false);
  const timeline = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api.conversations({ ...filters, q: q || undefined }).then(setList).catch(() => setList([]));
  }, [filters, q]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.team().then(setTeam).catch(() => setTeam([]));
    api.employees().then(setEmployees).catch(() => setEmployees([]));
    api.conversationChannels().then(setChannels).catch(() => setChannels([]));
  }, []);
  useEffect(() => { timeline.current?.scrollTo({ top: timeline.current.scrollHeight }); }, [selected?.messages?.length]);

  const open = async (id: string) => {
    setLoadingDetail(true);
    try {
      const convo = await api.conversation(id);
      setSelected(convo);
      if (convo.unread) { api.markConversationRead(id).catch(() => {}); load(); }
    } catch { toast.error('Could not open the conversation'); }
    finally { setLoadingDetail(false); }
  };

  const refreshSelected = async () => { if (selected) setSelected(await api.conversation(selected.id).catch(() => selected)); };

  const send = async () => {
    if (!composer.trim() || !selected) return;
    setSending(true);
    try {
      if (composerMode === 'note') await api.noteConversation(selected.id, composer);
      else await api.replyConversation(selected.id, composer);
      setComposer('');
      await refreshSelected(); load();
      if (composerMode === 'reply') toast.success('Sent');
    } catch (e: any) {
      // The API's honest setup-required / no-phone messages surface verbatim.
      const msg = String(e?.message ?? '');
      toast.error(composerMode === 'note' ? 'Could not save note' : 'Could not send', msg.replace(/^\d+\s*/, '').slice(0, 220));
    } finally { setSending(false); }
  };

  const suggest = async () => {
    if (!selected) return;
    setSuggesting(true);
    try {
      const r = await api.suggestReply(selected.id);
      if (r.available) { setComposerMode('reply'); setComposer(r.suggestion); toast.success('Draft ready', 'Review and edit before sending — nothing was sent.'); }
      else toast.error('AI drafting unavailable', r.reason);
    } catch { toast.error('Could not draft a reply'); }
    finally { setSuggesting(false); }
  };

  const assign = async (v: string) => {
    if (!selected) return;
    try {
      if (v.startsWith('user:')) await api.assignConversation(selected.id, { userId: v.slice(5), agentKey: null });
      else if (v.startsWith('ai:')) await api.assignConversation(selected.id, { agentKey: v.slice(3) });
      else await api.assignConversation(selected.id, { userId: null, agentKey: null });
      await refreshSelected(); load();
      toast.success('Assignment updated');
    } catch (e: any) { toast.error('Could not assign', String(e?.message ?? '').slice(0, 180)); }
  };

  const setStatus = async (status: string) => {
    if (!selected) return;
    try { await api.setConversationStatus(selected.id, status); await refreshSelected(); load(); }
    catch { toast.error('Could not update status'); }
  };

  const createConversation = async () => {
    if (!nc.contactName.trim()) return;
    setCreating(true);
    try {
      const convo = await api.startConversation({
        contactName: nc.contactName.trim(), phone: nc.phone || undefined, email: nc.email || undefined,
        channel: nc.channel, subject: nc.subject || undefined, body: nc.body || undefined,
      });
      setNewOpen(false); setNc({ contactName: '', phone: '', email: '', channel: 'SMS', subject: '', body: '' });
      load(); setSelected(convo);
      toast.success('Conversation started');
    } catch (e: any) { toast.error('Could not start conversation', String(e?.message ?? '').replace(/^\d+\s*/, '').slice(0, 220)); }
    finally { setCreating(false); }
  };

  const assignedValue = selected?.agentKey ? `ai:${selected.agentKey}` : selected?.assignedToId ? `user:${selected.assignedToId}` : '';

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Conversations</h2>
          <span className="muted">Voice, SMS, chat and email in one queue</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-trigger" style={{ minWidth: 200 }}>
            🔎
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations…"
              style={{ background: 'none', border: 0, outline: 'none', color: 'var(--text)', fontSize: 13, width: '100%' }} />
          </div>
          <button className="btn sm" onClick={() => setNewOpen(true)}>+ New conversation</button>
        </div>
      </div>

      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        {[
          { label: 'All', f: {} }, { label: 'Open', f: { status: 'OPEN' } }, { label: 'Waiting', f: { status: 'WAITING' } },
          { label: 'Closed', f: { status: 'CLOSED' } }, { label: 'Unread', f: { unread: true } }, { label: 'Mine', f: { assigned: 'me' } },
          { label: 'Unassigned', f: { assigned: 'unassigned' } },
        ].map((t) => (
          <button key={t.label} className={`tab ${JSON.stringify(filters) === JSON.stringify(t.f) ? 'active' : ''}`} onClick={() => setFilters(t.f)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) 1fr', gap: 16, alignItems: 'start' }} className="inbox-grid">
        {/* ── Thread list ─────────────────────────────────────────── */}
        <div className="panel" style={{ padding: 10, minHeight: 480, maxHeight: '72vh', overflowY: 'auto' }}>
          {list === null ? (
            <div className="skeleton" style={{ height: 200 }} />
          ) : list.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 16px' }}>
              <div className="e-ico">▤</div>
              <h4>No conversations yet</h4>
              <p>Threads from calls, texts, web chat and the customer portal appear here — or start one yourself.</p>
              <button className="btn sm" onClick={() => setNewOpen(true)}>+ New conversation</button>
            </div>
          ) : (
            list.map((c) => (
              <button key={c.id} onClick={() => open(c.id)} className="agent-row" style={{
                width: '100%', textAlign: 'left', cursor: 'pointer', border: 0, background: selected?.id === c.id ? 'rgba(255,198,41,0.06)' : 'none',
                borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 8px', color: 'var(--text)',
              }}>
                <span className="ico" aria-hidden>{CHANNEL_ICON[c.channel] ?? '▤'}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontWeight: c.unread ? 700 : 500 }}>{c.contact?.name ?? 'Unknown contact'}</strong>
                    <span className="muted" style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{timeAgo(c.lastMessageAt ?? c.updatedAt)}</span>
                  </span>
                  <span className="muted" style={{ display: 'block', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.lastMessage?.body ?? c.subject ?? `${String(c.channel).toLowerCase()} conversation`}
                  </span>
                  <span style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                    <span className={`chip ${STATUS_CHIP[c.status] ?? ''}`} style={{ fontSize: 10 }}>{c.status}</span>
                    {c.unread && <span className="chip err" style={{ fontSize: 10 }}>Unread</span>}
                    {(c.assignedTo || c.agentKey) && (
                      <span className="muted" style={{ fontSize: 11 }}>→ {c.agentKey ? `AI · ${c.agentKey}` : c.assignedTo?.name}</span>
                    )}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>

        {/* ── Thread detail ───────────────────────────────────────── */}
        <div className="panel" style={{ minHeight: 480, maxHeight: '72vh', display: 'flex', flexDirection: 'column' }}>
          {!selected && !loadingDetail && (
            <div className="empty-state" style={{ margin: 'auto', padding: '40px 16px' }}>
              <div className="e-ico">◎</div>
              <h4>Select a conversation</h4>
              <p>Channel, customer context, assignment and internal notes appear here.</p>
            </div>
          )}
          {loadingDetail && <div className="skeleton" style={{ height: 300, margin: 16 }} />}
          {selected && !loadingDetail && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', borderBottom: '1px solid rgba(128,128,128,0.25)', paddingBottom: 10 }}>
                <div>
                  <strong>{selected.contact?.name ?? 'Unknown contact'}</strong>
                  <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                    {CHANNEL_ICON[selected.channel]} {selected.channel}{selected.contact?.phone ? ` · ${selected.contact.phone}` : ''}{selected.contact?.email ? ` · ${selected.contact.email}` : ''}
                  </span>
                  {selected.lead && <span className="tag" style={{ marginLeft: 8 }}>Lead: {selected.lead.stage}</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select value={assignedValue} onChange={(e) => assign(e.target.value)} aria-label="Assign conversation"
                    style={{ fontSize: 12, padding: '4px 8px' }}>
                    <option value="">Unassigned</option>
                    <optgroup label="Team">
                      {team.map((u) => <option key={u.id} value={`user:${u.id}`}>{u.name}</option>)}
                    </optgroup>
                    <optgroup label="AI employees (installed)">
                      {employees.filter((e) => e.installation?.enabled).map((e) => (
                        <option key={e.key} value={`ai:${e.key}`}>{e.name ?? e.key}</option>
                      ))}
                    </optgroup>
                  </select>
                  {['OPEN', 'WAITING', 'CLOSED'].map((s) => (
                    <button key={s} className="btn ghost sm" onClick={() => setStatus(s)}
                      style={selected.status === s ? { borderColor: 'var(--accent, #ffc629)', color: 'var(--accent, #ffc629)' } : {}}>
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div ref={timeline} style={{ flex: 1, overflowY: 'auto', padding: '12px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selected.messages.length === 0 && (
                  <div className="empty-state" style={{ padding: '24px 12px' }}>
                    <div className="e-ico">▤</div><h4>No messages yet</h4><p>Send the first message below.</p>
                  </div>
                )}
                {selected.messages.map((m: any) => (
                  <div key={m.id} style={{
                    alignSelf: m.isInternal ? 'stretch' : m.direction === 'INBOUND' ? 'flex-start' : 'flex-end',
                    maxWidth: m.isInternal ? '100%' : '78%',
                    background: m.isInternal ? 'rgba(255,198,41,0.08)' : m.direction === 'INBOUND' ? 'rgba(128,128,128,0.12)' : 'rgba(255,198,41,0.14)',
                    border: m.isInternal ? '1px dashed rgba(255,198,41,0.4)' : '1px solid rgba(128,128,128,0.25)',
                    borderRadius: 10, padding: '8px 12px',
                  }}>
                    {m.isInternal && <div className="muted" style={{ fontSize: 10, letterSpacing: 0.5, marginBottom: 2 }}>INTERNAL NOTE — not visible to the customer</div>}
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5 }}>{m.body}</div>
                    <div className="muted" style={{ fontSize: 10, marginTop: 4 }}>
                      {String(m.author).replace(/_/g, ' ').toLowerCase()} · {new Date(m.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid rgba(128,128,128,0.25)', paddingTop: 10 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <button className={`tab ${composerMode === 'reply' ? 'active' : ''}`} onClick={() => setComposerMode('reply')}>Reply</button>
                  <button className={`tab ${composerMode === 'note' ? 'active' : ''}`} onClick={() => setComposerMode('note')}>Internal note</button>
                  <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={suggest} disabled={suggesting}>
                    {suggesting ? 'Drafting…' : '✦ AI draft'}
                  </button>
                </div>
                <textarea value={composer} onChange={(e) => setComposer(e.target.value)} rows={3}
                  placeholder={composerMode === 'note' ? 'Write an internal note (never sent to the customer)…' : `Reply on ${selected.channel}…`}
                  style={{ width: '100%', resize: 'vertical' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 8, flexWrap: 'wrap' }}>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {composerMode === 'note' ? 'Notes stay inside your team.' : 'Replies send through your connected channel — no simulated delivery.'}
                  </span>
                  <button className="btn sm" onClick={send} disabled={sending || !composer.trim()}>
                    {sending ? 'Sending…' : composerMode === 'note' ? 'Save note' : 'Send'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Channel availability — honest setup state */}
      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Channels</h3>
        {channels === null ? <div className="skeleton" style={{ height: 60 }} /> : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {channels.map((c) => (
              <div className="agent-row" key={c.channel}>
                <span className="ico">{CHANNEL_ICON[c.channel] ?? '▤'}</span>
                <span style={{ flex: 1 }}>{c.channel}{c.note && <span className="muted" style={{ display: 'block', fontSize: 11 }}>{c.note}</span>}</span>
                {c.configured
                  ? <span className="chip ok">Connected</span>
                  : <span className="chip warn" title={`Requires ${c.requires}`}>Setup required</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Start a conversation">
        <div className="field"><label htmlFor="nc-name">Contact name</label>
          <input id="nc-name" value={nc.contactName} onChange={(e) => setNc({ ...nc, contactName: e.target.value })} placeholder="Sam Carter" /></div>
        <div className="grid-2">
          <div className="field"><label htmlFor="nc-phone">Phone</label>
            <input id="nc-phone" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} placeholder="+1 555 0100" /></div>
          <div className="field"><label htmlFor="nc-email">Email</label>
            <input id="nc-email" value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} placeholder="sam@example.com" /></div>
        </div>
        <div className="grid-2">
          <div className="field"><label htmlFor="nc-channel">Channel</label>
            <select id="nc-channel" value={nc.channel} onChange={(e) => setNc({ ...nc, channel: e.target.value })}>
              {['SMS', 'EMAIL', 'WHATSAPP', 'WEBCHAT', 'INTERNAL'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div className="field"><label htmlFor="nc-subject">Subject (optional)</label>
            <input id="nc-subject" value={nc.subject} onChange={(e) => setNc({ ...nc, subject: e.target.value })} /></div>
        </div>
        <div className="field"><label htmlFor="nc-body">First message (optional)</label>
          <textarea id="nc-body" rows={3} value={nc.body} onChange={(e) => setNc({ ...nc, body: e.target.value })} /></div>
        <div className="modal-actions">
          <button className="btn ghost sm" onClick={() => setNewOpen(false)}>Cancel</button>
          <button className="btn sm" disabled={creating || !nc.contactName.trim()} onClick={createConversation}>
            {creating ? 'Starting…' : 'Start conversation'}
          </button>
        </div>
      </Modal>
    </>
  );
}
