'use client';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';

type Tab = 'invoices' | 'estimates' | 'transactions' | 'products' | 'documents';

const STATUS_CHIP: Record<string, string> = { PAID: 'ok', SENT: 'warn', DRAFT: 'warn', OVERDUE: 'err', SUCCEEDED: 'ok', PENDING: 'warn', FAILED: 'err' };

export default function PaymentsPage() {
  const [tab, setTab] = useState<Tab>('invoices');
  const [invoices, setInvoices] = useState<any[] | null>(null);
  const [quotes, setQuotes] = useState<any[] | null>(null);
  const [payments, setPayments] = useState<any[] | null>(null);
  const [plans, setPlans] = useState<any[] | null>(null);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    api.documents('INVOICE').then(setInvoices).catch(() => setInvoices([]));
    api.documents('QUOTE').then(setQuotes).catch(() => setQuotes([]));
    api.paymentsList().then(setPayments).catch(() => setPayments([]));
    api.plans().then((p) => setPlans(p ?? [])).catch(() => setPlans([]));
    api.billingSummary().then(setSummary).catch(() => {});
  }, []);

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Payments</h2>
          <span className="muted">Estimates, invoices, subscriptions and documents</span>
        </div>
        {summary?.revenue && <span className="badge">Net collected: ${Number(summary.revenue.net ?? 0).toLocaleString()}</span>}
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'invoices' ? 'active' : ''}`} onClick={() => setTab('invoices')}>Invoices</button>
        <button className={`tab ${tab === 'estimates' ? 'active' : ''}`} onClick={() => setTab('estimates')}>Estimates</button>
        <button className={`tab ${tab === 'transactions' ? 'active' : ''}`} onClick={() => setTab('transactions')}>Transactions</button>
        <button className={`tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>Products &amp; subscriptions</button>
        <button className={`tab ${tab === 'documents' ? 'active' : ''}`} onClick={() => setTab('documents')}>Documents</button>
      </div>

      {tab === 'invoices' && (
        <div className="panel">
          {invoices === null ? (
            <div className="skeleton" style={{ height: 140 }} />
          ) : invoices.length === 0 ? (
            <div className="empty-state"><div className="e-ico">▭</div><h4>No invoices yet</h4><p>Create one to get paid.</p></div>
          ) : (
            <table className="t">
              <thead><tr><th>Invoice</th><th>Amount</th><th>Status</th><th>Sent</th></tr></thead>
              <tbody>
                {invoices.map((inv: any) => (
                  <tr key={inv.id}>
                    <td>{inv.number ?? inv.id.slice(0, 8)}</td>
                    <td>${Number(inv.total ?? inv.amount ?? 0).toLocaleString()}</td>
                    <td><span className={`chip ${STATUS_CHIP[inv.status] ?? 'warn'}`}>{inv.status}</span></td>
                    <td className="muted">{inv.sentAt ? new Date(inv.sentAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'estimates' && (
        <div className="panel">
          {quotes === null ? (
            <div className="skeleton" style={{ height: 140 }} />
          ) : quotes.length === 0 ? (
            <div className="empty-state"><div className="e-ico">▤</div><h4>No estimates yet</h4><p>Send a quote and convert it to an invoice once accepted.</p></div>
          ) : (
            <table className="t">
              <thead><tr><th>Estimate</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {quotes.map((q: any) => (
                  <tr key={q.id}>
                    <td>{q.number ?? q.id.slice(0, 8)}</td>
                    <td>${Number(q.total ?? 0).toLocaleString()}</td>
                    <td><span className={`chip ${STATUS_CHIP[q.status] ?? 'warn'}`}>{q.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'transactions' && (
        <div className="panel">
          {payments === null ? (
            <div className="skeleton" style={{ height: 140 }} />
          ) : payments.length === 0 ? (
            <div className="empty-state"><div className="e-ico">◈</div><h4>No transactions yet</h4><p>Payments collected through Sofilic will show up here.</p></div>
          ) : (
            <table className="t">
              <thead><tr><th>Payment</th><th>Amount</th><th>Method</th><th>Status</th></tr></thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id}>
                    <td>{p.id.slice(0, 8)}</td>
                    <td>${Number(p.amount ?? 0).toLocaleString()}</td>
                    <td className="muted">{p.method ?? p.externalRef ?? '—'}</td>
                    <td><span className={`chip ${STATUS_CHIP[p.status] ?? 'warn'}`}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'products' && (
        <div className="grid">
          {plans === null ? (
            <div className="skeleton panel" style={{ height: 140, gridColumn: '1 / -1' }} />
          ) : plans.length === 0 ? (
            <div className="panel empty-state" style={{ gridColumn: '1 / -1' }}><div className="e-ico">◈</div><h4>No products yet</h4><p>Create a product or subscription to start recurring billing.</p></div>
          ) : (
            plans.map((p: any) => (
              <div className="panel" key={p.key}>
                <h3 style={{ margin: 0 }}>{p.name}</h3>
                <div className="price">${(p.priceCents / 100).toFixed(0)}<span className="muted" style={{ fontSize: 13 }}>/mo</span></div>
                <div className="muted" style={{ margin: '4px 0 10px' }}>{p.seats} seats</div>
                {(p.features ?? []).map((f: string, i: number) => (
                  <div className="agent-row" key={i}><span>✓</span><span>{f}</span></div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'documents' && (
        <div className="panel empty-state" style={{ padding: '56px 24px' }}>
          <div className="e-ico" style={{ width: 56, height: 56, fontSize: 26 }}>▤</div>
          <h4 style={{ fontSize: 16 }}>No contracts or proposals yet</h4>
          <p>Send a contract or proposal for e-signature, with a payment link built in.</p>
        </div>
      )}
    </>
  );
}
