'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Dropdown } from './Dropdown';
import { api, isAuthed } from '../lib/api';

/**
 * Live staff notifications (Sprint 3): unread badge + latest items from the
 * real notification center. Polls lightly; rows exist only for real events.
 */
export function NotificationsMenu() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<any[] | null>(null);

  const refresh = () => {
    if (!isAuthed()) return;
    api.notificationsUnreadCount().then((r) => setCount(r.count)).catch(() => {});
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, []);

  const loadItems = () => api.staffNotifications({}).then((r) => setItems(r.slice(0, 8))).catch(() => setItems([]));

  return (
    <Dropdown
      trigger={() => (
        <button type="button" className="icon-trigger" aria-label="Notifications" title="Notifications" onClick={loadItems} style={{ position: 'relative' }}>
          🔔
          {count > 0 && (
            <span style={{ position: 'absolute', top: 0, right: 0, background: '#f87171', color: '#fff', borderRadius: 8, fontSize: 9, padding: '1px 4px', lineHeight: 1.4 }}>
              {count > 9 ? '9+' : count}
            </span>
          )}
        </button>
      )}
    >
      {() => (
        <div style={{ minWidth: 280, maxWidth: 340 }}>
          {items === null ? (
            <div className="skeleton" style={{ height: 60, margin: 8 }} />
          ) : items.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 16px' }}>
              <div className="e-ico" style={{ width: 40, height: 40, fontSize: 18 }}>🔔</div>
              <h4 style={{ fontSize: 13.5 }}>You&rsquo;re all caught up</h4>
              <p style={{ fontSize: 12.5 }}>Real activity — leads, approvals, calls, failures — shows up here.</p>
            </div>
          ) : (
            <>
              {items.map((n) => (
                <Link key={n.id} href={n.href ?? '/notifications'} className="dropdown-item" style={{ display: 'block', padding: '8px 12px', textDecoration: 'none' }}
                  onClick={() => { api.markNotificationRead(n.id).catch(() => {}); refresh(); }}>
                  <span style={{ fontSize: 13, fontWeight: n.read ? 400 : 700, display: 'block' }}>{n.title}</span>
                  <span className="muted" style={{ fontSize: 11 }}>{new Date(n.createdAt).toLocaleString()}</span>
                </Link>
              ))}
              <Link href="/notifications" className="dropdown-item" style={{ display: 'block', padding: '8px 12px', textAlign: 'center', fontSize: 12 }}>
                View all →
              </Link>
            </>
          )}
        </div>
      )}
    </Dropdown>
  );
}
