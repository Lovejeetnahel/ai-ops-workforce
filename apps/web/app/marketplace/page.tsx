'use client';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const FALLBACK = [
  { id: '1', key: 'sales', type: 'agent', name: 'Sales AI', description: 'Qualify, score, quote, follow up.', priceCents: 0, ratingAvg: 4.8, downloads: 1240 },
  { id: '2', key: 'collections', type: 'agent', name: 'Collections AI', description: 'Chase overdue invoices automatically.', priceCents: 4900, ratingAvg: 4.6, downloads: 860 },
  { id: '3', key: 'missed_call_textback', type: 'workflow', name: 'Missed-Call Text-Back', description: 'Recover missed calls instantly.', priceCents: 0, ratingAvg: 4.9, downloads: 2100 },
  { id: '4', key: 'hvac_pack', type: 'template', name: 'HVAC Industry Pack', description: 'Forms, checklists, templates for HVAC.', priceCents: 1900, ratingAvg: 4.7, downloads: 540 },
  { id: '5', key: 'quickbooks', type: 'integration', name: 'QuickBooks Sync', description: 'Two-way accounting sync.', priceCents: 2900, ratingAvg: 4.4, downloads: 410 },
];

export default function MarketplacePage() {
  const [items, setItems] = useState<any[]>(FALLBACK);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    api.marketplace(filter || undefined).then((d) => setItems(d?.length ? d : FALLBACK)).catch(() => setItems(FALLBACK));
  }, [filter]);

  const types = ['', 'agent', 'workflow', 'template', 'integration'];

  return (
    <>
      <div className="topbar">
        <div><h2 style={{ margin: 0 }}>Marketplace</h2><span className="muted">Installable AI employees, workflows, templates & integrations</span></div>
        <div style={{ display: 'flex', gap: 6 }}>
          {types.map((t) => (
            <button key={t || 'all'} className="tag" style={{ cursor: 'pointer', background: filter === t ? 'var(--accent)' : 'transparent', color: filter === t ? '#fff' : 'var(--muted)' }} onClick={() => setFilter(t)}>{t || 'all'}</button>
          ))}
        </div>
      </div>
      <div className="grid">
        {items.map((it) => (
          <div className="panel" key={it.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{it.name}</strong>
              <span className="tag">{it.type}</span>
            </div>
            <div className="muted" style={{ margin: '6px 0', minHeight: 34 }}>{it.description}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="muted">★ {it.ratingAvg} · {it.downloads} installs</span>
              <span>{it.priceCents ? `$${(it.priceCents / 100).toFixed(0)}/mo` : 'Free'}</span>
            </div>
            <button className="btn" style={{ marginTop: 10, width: '100%' }} onClick={() => api.installListing(it.id).catch(() => {})}>Install</button>
          </div>
        ))}
      </div>
    </>
  );
}
