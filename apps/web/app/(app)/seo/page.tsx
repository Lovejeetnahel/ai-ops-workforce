'use client';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useToast } from '../../../components/Toast';

const SEV_CHIP: Record<string, string> = { HIGH: 'err', MEDIUM: 'warn', LOW: '' };

/**
 * SEO V1 — deterministic audits over your real pages and business profile,
 * a local-SEO checklist, SEO tasks and AI recommendations. External search
 * data (impressions/rankings/clicks) is honestly setup-required.
 */
export default function SeoPage() {
  const toast = useToast();
  const [audit, setAudit] = useState<any>(null);
  const [history, setHistory] = useState<any[] | null>(null);
  const [running, setRunning] = useState(false);
  const [recs, setRecs] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'fail'>('fail');

  useEffect(() => { api.seoHistory().then(setHistory).catch(() => setHistory([])); }, []);

  const run = async () => {
    setRunning(true);
    try {
      const r = await api.runSeoAudit();
      setAudit(r);
      api.seoHistory().then(setHistory).catch(() => {});
      toast.success(`Audit complete — score ${r.score}/100`, `${r.pagesAudited} page(s) audited`);
    } catch (e: any) { toast.error('Audit failed', String(e?.message ?? '').slice(0, 160)); }
    finally { setRunning(false); }
  };

  const aiRecs = async () => {
    setRecs('loading');
    try {
      const r = await api.seoAiRecommendations();
      setRecs(r.available ? r.recommendations : { unavailable: r.reason });
    } catch { setRecs({ unavailable: 'Could not load recommendations' }); }
  };

  const findings = (audit?.findings ?? []).filter((f: any) => filter === 'all' || f.status !== 'PASS');

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>SEO</h2>
          <span className="muted">Real audits of your real pages — no invented traffic or rankings</span>
        </div>
        <button className="btn sm" onClick={run} disabled={running}>{running ? 'Auditing…' : 'Run audit'}</button>
      </div>

      <div className="grid-kpi" style={{ marginBottom: 16 }}>
        <div className="panel"><div className="muted">Latest score</div>
          <div className="kpi">{audit?.score ?? history?.[0]?.score ?? '—'}</div>
          <div className="kpi-delta muted">Deterministic rubric over your pages</div></div>
        <div className="panel"><div className="muted">Pages audited</div><div className="kpi">{audit?.pagesAudited ?? '—'}</div></div>
        <div className="panel"><div className="muted">Search Console</div>
          <div className="kpi" style={{ fontSize: 18 }}>Setup required</div>
          <div className="kpi-delta muted">Impressions/rankings/clicks need a real connection — none are shown</div></div>
        <div className="panel"><div className="muted">Audit history</div>
          <div className="kpi">{history?.length ?? 0}</div>
          <div className="kpi-delta muted">{history?.[0] ? `Last: ${new Date(history[0].createdAt).toLocaleDateString()}` : 'Run your first audit'}</div></div>
      </div>

      {!audit && (history ?? []).length === 0 && (
        <div className="panel empty-state" style={{ padding: '48px 24px' }}>
          <div className="e-ico">∿</div><h4>No audits yet</h4>
          <p>The audit checks titles, descriptions, headings, indexability, conversion paths, internal links and your local-SEO basics — all computed from your real Websites pages and Company Profile.</p>
          <button className="btn sm" onClick={run} disabled={running}>{running ? 'Auditing…' : 'Run first audit'}</button>
        </div>
      )}

      {audit && (
        <>
          <div className="tabs">
            <button className={`tab ${filter === 'fail' ? 'active' : ''}`} onClick={() => setFilter('fail')}>Issues</button>
            <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All checks</button>
          </div>
          <div className="panel" style={{ marginBottom: 16 }}>
            {findings.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 16px' }}>
                <div className="e-ico">✓</div><h4>No issues found</h4><p>Every audited check passed.</p>
              </div>
            ) : (
              findings.map((f: any, i: number) => (
                <div className="agent-row" key={i}>
                  <span className={`chip ${f.status === 'PASS' ? 'ok' : SEV_CHIP[f.severity] ?? 'warn'}`} style={{ fontSize: 10 }}>
                    {f.status === 'PASS' ? 'PASS' : f.severity}
                  </span>
                  <span style={{ flex: 1 }}>
                    <strong style={{ fontSize: 13 }}>{f.check}</strong>
                    <span className="muted" style={{ fontSize: 12 }}> — {f.pageTitle}</span>
                    <span className="muted" style={{ display: 'block', fontSize: 12 }}>{f.detail}</span>
                  </span>
                  {f.status !== 'PASS' && (
                    <button className="btn ghost sm" onClick={async () => { await api.createSeoTask(f).catch(() => {}); toast.success('SEO task created'); }}>+ Task</button>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="panel">
          <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            AI recommendations
            <button className="btn ghost sm" onClick={aiRecs} disabled={recs === 'loading'}>{recs === 'loading' ? 'Thinking…' : '✦ Generate'}</button>
          </h3>
          {recs === null && <p className="muted" style={{ fontSize: 13 }}>Grounded in your latest audit — run one first.</p>}
          {Array.isArray(recs) && recs.map((r: string, i: number) => <div className="agent-row" key={i}><span style={{ flex: 1, fontSize: 13 }}>{r}</span></div>)}
          {recs && !Array.isArray(recs) && recs !== 'loading' && <p className="muted" style={{ fontSize: 13 }}>{recs.unavailable}</p>}
        </div>
        <div className="panel">
          <h3>Audit history</h3>
          {(history ?? []).length === 0 ? <p className="muted" style={{ fontSize: 13 }}>Past audit scores accumulate here.</p> : (
            history!.map((h) => (
              <div className="agent-row" key={h.id}>
                <span style={{ flex: 1, fontSize: 13 }}>{new Date(h.createdAt).toLocaleString()}</span>
                <span className="tag">{h.score}/100</span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
