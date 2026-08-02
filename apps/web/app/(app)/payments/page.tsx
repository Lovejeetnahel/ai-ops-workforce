'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Modal } from '../../../components/Modal';
import { useToast } from '../../../components/Toast';

type Tab = 'invoices' | 'estimates' | 'transactions' | 'subscription';

const STATUS_CHIP: Record<string, string> = { PAID: 'ok', ACCEPTED: 'ok', SENT: 'warn', VIEWED: 'warn', DRAFT: 'warn', OVERDUE: 'err', SUCCEEDED: 'ok', PENDING: 'warn', FAILED: 'err', REFUNDED: 'warn' };
const money = (n: number) => `$${Number(n ?? 0).toLocaleString()}`;

/**
 * Payments — estimates, invoices and transactions over the real revenue
 * backend (quotes→invoices→payments→value ledger). Stripe state is shown
 * honestly; offline (cash/check) payments are first-class.
 */
export default function PaymentsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('invoices');
  const [invoices, setInvoices] = useState<any[] | null>(null);
  const [quotes, setQuotes] = useState<any[] | null>(null);
  const [payments, setPayments] = useState<any[] | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [channels, setChannels] = useState<any>(null); // commsStatus proxy for stripe
  const [createOpen, setCreateOpen] = useState<null | 'INVOICE' | 'QUOTE'>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [nd, setNd] = useState({ contactId: '', title: '', description: '', amount: '' });
  const [busy, setBusy] = useState(false);
  const [recordFor, setRecordFor] = useState<any>(null);
  const [recordMethod, setRecordMethod] = useState('cash');

  const load = useCallback(() => {
    api.documents('INVOICE').then(setInvoices).catch(() => setInvoices([]));
    api.documents('QUOTE').then(setQuotes).catch(() => setQuotes([]));
    api.paymentsList().then(setPayments).catch(() => setPayments([]));
    api.billingSummary().then(setSummary).catch(() => {});
    api.conversationChannels().then((c) => setChannels(c)).catch(() => setChannels([]));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (createOpen) api.contacts().then(setContacts).catch(() => setContacts([])); }, [createOpen]);

  const createDoc = async () => {
    if (!nd.amount || Number(nd.amount) <= 0) return;
    setBusy(true);
    try {
      const body = {
        contactId: nd.contactId || undefined,
        title: nd.title || undefined,
        lineItems: [{ description: nd.description || nd.title || 'Service', unitPrice: Number(nd.amount) }],
      };
      if (createOpen === 'INVOICE') await api.createInvoice(body);
      else await api.createQuote(body);
      setCreateOpen(null); setNd({ contactId: '', title: '', description: '', amount: '' });
      load(); toast.success(`${createOpen === 'INVOICE' ? 'Invoice' : 'Estimate'} created`);
    } catch (e: any) { toast.error('Could not create', String(e?.message ?? '').slice(0, 180)); }
    finally { setBusy(false); }
  };

  const act = async (fn: () => Promise<any>, ok: string) => {
    try { await fn(); load(); toast.success(ok); }
    catch (e: any) { toast.error('Action failed', String(e?.message ?? '').replace(/^\d+\s*/, '').slice(0, 200)); }
  };

  const DocTable = ({ docs, kind }: { docs: any[] | null; kind: 'INVOICE' | 'QUOTE' }) => (
    docs === null ? <div className="skeleton" style={{ height: 140 }} /> :
    docs.length === 0 ? (
      <div className="empty-state">
        <div className="e-ico">▭</div>
        <h4>No {kind === 'INVOICE' ? 'invoices' : 'estimates'} yet</h4>
        <p>{kind === 'INVOICE' ? 'Create one to get paid — send it, take card payment via Stripe when connected, or record cash/check.' : 'Create an estimate, send it, and convert it to an invoice when accepted.'}</p>
        <button className="btn sm" onClick={() => setCreateOpen(kind)}>+ New {kind === 'INVOICE' ? 'invoice' : 'estimate'}</button>
      </div>
    ) : (
      <div style={{ overflowX: 'auto' }}>
        <table className="t">
          <thead><tr><th>Title</th><th>Amount</th><th>Status</th><th>Created</th><th /></tr></thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>{d.title ?? d.id.slice(0, 8)}</td>
                <td>{money(Number(d.amount ?? 0))}</td>
                <td><span className={`chip ${STATUS_CHIP[d.status] ?? 'warn'}`}>{d.status}</span></td>
                <td className="muted">{new Date(d.createdAt).toLocaleDateString()}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {d.status === 'DRAFT' && <button className="btn ghost sm" onClick={() => act(() => api.sendDocument(d.id), 'Sent')}>Send</button>}
                  {kind === 'QUOTE' && ['SENT', 'VIEWED'].includes(d.status) && (
                    <button className="btn ghost sm" onClick={() => act(() => api.acceptQuote(d.id), 'Marked accepted')}>Mark accepted</button>
                  )}
                  {kind === 'QUOTE' && d.status === 'ACCEPTED' && (
                    <button className="btn ghost sm" onClick={() => act(() => api.convertQuote(d.id), 'Converted to invoice')}>→ Invoice</button>
                  )}
                  {kind === 'INVOICE' && ['SENT', 'VIEWED'].includes(d.status) && (
                    <button className="btn ghost sm" onClick={() => { setRecordFor(d); setRecordMethod('cash'); }}>Record payment</button>
                  )}
                  {d.url ? <a className="btn ghost sm" href={d.url} target="_blank" rel="noreferrer">PDF</a> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  );

  const stripe = Array.isArray(channels) ? null : null; // stripe state comes from settings; shown below via summary presence

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Payments</h2>
          <span className="muted">Estimates, invoices and transactions — every number is a real record</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost sm" onClick={() => setCreateOpen('QUOTE')}>+ Estimate</button>
          <button className="btn sm" onClick={() => setCreateOpen('INVOICE')}>+ Invoice</button>
        </div>
      </div>

      {summary?.revenue && (
        <div className="grid-kpi" style={{ marginBottom: 16 }}>
          <div className="panel"><div className="muted">Collected (all time)</div><div className="kpi">{money(summary.revenue.net ?? 0)}</div></div>
          {summary.revenue.outstanding != null && <div className="panel"><div className="muted">Outstanding</div><div className="kpi">{money(summary.revenue.outstanding)}</div></div>}
        </div>
      )}

      <div className="tabs">
        {(['invoices', 'estimates', 'transactions', 'subscription'] as Tab[]).map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {tab === 'invoices' && <div className="panel"><DocTable docs={invoices} kind="INVOICE" /></div>}
      {tab === 'estimates' && <div className="panel"><DocTable docs={quotes} kind="QUOTE" /></div>}

      {tab === 'transactions' && (
        <div className="panel">
          {payments === null ? <div className="skeleton" style={{ height: 120 }} /> :
          payments.length === 0 ? (
            <div className="empty-state">
              <div className="e-ico">▭</div><h4>No transactions yet</h4>
              <p>Card payments (Stripe) and recorded offline payments appear here with their true status — pending, succeeded, failed or refunded.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="t">
                <thead><tr><th>Amount</th><th>Customer</th><th>Status</th><th>Provider</th><th>When</th></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td>{money(Number(p.amount))}</td>
                      <td className="muted">{p.contact?.name ?? '—'}</td>
                      <td><span className={`chip ${STATUS_CHIP[p.status] ?? 'warn'}`}>{p.status}</span></td>
                      <td className="muted">{p.provider}</td>
                      <td className="muted">{new Date(p.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'subscription' && (
        <div className="grid-2">
          <div className="panel">
            <h3>Your SOFILIC subscription</h3>
            {summary?.plan ? (
              <>
                <p><strong>{summary.plan.name ?? 'Current plan'}</strong></p>
                <p className="muted" style={{ fontSize: 13 }}>{summary.plan.description ?? ''}</p>
              </>
            ) : (
              <p className="muted" style={{ fontSize: 13 }}>Billing details load from your live subscription record. Nothing to show yet.</p>
            )}
          </div>
          <div className="panel">
            <h3>Card payments (Stripe)</h3>
            <p className="muted" style={{ fontSize: 13 }}>
              Card payment links on invoices require a connected Stripe account. Until then, sending invoices and recording offline (cash/check) payments works fully — and is always recorded truthfully.
            </p>
            <a href="/settings" className="btn ghost sm">Check connection in Settings</a>
          </div>
        </div>
      )}

      {/* Create doc */}
      <Modal open={!!createOpen} onClose={() => setCreateOpen(null)} title={createOpen === 'INVOICE' ? 'New invoice' : 'New estimate'}>
        <div className="field"><label>Customer (optional)</label>
          <select value={nd.contactId} onChange={(e) => setNd({ ...nd, contactId: e.target.value })}>
            <option value="">No customer linked</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
        <div className="field"><label>Title</label>
          <input value={nd.title} onChange={(e) => setNd({ ...nd, title: e.target.value })} placeholder="Furnace repair — May 3" /></div>
        <div className="grid-2">
          <div className="field"><label>Line item description</label>
            <input value={nd.description} onChange={(e) => setNd({ ...nd, description: e.target.value })} placeholder="Labour + parts" /></div>
          <div className="field"><label>Amount ($)</label>
            <input type="number" min="0" value={nd.amount} onChange={(e) => setNd({ ...nd, amount: e.target.value })} /></div>
        </div>
        <div className="modal-actions">
          <button className="btn ghost sm" onClick={() => setCreateOpen(null)}>Cancel</button>
          <button className="btn sm" disabled={busy || !nd.amount || Number(nd.amount) <= 0} onClick={createDoc}>
            {busy ? 'Creating…' : `Create ${createOpen === 'INVOICE' ? 'invoice' : 'estimate'}`}
          </button>
        </div>
      </Modal>

      {/* Record offline payment */}
      <Modal open={!!recordFor} onClose={() => setRecordFor(null)} title="Record an offline payment">
        {recordFor && (
          <>
            <p style={{ fontSize: 13 }}>Settle <strong>{recordFor.title ?? recordFor.id.slice(0, 8)}</strong> ({money(Number(recordFor.amount ?? 0))}) as paid outside Stripe.</p>
            <div className="field"><label>Method</label>
              <select value={recordMethod} onChange={(e) => setRecordMethod(e.target.value)}>
                {['cash', 'check', 'e-transfer', 'other'].map((m) => <option key={m} value={m}>{m}</option>)}
              </select></div>
            <div className="modal-actions">
              <button className="btn ghost sm" onClick={() => setRecordFor(null)}>Cancel</button>
              <button className="btn sm" onClick={() => act(async () => { await api.recordOfflinePayment(recordFor.id, { method: recordMethod }); setRecordFor(null); }, 'Payment recorded')}>
                Record payment
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
