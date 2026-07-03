'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const FALLBACK_PLANS = [
  { key: 'starter', name: 'Starter', priceCents: 9900, seats: 3, features: ['CRM', 'Scheduling', 'Invoicing', '1 AI employee'] },
  { key: 'pro', name: 'Pro', priceCents: 29900, seats: 15, features: ['Everything in Starter', 'Full AI workforce', 'Analytics', 'Workflows'] },
  { key: 'enterprise', name: 'Enterprise', priceCents: 99900, seats: 100, features: ['Everything in Pro', 'Multi-company', 'API + webhooks', 'Priority support'] },
];

export default function BillingPage() {
  const [plans, setPlans] = useState<any[]>(FALLBACK_PLANS);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    api.plans().then((p) => setPlans(p?.length ? p : FALLBACK_PLANS)).catch(() => {});
    api.billingSummary().then(setSummary).catch(() => {});
  }, []);

  return (
    <>
      <div className="topbar">
        <div><h2 style={{ margin: 0 }}>Billing & Plans</h2><span className="muted">{summary?.subscription ? `Current: ${summary.subscription.planKey} (${summary.subscription.status})` : 'Choose a plan'}</span></div>
        {summary?.revenue && <span className="badge">Net value: ${Number(summary.revenue.net ?? 0).toLocaleString()}</span>}
      </div>
      <div className="grid">
        {plans.map((p) => (
          <div className="panel" key={p.key}>
            <h3 style={{ margin: 0 }}>{p.name}</h3>
            <div className="price">${(p.priceCents / 100).toFixed(0)}<span className="muted" style={{ fontSize: 13 }}>/mo</span></div>
            <div className="muted" style={{ margin: '4px 0 10px' }}>{p.seats} seats</div>
            {(p.features ?? []).map((f: string, i: number) => (
              <div className="agent-row" key={i}><span>✓</span><span>{f}</span></div>
            ))}
            <button className="btn" style={{ marginTop: 12, width: '100%' }}>Choose {p.name}</button>
          </div>
        ))}
      </div>
    </>
  );
}
