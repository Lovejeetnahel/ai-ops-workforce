'use client';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';

const INVOICES = [
  { id: '#4821', customer: 'Jordan M.', desc: 'Emergency A/C repair', amount: 240, status: 'Paid', chip: 'ok' },
  { id: '#4820', customer: 'Priya K.', desc: 'Water heater quote deposit', amount: 450, status: 'Paid', chip: 'ok' },
  { id: '#4819', customer: 'Sam R.', desc: 'Furnace tune-up', amount: 189, status: 'Sent', chip: 'warn' },
  { id: '#4815', customer: 'Lena W.', desc: 'Thermostat + labor', amount: 320, status: 'Sent', chip: 'warn' },
  { id: '#4802', customer: 'Omar N.', desc: 'Duct cleaning', amount: 480, status: 'Overdue 12d', chip: 'err' },
];

export default function RevenuePage() {
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    api.billingSummary().then(setSummary).catch(() => {});
  }, []);

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Revenue</h2>
          <span className="muted">Invoices, payments and the value ledger</span>
        </div>
        <span className="badge">
          {summary?.revenue ? `Net value: $${Number(summary.revenue.net ?? 0).toLocaleString()}` : 'Stripe connected'}
        </span>
      </div>

      <div className="grid-kpi" style={{ marginBottom: 20 }}>
        <div className="panel"><div className="muted">Collected this month</div><div className="kpi">$48,200</div><div className="kpi-delta up">+12% vs last month</div></div>
        <div className="panel"><div className="muted">Outstanding</div><div className="kpi">$3,140</div><div className="muted" style={{ fontSize: 12 }}>4 invoices</div></div>
        <div className="panel"><div className="muted">Overdue</div><div className="kpi">$480</div><div className="kpi-delta down">1 invoice · AI chasing</div></div>
        <div className="panel"><div className="muted">Avg. days to paid</div><div className="kpi">3.2</div><div className="kpi-delta up">−1.4 days since pay links</div></div>
      </div>

      <div className="panel">
        <h3>🧾 Recent invoices</h3>
        <table className="t">
          <thead>
            <tr><th>Invoice</th><th>Customer</th><th>Description</th><th>Amount</th><th>Status</th></tr>
          </thead>
          <tbody>
            {INVOICES.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.id}</td>
                <td>{inv.customer}</td>
                <td className="muted">{inv.desc}</td>
                <td>${inv.amount}</td>
                <td><span className={`chip ${inv.chip}`}>{inv.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="panel">
          <h3>💳 Payment flow health</h3>
          <div className="agent-row"><span style={{ flex: 1 }}>Stripe webhook</span><span className="chip ok">Receiving events</span></div>
          <div className="agent-row"><span style={{ flex: 1 }}>Settlement reconciliation</span><span className="chip ok">Idempotent · no drift</span></div>
          <div className="agent-row"><span style={{ flex: 1 }}>Pay-link conversion</span><span className="chip ok">74% within 48h</span></div>
        </div>
        <div className="panel">
          <h3>🤖 Collections AI</h3>
          <div className="agent-row"><span style={{ flex: 1 }}>Invoice #4802 (Omar N., $480)</span><span className="muted">2 reminders sent</span></div>
          <div className="agent-row"><span style={{ flex: 1 }}>Next action</span><span className="tag">Phone-call suggestion → owner</span></div>
          <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>
            Collections AI escalates to you only when automated reminders stall.
          </p>
        </div>
      </div>
    </>
  );
}
