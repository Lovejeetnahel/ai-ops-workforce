'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';

const OPTIONAL_APPS = [
  { key: 'field-operations', name: 'Field Operations', desc: 'Jobs, dispatch, field team, time tracking and quotes for mobile crews.', href: '/apps/field-operations', available: true },
  { key: 'inventory', name: 'Inventory', desc: 'Track parts and products consumed on jobs.', href: null, available: false },
  { key: 'fleet', name: 'Fleet', desc: 'Vehicles, assignments and maintenance reminders.', href: null, available: false },
  { key: 'hr', name: 'HR', desc: 'Team records, certifications and time off.', href: null, available: false },
];

export default function AppsPage() {
  const [items, setItems] = useState<any[] | null>(null);
  const [filter, setFilter] = useState('');
  const types = ['', 'agent', 'workflow', 'template', 'integration'];

  useEffect(() => {
    api.marketplace(filter || undefined).then((d) => setItems(d ?? [])).catch(() => setItems([]));
  }, [filter]);

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Apps</h2>
          <span className="muted">Optional capabilities and installable extensions</span>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <h3>Optional apps</h3>
        <div className="grid">
          {OPTIONAL_APPS.map((a) => (
            <div className="card" key={a.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="name">{a.name}</span>
                <span className={`chip ${a.available ? 'ok' : 'warn'}`}>{a.available ? 'Available' : 'Not available yet'}</span>
              </div>
              <div className="meta" style={{ minHeight: 32, margin: '6px 0 10px' }}>{a.desc}</div>
              {a.href ? (
                <Link href={a.href} className="btn ghost sm">Open</Link>
              ) : (
                <button className="btn ghost sm" disabled>Enable</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="topbar" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Marketplace</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {types.map((t) => (
              <button
                key={t || 'all'}
                className="tag"
                style={{ cursor: 'pointer', background: filter === t ? 'var(--accent)' : 'transparent', color: filter === t ? '#0a0a0a' : 'var(--muted)' }}
                onClick={() => setFilter(t)}
              >
                {t || 'all'}
              </button>
            ))}
          </div>
        </div>
        {items === null ? (
          <div className="skeleton" style={{ height: 140 }} />
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="e-ico">▦</div>
            <h4>Nothing here yet</h4>
            <p>Installable AI employees, workflows, templates and integrations will appear here.</p>
          </div>
        ) : (
          <div className="grid">
            {items.map((it: any) => (
              <div className="panel" key={it.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{it.name}</strong>
                  <span className="tag">{it.type}</span>
                </div>
                <div className="muted" style={{ margin: '6px 0', minHeight: 34 }}>{it.description}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="muted">★ {it.ratingAvg ?? '—'} · {it.downloads ?? 0} installs</span>
                  <span>{it.priceCents ? `$${(it.priceCents / 100).toFixed(0)}/mo` : 'Free'}</span>
                </div>
                <button className="btn sm" style={{ marginTop: 10, width: '100%' }} onClick={() => api.installListing(it.id).catch(() => {})}>Install</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
