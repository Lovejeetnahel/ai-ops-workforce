'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Modal } from '../../../components/Modal';
import { useToast } from '../../../components/Toast';
import { SiteRenderer } from '../../../components/SiteRenderer';

const SECTION_TYPES = ['hero', 'services', 'testimonials', 'faq', 'contact', 'cta'] as const;

/**
 * Websites V1 — a real site/landing-page system: typed sections, drafts,
 * revisions, honest publishing (/s/<site>/<page>), SEO fields and real form
 * submissions that create CRM leads. Custom domains are setup-required.
 */
export default function WebsitesPage() {
  const toast = useToast();
  const [sites, setSites] = useState<any[] | null>(null);
  const [page, setPage] = useState<any>(null); // the open page (editor)
  const [preview, setPreview] = useState(false);
  const [submissions, setSubmissions] = useState<any[] | null>(null);
  const [tab, setTab] = useState<'Pages' | 'Form submissions'>('Pages');
  const [newPageOpen, setNewPageOpen] = useState(false);
  const [np, setNp] = useState({ title: '', template: 'full' });
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState<string | null>(null);

  const load = useCallback(() => { api.sites().then(setSites).catch(() => setSites([])); }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'Form submissions' && submissions === null) api.formSubmissions().then(setSubmissions).catch(() => setSubmissions([])); }, [tab, submissions]);

  const site = sites?.[0] ?? null;

  const ensureSite = async () => {
    if (site) return site;
    const created = await api.createSite('My website');
    load();
    return created;
  };

  const createPage = async () => {
    setBusy(true);
    try {
      const s = await ensureSite();
      const created = await api.createSitePage({ siteId: s.id, title: np.title.trim(), fromTemplate: np.template });
      setNewPageOpen(false); setNp({ title: '', template: 'full' }); load();
      setPage(await api.sitePage(created.id));
      toast.success('Page created as a draft');
    } catch (e: any) { toast.error('Could not create the page', String(e?.message ?? '').slice(0, 160)); }
    finally { setBusy(false); }
  };

  const openPage = async (id: string) => {
    try { setPage(await api.sitePage(id)); setPreview(false); }
    catch { toast.error('Could not open the page'); }
  };

  const savePage = async (extra?: Record<string, unknown>) => {
    if (!page) return;
    setBusy(true);
    try {
      await api.updateSitePage(page.id, { title: page.title, sections: page.sections, seo: page.seo, ...extra });
      setPage(await api.sitePage(page.id)); load();
      toast.success('Saved', 'A revision snapshot was kept.');
    } catch (e: any) { toast.error('Could not save', String(e?.message ?? '').slice(0, 180)); }
    finally { setBusy(false); }
  };

  const publish = async (on: boolean) => {
    if (!page) return;
    try {
      await api.publishSitePage(page.id, on);
      setPage(await api.sitePage(page.id)); load();
      toast.success(on ? 'Published' : 'Unpublished', on ? `Live at /s/${page.site.slug}/${page.slug}` : '');
    } catch (e: any) { toast.error('Could not change publish state', String(e?.message ?? '').replace(/^\d+\s*/, '').slice(0, 180)); }
  };

  const updateSection = (i: number, patch: any) => {
    const sections = [...(page.sections ?? [])];
    sections[i] = { ...sections[i], ...patch };
    setPage({ ...page, sections });
  };

  const aiDraft = async (i: number, type: string) => {
    setDrafting(`${i}`);
    try {
      const r = await api.aiDraftSiteSection({ type });
      if (r.available && r.draft && !r.draft.raw) { updateSection(i, r.draft); toast.success('Section drafted', 'Review before saving — nothing is published automatically.'); }
      else if (r.available) toast.error('Draft needs manual editing', 'The model returned unstructured text.');
      else toast.error('AI drafting unavailable', r.reason);
    } catch { toast.error('Could not draft'); }
    finally { setDrafting(null); }
  };

  const linesTo = {
    services: (v: string) => v.split('\n').filter(Boolean).map((l) => { const [name, description] = l.split('|'); return { name: name?.trim(), description: description?.trim() }; }),
    testimonials: (v: string) => v.split('\n').filter(Boolean).map((l) => { const [quote, name] = l.split('|'); return { quote: quote?.trim(), name: name?.trim() }; }),
    faq: (v: string) => v.split('\n').filter(Boolean).map((l) => { const [q, a] = l.split('|'); return { q: q?.trim(), a: a?.trim() }; }),
  };
  const toLines = {
    services: (items: any[]) => (items ?? []).map((i) => `${i.name ?? ''}${i.description ? ` | ${i.description}` : ''}`).join('\n'),
    testimonials: (items: any[]) => (items ?? []).map((i) => `${i.quote ?? ''}${i.name ? ` | ${i.name}` : ''}`).join('\n'),
    faq: (items: any[]) => (items ?? []).map((i) => `${i.q ?? ''}${i.a ? ` | ${i.a}` : ''}`).join('\n'),
  };

  // ── Editor view ──────────────────────────────────────────────────────────
  if (page) {
    return (
      <>
        <div className="topbar">
          <div>
            <h2 style={{ margin: 0 }}>{page.title}</h2>
            <span className="muted">/s/{page.site.slug}/{page.slug} · {page.status === 'PUBLISHED' ? 'Live' : 'Draft'}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn ghost sm" onClick={() => setPage(null)}>← All pages</button>
            <button className="btn ghost sm" onClick={() => setPreview(!preview)}>{preview ? 'Edit' : 'Preview'}</button>
            <button className="btn ghost sm" onClick={() => savePage()} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            {page.status === 'PUBLISHED'
              ? <button className="btn ghost sm" onClick={() => publish(false)}>Unpublish</button>
              : <button className="btn sm" onClick={() => publish(true)}>Publish</button>}
          </div>
        </div>

        {preview ? (
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <SiteRenderer sections={page.sections ?? []} business={page.site.name} />
            </div>
          </div>
        ) : (
          <>
            {(page.sections ?? []).map((s: any, i: number) => (
              <div className="panel" key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ textTransform: 'capitalize' }}>{s.type}</strong>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {s.type !== 'contact' && (
                      <button className="btn ghost sm" onClick={() => aiDraft(i, s.type)} disabled={drafting === `${i}`}>
                        {drafting === `${i}` ? 'Drafting…' : '✦ AI draft'}
                      </button>
                    )}
                    <button className="btn ghost sm" onClick={() => setPage({ ...page, sections: page.sections.filter((_: any, j: number) => j !== i) })}>Remove</button>
                  </div>
                </div>
                {['hero', 'cta'].includes(s.type) && (
                  <div className="grid-2">
                    <div className="field"><label>Headline</label><input value={s.headline ?? ''} onChange={(e) => updateSection(i, { headline: e.target.value })} /></div>
                    {s.type === 'hero' && <div className="field"><label>Subheadline</label><input value={s.subheadline ?? ''} onChange={(e) => updateSection(i, { subheadline: e.target.value })} /></div>}
                    <div className="field"><label>Button label</label><input value={s.ctaLabel ?? ''} onChange={(e) => updateSection(i, { ctaLabel: e.target.value })} /></div>
                    <div className="field"><label>Button link</label><input value={s.ctaHref ?? '#contact'} onChange={(e) => updateSection(i, { ctaHref: e.target.value })} /></div>
                  </div>
                )}
                {['services', 'testimonials', 'faq'].includes(s.type) && (
                  <>
                    <div className="field"><label>Title</label><input value={s.title ?? ''} onChange={(e) => updateSection(i, { title: e.target.value })} /></div>
                    <div className="field">
                      <label>
                        {s.type === 'services' ? 'Items (one per line: Name | Description)' : s.type === 'faq' ? 'Questions (one per line: Question | Answer)' : 'Quotes (one per line: Quote | Customer name)'}
                        {s.type === 'testimonials' && <span className="muted"> — only use your real recorded reviews; never invented</span>}
                      </label>
                      <textarea rows={4} defaultValue={(toLines as any)[s.type](s.items)} onBlur={(e) => updateSection(i, { items: (linesTo as any)[s.type](e.target.value) })} />
                    </div>
                  </>
                )}
                {s.type === 'contact' && <p className="muted" style={{ fontSize: 12.5 }}>Lead form (name/phone/email/message). Submissions create real CRM leads with website attribution.</p>}
              </div>
            ))}
            <div className="panel" style={{ marginBottom: 12 }}>
              <h3>Add a section</h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SECTION_TYPES.map((t) => (
                  <button key={t} className="btn ghost sm" onClick={() => setPage({ ...page, sections: [...(page.sections ?? []), { type: t }] })}>+ {t}</button>
                ))}
              </div>
            </div>
            <div className="panel" style={{ marginBottom: 12 }}>
              <h3>SEO</h3>
              <div className="grid-2">
                <div className="field"><label>SEO title (15–65 chars)</label>
                  <input value={page.seo?.title ?? ''} onChange={(e) => setPage({ ...page, seo: { ...page.seo, title: e.target.value } })} /></div>
                <div className="field"><label>Canonical URL (optional)</label>
                  <input value={page.seo?.canonical ?? ''} onChange={(e) => setPage({ ...page, seo: { ...page.seo, canonical: e.target.value } })} /></div>
              </div>
              <div className="field"><label>Meta description (50–165 chars)</label>
                <textarea rows={2} value={page.seo?.description ?? ''} onChange={(e) => setPage({ ...page, seo: { ...page.seo, description: e.target.value } })} /></div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={!!page.seo?.noindex} onChange={(e) => setPage({ ...page, seo: { ...page.seo, noindex: e.target.checked } })} /> Hide from search engines (noindex)
              </label>
            </div>
            <div className="panel">
              <h3>Revisions</h3>
              {(page.revisions ?? []).length === 0 ? <p className="muted" style={{ fontSize: 13 }}>Every save keeps a snapshot here.</p> : (
                page.revisions.map((r: any) => (
                  <div className="agent-row" key={r.id}>
                    <span style={{ flex: 1, fontSize: 13 }}>{new Date(r.createdAt).toLocaleString()}</span>
                    <button className="btn ghost sm" onClick={async () => { await api.restoreSiteRevision(page.id, r.id).catch(() => {}); openPage(page.id); toast.success('Revision restored'); }}>Restore</button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────
  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Websites</h2>
          <span className="muted">Real pages, honest publishing, forms that create real leads</span>
        </div>
        <button className="btn sm" onClick={() => setNewPageOpen(true)}>+ New page</button>
      </div>

      <div className="tabs">
        {(['Pages', 'Form submissions'] as const).map((t) => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === 'Pages' && (
        sites === null ? <div className="panel"><div className="skeleton" style={{ height: 140 }} /></div> :
        !site || site.pages.length === 0 ? (
          <div className="panel empty-state" style={{ padding: '48px 24px' }}>
            <div className="e-ico">▣</div><h4>No pages yet</h4>
            <p>Build a landing page from your industry template, publish it at a real URL, and collect leads through its form.</p>
            <button className="btn sm" onClick={() => setNewPageOpen(true)}>+ New page</button>
          </div>
        ) : (
          <>
            <div className="panel" style={{ marginBottom: 12 }}>
              <div className="agent-row">
                <span style={{ flex: 1 }}><strong>{site.name}</strong><span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>sofilic.com/s/{site.slug}</span></span>
                <span className="chip warn" title="Custom-domain DNS verification is not built yet — pages are live on the sofilic.com path">Custom domain: setup required</span>
              </div>
            </div>
            <div className="panel">
              <table className="t">
                <thead><tr><th>Page</th><th>URL</th><th>Status</th><th>Updated</th><th /></tr></thead>
                <tbody>
                  {site.pages.map((p: any) => (
                    <tr key={p.id}>
                      <td><strong>{p.title}</strong></td>
                      <td className="muted">/s/{site.slug}/{p.slug}</td>
                      <td><span className={`chip ${p.status === 'PUBLISHED' ? 'ok' : 'warn'}`}>{p.status}</span></td>
                      <td className="muted">{new Date(p.updatedAt).toLocaleDateString()}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {p.status === 'PUBLISHED' && <a className="btn ghost sm" href={`/s/${site.slug}/${p.slug}`} target="_blank" rel="noreferrer">View live</a>}
                        <button className="btn ghost sm" onClick={() => openPage(p.id)}>Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      )}

      {tab === 'Form submissions' && (
        submissions === null ? <div className="panel"><div className="skeleton" style={{ height: 100 }} /></div> :
        submissions.length === 0 ? (
          <div className="panel empty-state" style={{ padding: '40px 24px' }}>
            <div className="e-ico">▤</div><h4>No submissions yet</h4>
            <p>When someone fills the form on a published page, it lands here AND becomes a lead in your pipeline with website attribution.</p>
          </div>
        ) : (
          <div className="panel">
            {submissions.map((s) => (
              <div className="agent-row" key={s.id}>
                <span style={{ flex: 1 }}>
                  <strong>{s.data?.name ?? 'Submission'}</strong>
                  {s.data?.message && <span className="muted" style={{ display: 'block', fontSize: 12 }}>{String(s.data.message).slice(0, 120)}</span>}
                </span>
                <span className="muted" style={{ fontSize: 11 }}>{s.page?.title ?? ''} · {new Date(s.createdAt).toLocaleString()}</span>
                {s.leadId && <span className="chip ok" style={{ fontSize: 10 }}>Lead created</span>}
              </div>
            ))}
          </div>
        )
      )}

      <Modal open={newPageOpen} onClose={() => setNewPageOpen(false)} title="New page">
        <div className="field"><label>Page title</label>
          <input value={np.title} onChange={(e) => setNp({ ...np, title: e.target.value })} placeholder="Home, Spring special, Furnace repair…" /></div>
        <div className="field"><label>Start from</label>
          <select value={np.template} onChange={(e) => setNp({ ...np, template: e.target.value })}>
            <option value="full">Full site template (hero, services, testimonials, FAQ, contact, CTA)</option>
            <option value="landing">Landing page (hero, services, contact)</option>
          </select></div>
        <div className="modal-actions">
          <button className="btn ghost sm" onClick={() => setNewPageOpen(false)}>Cancel</button>
          <button className="btn sm" disabled={busy || !np.title.trim()} onClick={createPage}>{busy ? 'Creating…' : 'Create draft'}</button>
        </div>
      </Modal>
    </>
  );
}
