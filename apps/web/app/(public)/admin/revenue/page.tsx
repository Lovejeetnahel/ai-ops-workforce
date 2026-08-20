'use client';
import { useState } from 'react';
import { api } from '../../../../lib/api';

/**
 * Platform-operator SaaS revenue view (Sprint 4). Deliberately separated from
 * tenant dashboards: this is cross-tenant data, gated by the ADMIN_API_TOKEN
 * operator secret — no tenant JWT can open it. The token lives only in this
 * page's memory (never localStorage) and every number comes from real
 * Subscription/BillingEvent rows; anything uncomputable says so.
 */
export default function AdminRevenuePage() {
  const [token, setToken] = useState('');
  const [metrics, setMetrics] = useState<any>(null);
  const [webhooks, setWebhooks] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    setError('');
    try {
      const [m, w] = await Promise.all([api.adminSaasMetrics(token), api.adminWebhooks(token)]);
      setMetrics(m);
      setWebhooks(w);
    } catch (e: any) {
      setError(String(e?.message ?? 'Failed').slice(0, 160));
      setMetrics(null);
      setWebhooks(null);
    } finally {
      setBusy(false);
    }
  };

  const money = (n: number) => `$${Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <div className="container" style={{ padding: '40px 20px', maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 4 }}>Sofilic — SaaS revenue (operator)</h1>
      <p className="muted" style={{ fontSize: 13 }}>Requires the platform operator token. Real billing data only — no tenant business data is shown here.</p>
      <div style={{ display: 'flex', gap: 8, margin: '16px 0', maxWidth: 480 }}>
        <input type="password" style={{ flex: 1 }} placeholder="Operator token" value={token} onChange={(e) => setToken(e.target.value)} />
        <button className="btn sm" disabled={busy || token.length < 10} onClick={load}>{busy ? 'Loading…' : 'Load'}</button>
      </div>
      {error && <p style={{ color: '#e05555', fontSize: 13 }}>{error}</p>}
      {metrics && (
        <>
          <div className="grid-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div className="panel"><div className="muted">MRR</div><div className="kpi" style={{ fontSize: 22 }}>{money(metrics.mrr.amount)}</div>{metrics.mrr.note && <div className="muted" style={{ fontSize: 10.5 }}>{metrics.mrr.note}</div>}</div>
            <div className="panel"><div className="muted">ARR</div><div className="kpi" style={{ fontSize: 22 }}>{money(metrics.arr.amount)}</div></div>
            <div className="panel"><div className="muted">Active subs</div><div className="kpi" style={{ fontSize: 22 }}>{metrics.subscriptions.active}</div></div>
            <div className="panel"><div className="muted">Trialing</div><div className="kpi" style={{ fontSize: 22 }}>{metrics.subscriptions.trialing}</div></div>
            <div className="panel"><div className="muted">Past due</div><div className="kpi" style={{ fontSize: 22 }}>{metrics.subscriptions.pastDue}</div></div>
            <div className="panel"><div className="muted">Active tenants</div><div className="kpi" style={{ fontSize: 22 }}>{metrics.tenantsActive}</div></div>
          </div>
          <div className="panel" style={{ marginBottom: 16 }}>
            <h3>Last 30 days</h3>
            <p style={{ fontSize: 13 }}>
              Trials started: {metrics.last30Days.trialsStarted} · New subscriptions: {metrics.last30Days.newSubscriptions} · Cancellations: {metrics.last30Days.cancellations} · Failed payments: {metrics.last30Days.failedPayments} · Recovered: {metrics.last30Days.recoveredPayments}
            </p>
            <p style={{ fontSize: 13 }}>Revenue collected: {money(metrics.last30Days.revenueCollected.amount)} <span className="muted" style={{ fontSize: 11 }}>({metrics.last30Days.revenueCollected.note})</span></p>
            <p style={{ fontSize: 13 }}>
              Trial conversion: {metrics.trialConversion.rate != null ? `${Math.round(metrics.trialConversion.rate * 100)}%` : metrics.trialConversion.note} ·
              Churn: {metrics.churn.monthly != null ? `${metrics.churn.monthly}%/mo` : metrics.churn.note}
            </p>
            <p style={{ fontSize: 13 }}>Plan distribution: {Object.entries(metrics.planDistribution).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
          </div>
          <div className="panel">
            <h3>Webhook reliability (latest 100)</h3>
            {webhooks && webhooks.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No provider webhooks recorded yet.</p>}
            {(webhooks ?? []).slice(0, 40).map((w) => (
              <div key={w.id} style={{ display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid rgba(128,128,128,0.15)', padding: '6px 0', fontSize: 12.5 }}>
                <span className="tag">{w.provider}</span>
                <span style={{ flex: 1 }}>{w.eventType}{w.tenantId ? ` · tenant ${w.tenantId.slice(0, 8)}…` : ''}</span>
                <span className={`chip ${w.state === 'PROCESSED' ? 'ok' : w.state === 'SKIPPED' ? 'warn' : ['FAILED', 'DEAD_LETTER'].includes(w.state) ? 'err' : 'warn'}`}>{w.state}</span>
                <span className="muted">{new Date(w.receivedAt).toLocaleString()}</span>
                {['FAILED', 'DEAD_LETTER'].includes(w.state) && (
                  <button className="btn ghost sm" onClick={async () => { await api.adminRetryWebhook(token, w.id).catch(() => {}); load(); }}>Retry</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
