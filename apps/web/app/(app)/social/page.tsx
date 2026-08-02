'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';
import { Modal } from '../../../components/Modal';
import { useToast } from '../../../components/Toast';

const TABS = ['Posts', 'Calendar', 'Connections'] as const;
type Tab = (typeof TABS)[number];

const PLATFORM_LABEL: Record<string, string> = {
  facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn', tiktok: 'TikTok', youtube: 'YouTube', google_business: 'Google Business Profile',
};
const STATUS_CHIP: Record<string, string> = {
  DRAFT: 'warn', PENDING_APPROVAL: 'warn', APPROVED: 'ok', SCHEDULED: 'ok', PUBLISHED: 'ok', FAILED: 'err', CANCELLED: 'err',
};

/**
 * Social Media V1 — a real content planning + approval system. Honest core:
 * no platform publishing API is connected, so PUBLISHED only ever means a
 * human confirmed they posted it manually. No fake analytics, ever.
 */
export default function SocialPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('Posts');
  const [posts, setPosts] = useState<any[] | null>(null);
  const [connections, setConnections] = useState<any[] | null>(null);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ platform: 'facebook', caption: '', scheduledFor: '', mediaRefs: '' });
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [publishFor, setPublishFor] = useState<any>(null);
  const [publishNote, setPublishNote] = useState('');

  const load = useCallback(() => { api.socialPosts().then(setPosts).catch(() => setPosts([])); }, []);
  useEffect(() => { load(); api.socialConnections().then(setConnections).catch(() => setConnections([])); }, [load]);

  const openEditor = (post?: any) => {
    setEditing(post ?? null);
    setForm(post
      ? { platform: post.platform, caption: post.caption, scheduledFor: post.scheduledFor ? post.scheduledFor.slice(0, 16) : '', mediaRefs: (post.mediaRefs ?? []).join(', ') }
      : { platform: 'facebook', caption: '', scheduledFor: '', mediaRefs: '' });
    setEditorOpen(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      const body = {
        platform: form.platform, caption: form.caption,
        scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toISOString() : null,
        mediaRefs: form.mediaRefs ? form.mediaRefs.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
      };
      if (editing) await api.updateSocialPost(editing.id, body);
      else await api.createSocialPost(body as any);
      setEditorOpen(false); load();
      toast.success(editing ? 'Post updated' : 'Draft created');
    } catch (e: any) { toast.error('Could not save', String(e?.message ?? '').slice(0, 180)); }
    finally { setBusy(false); }
  };

  const aiDraft = async () => {
    setDrafting(true);
    try {
      const r = await api.aiDraftSocial({ platform: form.platform });
      if (r.available) { setForm({ ...form, caption: r.draft }); toast.success('Caption drafted', 'Review and edit — approval still required.'); }
      else toast.error('AI drafting unavailable', r.reason);
    } catch { toast.error('Could not draft'); }
    finally { setDrafting(false); }
  };

  const act = async (id: string, action: 'submit' | 'approve' | 'reject' | 'cancel', ok: string) => {
    try { await api.socialAction(id, action); load(); toast.success(ok); }
    catch (e: any) { toast.error('Action failed', String(e?.message ?? '').replace(/^\d+\s*/, '').slice(0, 200)); }
  };

  const markPublished = async () => {
    if (!publishFor) return;
    setBusy(true);
    try {
      await api.markSocialPublished(publishFor.id, publishNote || undefined);
      setPublishFor(null); setPublishNote(''); load();
      toast.success('Marked published', 'Recorded as manually posted by you.');
    } catch (e: any) { toast.error('Could not mark published', String(e?.message ?? '').slice(0, 180)); }
    finally { setBusy(false); }
  };

  const exportContent = async () => {
    try {
      const data = await api.socialExport();
      if (!data.count) { toast.error('Nothing to export', 'Only approved/scheduled posts are exported.'); return; }
      const text = data.posts.map((p: any) =>
        `[${PLATFORM_LABEL[p.platform] ?? p.platform}] ${p.scheduledFor ? new Date(p.scheduledFor).toLocaleString() : 'unscheduled'}\n${p.caption}\n`,
      ).join('\n---\n\n');
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${data.count} post${data.count > 1 ? 's' : ''} to clipboard`);
    } catch { toast.error('Export failed'); }
  };

  // Calendar grid for the selected month
  const calendar = useMemo(() => {
    const year = month.getFullYear(), m = month.getMonth();
    const first = new Date(year, m, 1);
    const days: { date: Date; posts: any[] }[] = [];
    for (let d = 0; d < new Date(year, m + 1, 0).getDate(); d++) {
      const date = new Date(year, m, d + 1);
      days.push({
        date,
        posts: (posts ?? []).filter((p) => p.scheduledFor && new Date(p.scheduledFor).toDateString() === date.toDateString()),
      });
    }
    return { days, offset: first.getDay() };
  }, [month, posts]);

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Social Media</h2>
          <span className="muted">Plan, approve and track content — publishing stays honest</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost sm" onClick={exportContent}>Export approved</button>
          <button className="btn sm" onClick={() => openEditor()}>+ New post</button>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === 'Posts' && (
        posts === null ? <div className="panel"><div className="skeleton" style={{ height: 160 }} /></div> :
        posts.length === 0 ? (
          <div className="panel empty-state" style={{ padding: '56px 24px' }}>
            <div className="e-ico" style={{ width: 56, height: 56, fontSize: 26 }}>⬡</div>
            <h4 style={{ fontSize: 16 }}>Create your first post</h4>
            <p>Draft content (with AI help), route it through approval, schedule it, and export it for posting. No platform account connection is required to plan.</p>
            <button className="btn sm" onClick={() => openEditor()}>+ New post</button>
          </div>
        ) : (
          <div className="grid">
            {posts.map((p) => (
              <div className="panel" key={p.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{PLATFORM_LABEL[p.platform] ?? p.platform}</strong>
                  <span className={`chip ${STATUS_CHIP[p.status] ?? 'warn'}`} style={{ fontSize: 10 }}>{String(p.status).replace(/_/g, ' ')}</span>
                </div>
                <p style={{ fontSize: 13, whiteSpace: 'pre-wrap', minHeight: 40, margin: '8px 0' }}>{(p.caption || '(no caption yet)').slice(0, 220)}</p>
                <div className="muted" style={{ fontSize: 11, marginBottom: 8 }}>
                  {p.scheduledFor ? `Scheduled ${new Date(p.scheduledFor).toLocaleString()}` : 'Not scheduled'}
                  {p.publishedAt && ` · Published ${new Date(p.publishedAt).toLocaleDateString()}`}
                </div>
                {p.publishNote && <div className="muted" style={{ fontSize: 10, marginBottom: 8 }}>{p.publishNote}</div>}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {p.status !== 'PUBLISHED' && p.status !== 'CANCELLED' && <button className="btn ghost sm" onClick={() => openEditor(p)}>Edit</button>}
                  {p.status === 'DRAFT' && <button className="btn ghost sm" onClick={() => act(p.id, 'submit', 'Submitted for approval')}>Submit for approval</button>}
                  {p.status === 'PENDING_APPROVAL' && (
                    <>
                      <button className="btn sm" onClick={() => act(p.id, 'approve', 'Approved')}>Approve (admin)</button>
                      <button className="btn ghost sm" onClick={() => act(p.id, 'reject', 'Sent back to draft')}>Reject</button>
                    </>
                  )}
                  {['APPROVED', 'SCHEDULED'].includes(p.status) && (
                    <button className="btn sm" onClick={() => { setPublishFor(p); setPublishNote(''); }}>I posted this — mark published</button>
                  )}
                  {!['PUBLISHED', 'CANCELLED'].includes(p.status) && <button className="btn ghost sm" onClick={() => act(p.id, 'cancel', 'Cancelled')}>Cancel</button>}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'Calendar' && (
        <div className="panel">
          <div className="topbar" style={{ marginBottom: 10 }}>
            <button className="btn ghost sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>← Prev</button>
            <h3 style={{ margin: 0 }}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
            <button className="btn ghost sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>Next →</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, overflowX: 'auto' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="muted" style={{ fontSize: 11, textAlign: 'center' }}>{d}</div>)}
            {Array.from({ length: calendar.offset }).map((_, i) => <div key={`pad-${i}`} />)}
            {calendar.days.map(({ date, posts: dayPosts }) => (
              <div key={date.toISOString()} style={{ minHeight: 64, border: '1px solid rgba(128,128,128,0.15)', borderRadius: 6, padding: 4 }}>
                <div className="muted" style={{ fontSize: 10 }}>{date.getDate()}</div>
                {dayPosts.map((p) => (
                  <button key={p.id} onClick={() => openEditor(p)} className="tag" style={{ display: 'block', width: '100%', fontSize: 9, marginTop: 2, cursor: 'pointer', textAlign: 'left', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {PLATFORM_LABEL[p.platform]?.slice(0, 2) ?? '•'} {p.caption?.slice(0, 18) || p.status}
                  </button>
                ))}
              </div>
            ))}
          </div>
          {(posts ?? []).filter((p) => p.scheduledFor).length === 0 && (
            <p className="muted" style={{ fontSize: 12, marginTop: 10, textAlign: 'center' }}>No scheduled posts this view — schedule a draft to see it on the calendar.</p>
          )}
        </div>
      )}

      {tab === 'Connections' && (
        <div className="panel">
          <h3>Platform connections</h3>
          {connections === null ? <div className="skeleton" style={{ height: 80 }} /> : (
            connections.map((c) => (
              <div className="agent-row" key={c.platform}>
                <span style={{ flex: 1 }}>{PLATFORM_LABEL[c.platform] ?? c.platform}
                  <span className="muted" style={{ display: 'block', fontSize: 11 }}>{c.note}</span></span>
                <span className="chip warn">Not connected</span>
              </div>
            ))
          )}
          <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
            Direct publishing integrations aren&rsquo;t built yet — this workspace gives you an honest plan → approve → export → post-manually workflow, and records exactly what happened. Analytics appear only when a real provider supplies them.
          </p>
        </div>
      )}

      {/* Editor */}
      <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editing ? 'Edit post' : 'New post'}>
        <div className="grid-2">
          <div className="field"><label>Platform</label>
            <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
              {Object.entries(PLATFORM_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div className="field"><label>Schedule for (optional)</label>
            <input type="datetime-local" value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} /></div>
        </div>
        <div className="field">
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Caption</span>
            <button className="btn ghost sm" onClick={aiDraft} disabled={drafting}>{drafting ? 'Drafting…' : '✦ AI draft'}</button>
          </label>
          <textarea rows={5} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
        </div>
        <div className="field"><label>Media references (URLs, comma-separated — optional)</label>
          <input value={form.mediaRefs} onChange={(e) => setForm({ ...form, mediaRefs: e.target.value })} placeholder="https://…/before.jpg, https://…/after.jpg" /></div>
        <div className="modal-actions">
          <button className="btn ghost sm" onClick={() => setEditorOpen(false)}>Cancel</button>
          <button className="btn sm" disabled={busy} onClick={save}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create draft'}</button>
        </div>
      </Modal>

      {/* Honest manual-publish confirmation */}
      <Modal open={!!publishFor} onClose={() => setPublishFor(null)} title="Confirm manual publish">
        <p style={{ fontSize: 13 }}>
          No platform integration is connected, so SOFILIC never posts for you. Confirming here records that <strong>you</strong> posted this on {PLATFORM_LABEL[publishFor?.platform] ?? publishFor?.platform} yourself.
        </p>
        <div className="field"><label>Note (optional — e.g. the post URL)</label>
          <input value={publishNote} onChange={(e) => setPublishNote(e.target.value)} placeholder="https://facebook.com/…" /></div>
        <div className="modal-actions">
          <button className="btn ghost sm" onClick={() => setPublishFor(null)}>Cancel</button>
          <button className="btn sm" disabled={busy} onClick={markPublished}>{busy ? 'Saving…' : 'Yes, I posted it'}</button>
        </div>
      </Modal>
    </>
  );
}
