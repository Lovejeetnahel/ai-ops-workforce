'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import { api } from '../lib/api';

const DESTINATIONS = [
  { href: '/dashboard', label: 'Dashboard', ico: '⌘' },
  { href: '/crm', label: 'CRM', ico: '◈' },
  { href: '/sales', label: 'Sales', ico: '▲' },
  { href: '/conversations', label: 'Conversations', ico: '▤' },
  { href: '/voice-ai', label: 'Voice AI', ico: '◎' },
  { href: '/marketing', label: 'Marketing', ico: '◬' },
  { href: '/social', label: 'Social Media', ico: '⬡' },
  { href: '/websites', label: 'Websites', ico: '▣' },
  { href: '/seo', label: 'SEO', ico: '∿' },
  { href: '/automation', label: 'Automation', ico: '⟳' },
  { href: '/payments', label: 'Payments', ico: '▭' },
  { href: '/apps', label: 'Apps', ico: '▦' },
  { href: '/settings', label: 'Settings', ico: '⚙' },
];

/**
 * Real, working ⌘K: jump to modules AND search your actual business data
 * (contacts, opportunities, conversations, campaigns, documents, pages,
 * appointments) through the tenant-scoped /search endpoint (Sprint 3).
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [data, setData] = useState<any[]>([]);

  useEffect(() => { if (!open) { setQ(''); setData([]); } }, [open]);
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setData([]); return; }
    const t = setTimeout(() => {
      api.globalSearch(query).then((r) => setData(r.results ?? [])).catch(() => setData([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return DESTINATIONS;
    return DESTINATIONS.filter((d) => d.label.toLowerCase().includes(query));
  }, [q]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <Modal open={open} onClose={onClose}>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Jump to a module…"
        style={{
          width: '100%', background: 'transparent', border: 0, outline: 'none',
          color: 'var(--text)', fontSize: 16, padding: '4px 2px 14px',
          borderBottom: '1px solid var(--border)', marginBottom: 10,
        }}
      />
      {data.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div className="muted" style={{ fontSize: 11, padding: '2px 4px', letterSpacing: 0.5 }}>IN YOUR DATA</div>
          {data.map((r) => (
            <button key={`${r.kind}-${r.id}`} className="dropdown-item" style={{ width: '100%', fontSize: 14 }} onClick={() => go(r.href)}>
              <span className="tag" style={{ fontSize: 9, marginRight: 8 }}>{r.kind}</span>
              {r.label}
              {r.detail && <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{r.detail}</span>}
            </button>
          ))}
        </div>
      )}
      {results.length === 0 && data.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 12px' }}>
          <p>Nothing matches &ldquo;{q}&rdquo;.</p>
        </div>
      ) : (
        <div>
          {results.map((d) => (
            <button
              key={d.href}
              className="dropdown-item"
              style={{ width: '100%', fontSize: 14 }}
              onClick={() => go(d.href)}
            >
              <span className="ico" style={{ width: 20, textAlign: 'center' }}>{d.ico}</span>
              {d.label}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
