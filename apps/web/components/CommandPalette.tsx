'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';

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
 * Real, working jump-to-module search (⌘K). Scoped honestly to navigation —
 * it does not pretend to search business data that isn't wired up yet.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');

  useEffect(() => { if (!open) setQ(''); }, [open]);

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
      {results.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 12px' }}>
          <p>No modules match &ldquo;{q}&rdquo;.</p>
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
