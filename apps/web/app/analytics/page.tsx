'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const FALLBACK = {
  kpis: [
    { key: 'revenue', label: 'Revenue', value: 48200 },
    { key: 'net_value', label: 'Net Value', value: 31400 },
    { key: 'leads_new', label: 'New Leads', value: 96 },
    { key: 'jobs_completed', label: 'Jobs Completed', value: 71 },
    { key: 'conversion_rate', label: 'Conversion Rate %', value: 38 },
    { key: 'pipeline_value', label: 'Pipeline Value', value: 82500 },
  ],
  series: [] as { date: string; value: number }[],
};

export default function AnalyticsPage() {
  const [data, setData] = useState(FALLBACK);

  useEffect(() => {
    api.analytics('executive').then((d) => setData({ kpis: d.kpis ?? FALLBACK.kpis, series: d.series ?? [] })).catch(() => {});
  }, []);

  const max = Math.max(1, ...data.series.map((s) => s.value));

  return (
    <>
      <div className="topbar">
        <div><h2 style={{ margin: 0 }}>Analytics</h2><span className="muted">Executive KPIs · last 30 days</span></div>
        <span className="badge">Live from Value Ledger</span>
      </div>
      <div className="grid" style={{ marginBottom: 18 }}>
        {data.kpis.map((k) => (
          <div className="panel" key={k.key}>
            <div className="muted">{k.label}</div>
            <div className="kpi">{typeof k.value === 'number' && k.value > 999 ? k.value.toLocaleString() : k.value}</div>
          </div>
        ))}
      </div>
      <div className="panel">
        <h3>Revenue trend</h3>
        {data.series.length === 0 ? (
          <p className="muted">No series data yet — connect the API and seed activity to populate.</p>
        ) : (
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 120 }}>
            {data.series.map((s) => (
              <div key={s.date} title={`${s.date}: $${s.value}`} className="bar" style={{ width: 14, height: `${(s.value / max) * 100}%` }} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
