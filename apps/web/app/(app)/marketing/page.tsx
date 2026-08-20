'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Modal } from '../../../components/Modal';
import { useToast } from '../../../components/Toast';

const TABS = ['Campaigns', 'Templates', 'Reputation'] as const;
type Tab = (typeof TABS)[number];

const CAMPAIGN_CHIP: Record<string, string> = { DRAFT: 'warn', SCHEDULED: 'warn', ACTIVE: 'ok', PAUSED: 'warn', COMPLETED: 'ok', CANCELLED: 'err' };
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const Stars = ({ n }: { n: number }) => <span aria-label={`${n} stars`} style={{ color: '#ffc629' }}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>;

/**
 * Marketing V1 — real campaigns to your real contacts (per-recipient send
 * truth, admin approval before anything goes out) plus the Reviews/reputation
 * workflow. No fabricated opens, clicks or deliveries anywhere.
 */
export default function MarketingPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('Campaigns');

  // Campaigns
  const [campaigns, setCampaigns] = useState<any[] | null>(null);
  const [templates, setTemplates] = useState<any[] | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [cw, setCw] = useState<any>({ name: '', channel: 'SMS', subject: '', content: '', tags: '', goalId: '', isTemplate: false });
  const [preview, setPreview] = useState<any>(null);
  const [goals, setGoals] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);

  // Reviews
  const [summary, setSummary] = useState<any>(null);
  const [reviews, setReviews] = useState<any[] | null>(null);
  const [requests, setRequests] = useState<any[] | null>(null);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'needs' | 'negative'>('all');
  const [respondFor, setRespondFor] = useState<any>(null);
  const [responseText, setResponseText] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [rr, setRr] = useState({ contactId: '', channel: 'SMS', message: '' });
  const [recordOpen, setRecordOpen] = useState(false);
  const [nr, setNr] = useState({ contactId: '', source: 'DIRECT', rating: '5', text: '' });

  const loadCampaigns = useCallback(() => {
    api.campaigns().then(setCampaigns).catch(() => setCampaigns([]));
    api.campaigns({ templates: true }).then(setTemplates).catch(() => setTemplates([]));
  }, []);
  const loadReviews = useCallback(() => {
    api.reviewsSummary().then(setSummary).catch(() => setSummary(false));
    const params = reviewFilter === 'needs' ? { responseStatus: 'NEEDS_RESPONSE' } : reviewFilter === 'negative' ? { maxRating: 3 } : undefined;
    api.reviews(params).then(setReviews).catch(() => setReviews([]));
    api.reviewRequests().then(setRequests).catch(() => setRequests([]));
  }, [reviewFilter]);

  useEffect(() => { loadCampaigns(); api.goals({ status: 'ACTIVE' }).then(setGoals).catch(() => {}); }, [loadCampaigns]);
  useEffect(() => { if (tab === 'Reputation') loadReviews(); }, [tab, loadReviews]);
  useEffect(() => { if (requestOpen || recordOpen) api.contacts().then(setContacts).catch(() => setContacts([])); }, [requestOpen, recordOpen]);

  const previewAudience = async () => {
    const audience = cw.tags ? { tags: cw.tags.split(',').map((t: string) => t.trim()).filter(Boolean) } : {};
    setPreview(await api.previewAudience(audience, cw.channel).catch(() => null));
  };

  const aiDraft = async () => {
    setDrafting(true);
    try {
      const r = await api.aiDraftCampaign({ channel: cw.channel, goal: cw.name || undefined });
      if (r.available) {
        if (cw.channel === 'EMAIL' && r.draft.includes('\n\n')) {
          const [subject, ...rest] = r.draft.split('\n\n');
          setCw({ ...cw, subject: subject.replace(/^subject:\s*/i, ''), content: rest.join('\n\n') });
        } else setCw({ ...cw, content: r.draft });
        toast.success('Draft ready', 'Edit it, then request approval before sending.');
      } else toast.error('AI drafting unavailable', r.reason);
    } catch { toast.error('Could not draft'); }
    finally { setDrafting(false); }
  };

  const createCampaign = async () => {
    if (!cw.name.trim()) return;
    setBusy(true);
    try {
      const audience = cw.tags ? { tags: cw.tags.split(',').map((t: string) => t.trim()).filter(Boolean) } : {};
      await api.createCampaign({
        name: cw.name.trim(), channel: cw.channel, subject: cw.subject || undefined, content: cw.content,
        audience, goalId: cw.goalId || undefined, isTemplate: cw.isTemplate,
      });
      setWizardOpen(false); setCw({ name: '', channel: 'SMS', subject: '', content: '', tags: '', goalId: '', isTemplate: false }); setPreview(null);
      loadCampaigns(); toast.success(cw.isTemplate ? 'Template saved' : 'Campaign created', cw.isTemplate ? '' : 'It needs admin approval before it can send.');
    } catch (e: any) { toast.error('Could not create', String(e?.message ?? '').slice(0, 180)); }
    finally { setBusy(false); }
  };

  const openDetail = async (id: string) => {
    try {
      setDetail(await api.campaign(id));
      setMetrics(await api.campaignMetrics(id).catch(() => null));
    } catch { toast.error('Could not load the campaign'); }
  };

  const act = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); loadCampaigns(); if (detail) openDetail(detail.id); }
    catch (e: any) { toast.error('Action failed', String(e?.message ?? '').replace(/^\d+\s*/, '').slice(0, 220)); }
    finally { setBusy(false); }
  };

  const draftResponse = async (review: any) => {
    try {
      const r = await api.draftReviewResponse(review.id);
      if (r.available) { setRespondFor(review); setResponseText(r.draft); }
      else toast.error('AI drafting unavailable', r.reason);
    } catch { toast.error('Could not draft a response'); }
  };

  const sendRequest = async () => {
    if (!rr.contactId) return;
    setBusy(true);
    try {
      const r = await api.sendReviewRequest({ contactId: rr.contactId, channel: rr.channel, message: rr.message || undefined });
      if (r.status === 'FAILED') toast.error('Send failed', r.error ?? '');
      else toast.success('Review request sent');
      setRequestOpen(false); setRr({ contactId: '', channel: 'SMS', message: '' }); loadReviews();
    } catch (e: any) { toast.error('Could not send', String(e?.message ?? '').replace(/^\d+\s*/, '').slice(0, 220)); }
    finally { setBusy(false); }
  };

  const recordReview = async () => {
    setBusy(true);
    try {
      await api.recordReview({ contactId: nr.contactId || undefined, source: nr.source, rating: Number(nr.rating), text: nr.text || undefined });
      setRecordOpen(false); setNr({ contactId: '', source: 'DIRECT', rating: '5', text: '' }); loadReviews();
      toast.success('Review recorded');
    } catch (e: any) { toast.error('Could not record', String(e?.message ?? '').slice(0, 180)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Marketing</h2>
          <span className="muted">Campaigns and reputation — real sends, real numbers, nothing simulated</span>
        </div>
        {tab === 'Campaigns' && <button className="btn sm" onClick={() => { setCw({ ...cw, isTemplate: false }); setWizardOpen(true); }}>+ New campaign</button>}
        {tab === 'Reputation' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost sm" onClick={() => setRecordOpen(true)}>+ Record a review</button>
            <button className="btn sm" onClick={() => setRequestOpen(true)}>+ Request a review</button>
          </div>
        )}
      </div>

      <div className="tabs">
        {TABS.map((t) => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {/* ── Campaigns ─────────────────────────────────────────────── */}
      {tab === 'Campaigns' && (
        campaigns === null ? <div className="panel"><div className="skeleton" style={{ height: 160 }} /></div> :
        campaigns.length === 0 ? (
          <div className="panel empty-state" style={{ padding: '56px 24px' }}>
            <div className="e-ico" style={{ width: 56, height: 56, fontSize: 26 }}>◬</div>
            <h4 style={{ fontSize: 16 }}>Create your first campaign</h4>
            <p>Send an SMS or email campaign to a real segment of your contacts. Admin approval is required before anything goes out.</p>
            <button className="btn sm" onClick={() => setWizardOpen(true)}>+ New campaign</button>
          </div>
        ) : (
          <div className="panel" style={{ overflowX: 'auto' }}>
            <table className="t">
              <thead><tr><th>Campaign</th><th>Channel</th><th>Status</th><th>Recipients</th><th>Leads</th><th>Approval</th><th /></tr></thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong>{c.goalId && <span className="tag" style={{ marginLeft: 6, fontSize: 10 }}>goal-linked</span>}</td>
                    <td className="muted">{c.channel}</td>
                    <td><span className={`chip ${CAMPAIGN_CHIP[c.status] ?? 'warn'}`}>{c.status}</span></td>
                    <td className="muted">{c._count?.recipients ?? 0}</td>
                    <td className="muted">{c._count?.leads ?? 0}</td>
                    <td>{c.approvedAt ? <span className="chip ok">Approved</span> : <span className="chip warn">Needs approval</span>}</td>
                    <td style={{ textAlign: 'right' }}><button className="btn ghost sm" onClick={() => openDetail(c.id)}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── Templates ─────────────────────────────────────────────── */}
      {tab === 'Templates' && (
        templates === null ? <div className="panel"><div className="skeleton" style={{ height: 120 }} /></div> :
        templates.length === 0 ? (
          <div className="panel empty-state" style={{ padding: '56px 24px' }}>
            <div className="e-ico" style={{ width: 56, height: 56, fontSize: 26 }}>▤</div>
            <h4 style={{ fontSize: 16 }}>No templates yet</h4>
            <p>Save reusable campaign messages for the outreach you send most often.</p>
            <button className="btn sm" onClick={() => { setCw({ ...cw, isTemplate: true }); setWizardOpen(true); }}>+ New template</button>
          </div>
        ) : (
          <div className="grid">
            {templates.map((t) => (
              <div className="panel" key={t.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{t.name}</strong><span className="tag">{t.channel}</span>
                </div>
                <p className="muted" style={{ fontSize: 12.5, minHeight: 40 }}>{(t.content || '').slice(0, 140) || 'No content yet'}</p>
                <button className="btn ghost sm" onClick={async () => {
                  try {
                    await api.createCampaign({ name: `${t.name} — ${new Date().toLocaleDateString()}`, channel: t.channel, subject: t.subject ?? undefined, content: t.content, audience: t.audience ?? {} });
                    loadCampaigns(); setTab('Campaigns'); toast.success('Campaign created from template');
                  } catch { toast.error('Could not create from template'); }
                }}>Use template</button>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Reputation (Reviews V1) ───────────────────────────────── */}
      {tab === 'Reputation' && (
        <>
          <div className="grid-kpi" style={{ marginBottom: 16 }}>
            <div className="panel"><div className="muted">Average rating</div>
              <div className="kpi">{summary === null ? '…' : summary === false || summary.averageRating == null ? '—' : summary.averageRating}</div>
              <div className="kpi-delta muted">{summary && summary !== false ? `${summary.total} review${summary.total === 1 ? '' : 's'} recorded` : 'No reviews yet'}</div></div>
            <div className="panel"><div className="muted">Needs response</div>
              <div className="kpi">{summary && summary !== false ? summary.needsResponse : '—'}</div>
              <div className="kpi-delta muted">Unanswered reviews</div></div>
            <div className="panel"><div className="muted">Negative (≤3★)</div>
              <div className="kpi">{summary && summary !== false ? summary.negative : '—'}</div>
              <div className="kpi-delta muted">Follow up personally</div></div>
            <div className="panel"><div className="muted">Requests sent (30d)</div>
              <div className="kpi">{summary && summary !== false ? summary.requestsSent30d : '—'}</div>
              <div className="kpi-delta muted">Via SMS / email</div></div>
          </div>

          <div className="tabs">
            {([['all', 'All reviews'], ['needs', 'Needs response'], ['negative', 'Negative']] as const).map(([k, label]) => (
              <button key={k} className={`tab ${reviewFilter === k ? 'active' : ''}`} onClick={() => setReviewFilter(k)}>{label}</button>
            ))}
          </div>

          <div className="grid-2" style={{ alignItems: 'start' }}>
            <div className="panel">
              <h3>Reviews</h3>
              {reviews === null ? <div className="skeleton" style={{ height: 120 }} /> :
              reviews.length === 0 ? (
                <div className="empty-state" style={{ padding: '32px 16px' }}>
                  <div className="e-ico">★</div><h4>No reviews recorded yet</h4>
                  <p>Record reviews you receive on Google, Facebook or directly — then draft responses with AI and track follow-ups. Platform sync isn&rsquo;t connected yet, so recording is manual and honest.</p>
                </div>
              ) : reviews.map((r) => (
                <div key={r.id} style={{ borderBottom: '1px solid rgba(128,128,128,0.15)', padding: '10px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <span><Stars n={r.rating} /> <strong style={{ marginLeft: 6 }}>{r.contact?.name ?? 'Anonymous'}</strong>
                      <span className="tag" style={{ marginLeft: 6, fontSize: 10 }}>{r.source}</span></span>
                    <span className="muted" style={{ fontSize: 11 }}>{new Date(r.reviewedAt).toLocaleDateString()}</span>
                  </div>
                  {r.text && <p style={{ margin: '6px 0', fontSize: 13 }}>{r.text}</p>}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className={`chip ${r.responseStatus === 'RESPONDED' ? 'ok' : r.responseStatus === 'NEEDS_RESPONSE' ? 'err' : 'warn'}`} style={{ fontSize: 10 }}>
                      {String(r.responseStatus).replace(/_/g, ' ')}
                    </span>
                    {r.responseStatus !== 'RESPONDED' && r.responseStatus !== 'DISMISSED' && (
                      <>
                        <button className="btn ghost sm" onClick={() => draftResponse(r)}>✦ AI draft response</button>
                        <button className="btn ghost sm" onClick={() => { setRespondFor(r); setResponseText(r.responseDraft ?? ''); }}>Respond</button>
                        <button className="btn ghost sm" onClick={async () => { await api.dismissReview(r.id).catch(() => {}); loadReviews(); }}>Dismiss</button>
                      </>
                    )}
                    <button className="btn ghost sm" onClick={async () => { await api.reviewFollowUp(r.id).catch(() => {}); toast.success('Follow-up task created'); }}>+ Follow-up task</button>
                  </div>
                  {r.responseText && <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Your response: {r.responseText}</p>}
                </div>
              ))}
            </div>

            <div className="panel">
              <h3>Review requests</h3>
              {requests === null ? <div className="skeleton" style={{ height: 80 }} /> :
              requests.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 16px' }}>
                  <div className="e-ico" style={{ width: 40, height: 40, fontSize: 18 }}>⟳</div>
                  <h4 style={{ fontSize: 13.5 }}>No requests sent yet</h4>
                  <p style={{ fontSize: 12.5 }}>Send a &ldquo;how did we do?&rdquo; message to a customer. Requires a connected SMS or email integration — nothing is simulated.</p>
                </div>
              ) : requests.map((rq) => (
                <div className="agent-row" key={rq.id}>
                  <span style={{ flex: 1 }}>{rq.contact?.name}<span className="muted" style={{ fontSize: 11, display: 'block' }}>{rq.channel} · {new Date(rq.createdAt).toLocaleDateString()}</span></span>
                  <span className={`chip ${rq.status === 'SENT' || rq.status === 'COMPLETED' ? 'ok' : rq.status === 'FAILED' ? 'err' : 'warn'}`} style={{ fontSize: 10 }} title={rq.error ?? ''}>{rq.status}</span>
                </div>
              ))}
              <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
                External platforms (Google, Facebook) aren&rsquo;t connected for publishing — responses you approve here are posted by you on the platform, and we track that honestly.
              </p>
            </div>
          </div>
        </>
      )}

      {/* ── Campaign wizard ───────────────────────────────────────── */}
      <Modal open={wizardOpen} onClose={() => setWizardOpen(false)} title={cw.isTemplate ? 'New template' : 'New campaign'}>
        <div className="field"><label>Name</label>
          <input value={cw.name} onChange={(e) => setCw({ ...cw, name: e.target.value })} placeholder="Spring tune-up outreach" /></div>
        <div className="grid-2">
          <div className="field"><label>Channel</label>
            <select value={cw.channel} onChange={(e) => setCw({ ...cw, channel: e.target.value })}>
              <option value="SMS">SMS</option><option value="EMAIL">Email</option>
            </select></div>
          <div className="field"><label>Goal (optional)</label>
            <select value={cw.goalId} onChange={(e) => setCw({ ...cw, goalId: e.target.value })}>
              <option value="">None</option>
              {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select></div>
        </div>
        {cw.channel === 'EMAIL' && (
          <div className="field"><label>Subject</label>
            <input value={cw.subject} onChange={(e) => setCw({ ...cw, subject: e.target.value })} /></div>
        )}
        <div className="field">
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Message ({'{{name}}'} inserts the first name)</span>
            <button className="btn ghost sm" onClick={aiDraft} disabled={drafting}>{drafting ? 'Drafting…' : '✦ AI draft'}</button>
          </label>
          <textarea rows={5} value={cw.content} onChange={(e) => setCw({ ...cw, content: e.target.value })} />
        </div>
        {!cw.isTemplate && (
          <div className="field"><label>Audience — contact tags (comma-separated, empty = all contacts)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ flex: 1 }} value={cw.tags} onChange={(e) => setCw({ ...cw, tags: e.target.value })} placeholder="vip, past-customer" />
              <button className="btn ghost sm" onClick={previewAudience}>Preview</button>
            </div>
            {preview && (
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {preview.total} contact{preview.total === 1 ? '' : 's'} match · {preview.reachable} reachable on {cw.channel}
                {preview.unreachable > 0 ? ` · ${preview.unreachable} would be skipped (no ${cw.channel === 'EMAIL' ? 'email' : 'phone'})` : ''}
              </p>
            )}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn ghost sm" onClick={() => setWizardOpen(false)}>Cancel</button>
          <button className="btn sm" disabled={busy || !cw.name.trim()} onClick={createCampaign}>
            {busy ? 'Saving…' : cw.isTemplate ? 'Save template' : 'Create campaign'}
          </button>
        </div>
      </Modal>

      {/* ── Campaign detail ───────────────────────────────────────── */}
      <Modal open={!!detail} onClose={() => { setDetail(null); setMetrics(null); }} title={detail?.name ?? ''}>
        {detail && (
          <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <span className={`chip ${CAMPAIGN_CHIP[detail.status] ?? 'warn'}`}>{detail.status}</span>
              <span className="tag">{detail.channel}</span>
              {detail.approvedAt ? <span className="chip ok">Approved</span> : <span className="chip warn">Needs admin approval</span>}
              {detail.scheduledAt && detail.status === 'SCHEDULED' && <span className="tag">Sends {new Date(detail.scheduledAt).toLocaleString()}</span>}
            </div>
            {['DRAFT', 'SCHEDULED'].includes(detail.status) && !detail.isTemplate && (
              <div className="field" style={{ marginBottom: 8, maxWidth: 320 }}>
                <label>Schedule automatic send (your local time)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="datetime-local" id={`sched-${detail.id}`} defaultValue={detail.scheduledAt ? new Date(new Date(detail.scheduledAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} />
                  <button className="btn ghost sm" disabled={busy} onClick={() => {
                    const el = document.getElementById(`sched-${detail.id}`) as HTMLInputElement | null;
                    if (!el?.value) return;
                    act(() => api.updateCampaign(detail.id, { scheduledAt: new Date(el.value).toISOString() }), 'Scheduled — it sends automatically once approved');
                  }}>Schedule</button>
                  {detail.scheduledAt && <button className="btn ghost sm" disabled={busy} onClick={() => act(() => api.updateCampaign(detail.id, { scheduledAt: null }), 'Schedule removed')}>Unschedule</button>}
                </div>
                {(detail.meta as any)?.pausedReason && <p className="muted" style={{ fontSize: 11 }}>Paused: {(detail.meta as any).pausedReason}</p>}
              </div>
            )}
            <p style={{ whiteSpace: 'pre-wrap', fontSize: 13, background: 'rgba(128,128,128,0.08)', padding: 10, borderRadius: 8 }}>
              {detail.subject && <strong style={{ display: 'block' }}>{detail.subject}</strong>}{detail.content || 'No content yet'}
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
              {!detail.approvedAt && <button className="btn sm" disabled={busy} onClick={() => act(() => api.approveCampaign(detail.id), 'Campaign approved')}>Approve (admin)</button>}
              {['DRAFT', 'SCHEDULED', 'PAUSED'].includes(detail.status) && !detail.isTemplate && (
                <button className="btn sm" disabled={busy} onClick={() => act(() => api.startCampaign(detail.id), 'Campaign sent')}>
                  {busy ? 'Working…' : 'Start sending now'}
                </button>
              )}
              {detail.status === 'ACTIVE' && <button className="btn ghost sm" disabled={busy} onClick={() => act(() => api.pauseCampaign(detail.id), 'Paused')}>Pause</button>}
              {['COMPLETED', 'PAUSED'].includes(detail.status) && (detail.recipients ?? []).some((r: any) => r.status === 'FAILED') && (
                <button className="btn ghost sm" disabled={busy} onClick={() => act(() => api.campaignRetryFailed(detail.id), 'Retried failed recipients')}>Retry failed only</button>
              )}
              {!['COMPLETED', 'CANCELLED'].includes(detail.status) && (
                <button className="btn ghost sm" disabled={busy} onClick={() => act(() => api.cancelCampaign(detail.id), 'Cancelled')}>Cancel campaign</button>
              )}
            </div>
            {metrics && (
              <>
                <h4 style={{ margin: '10px 0 6px' }}>Performance (real numbers only)</h4>
                <div className="grid-kpi">
                  <div className="panel"><div className="muted">Sent</div><div className="kpi">{metrics.recipients.sent}</div></div>
                  <div className="panel"><div className="muted">Failed</div><div className="kpi">{metrics.recipients.failed}</div></div>
                  <div className="panel"><div className="muted">Skipped</div><div className="kpi">{metrics.recipients.skipped}</div></div>
                  <div className="panel"><div className="muted">Attributed leads</div><div className="kpi">{metrics.attributedLeads}</div></div>
                </div>
                <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>
                  Attributed revenue: {money(metrics.attributedRevenue.amount)} <span className="tag" style={{ fontSize: 9 }}>ESTIMATED</span> — {metrics.attributedRevenue.note} Opens/clicks/delivery confirmations are not tracked in V1, so they are not shown.
                </p>
              </>
            )}
            {detail.recipients?.length > 0 && (
              <>
                <h4 style={{ margin: '10px 0 6px' }}>Recipients</h4>
                {detail.recipients.slice(0, 50).map((r: any) => (
                  <div className="agent-row" key={r.id}>
                    <span style={{ flex: 1 }}>{r.contact?.name}</span>
                    <span className={`chip ${r.status === 'SENT' ? 'ok' : r.status === 'FAILED' ? 'err' : 'warn'}`} style={{ fontSize: 10 }} title={r.error ?? ''}>{r.status}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ── Respond to review ─────────────────────────────────────── */}
      <Modal open={!!respondFor} onClose={() => setRespondFor(null)} title="Respond to review">
        {respondFor && (
          <>
            <p style={{ fontSize: 13 }}><Stars n={respondFor.rating} /> {respondFor.text ?? '(no text)'}</p>
            <div className="field"><label>Your response (you post it on the platform yourself — we record it)</label>
              <textarea rows={4} value={responseText} onChange={(e) => setResponseText(e.target.value)} /></div>
            <div className="modal-actions">
              <button className="btn ghost sm" onClick={() => setRespondFor(null)}>Cancel</button>
              <button className="btn sm" disabled={!responseText.trim() || busy} onClick={async () => {
                setBusy(true);
                try { await api.respondReview(respondFor.id, responseText); setRespondFor(null); loadReviews(); toast.success('Response recorded'); }
                catch { toast.error('Could not record the response'); }
                finally { setBusy(false); }
              }}>Approve &amp; record</button>
            </div>
          </>
        )}
      </Modal>

      {/* ── Send review request ───────────────────────────────────── */}
      <Modal open={requestOpen} onClose={() => setRequestOpen(false)} title="Request a review">
        <div className="field"><label>Customer</label>
          <select value={rr.contactId} onChange={(e) => setRr({ ...rr, contactId: e.target.value })}>
            <option value="">Choose a contact…</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : c.email ? ` · ${c.email}` : ''}</option>)}
          </select></div>
        <div className="field"><label>Channel</label>
          <select value={rr.channel} onChange={(e) => setRr({ ...rr, channel: e.target.value })}>
            <option value="SMS">SMS</option><option value="EMAIL">Email</option>
          </select></div>
        <div className="field"><label>Message (optional — a sensible default is used)</label>
          <textarea rows={3} value={rr.message} onChange={(e) => setRr({ ...rr, message: e.target.value })} /></div>
        <div className="modal-actions">
          <button className="btn ghost sm" onClick={() => setRequestOpen(false)}>Cancel</button>
          <button className="btn sm" disabled={!rr.contactId || busy} onClick={sendRequest}>{busy ? 'Sending…' : 'Send request'}</button>
        </div>
      </Modal>

      {/* ── Record a review ───────────────────────────────────────── */}
      <Modal open={recordOpen} onClose={() => setRecordOpen(false)} title="Record a review you received">
        <div className="grid-2">
          <div className="field"><label>Customer (optional)</label>
            <select value={nr.contactId} onChange={(e) => setNr({ ...nr, contactId: e.target.value })}>
              <option value="">Not linked</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div className="field"><label>Source</label>
            <select value={nr.source} onChange={(e) => setNr({ ...nr, source: e.target.value })}>
              {['GOOGLE', 'FACEBOOK', 'YELP', 'DIRECT', 'OTHER'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select></div>
        </div>
        <div className="field"><label>Rating</label>
          <select value={nr.rating} onChange={(e) => setNr({ ...nr, rating: e.target.value })}>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}
          </select></div>
        <div className="field"><label>Review text (optional)</label>
          <textarea rows={3} value={nr.text} onChange={(e) => setNr({ ...nr, text: e.target.value })} /></div>
        <div className="modal-actions">
          <button className="btn ghost sm" onClick={() => setRecordOpen(false)}>Cancel</button>
          <button className="btn sm" disabled={busy} onClick={recordReview}>{busy ? 'Saving…' : 'Record review'}</button>
        </div>
      </Modal>
    </>
  );
}
