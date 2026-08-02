'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useToast } from '../../../components/Toast';

/**
 * Notifications Center (Sprint 3) — every row comes from a real domain event
 * (leads, assignments, approvals, failures, calls, payments, goals). Deep
 * links, read state, filtering, mark-all. 90-day retention on read items.
 */
export default function NotificationsPage() {
  const toast = useToast();
  const [items, setItems] = useState<any[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = useCallback(() => {
    api.staffNotifications(filter === 'unread' ? { unread: true } : {}).then(setItems).catch(() => setItems([]));
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Notifications</h2>
          <span className="muted">Real events only — leads, approvals, calls, failures and wins</span>
        </div>
        <button className="btn ghost sm" onClick={async () => { await api.markAllNotificationsRead().catch(() => {}); load(); toast.success('All marked read'); }}>
          Mark all as read
        </button>
      </div>

      <div className="tabs">
        <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
        <button className={`tab ${filter === 'unread' ? 'active' : ''}`} onClick={() => setFilter('unread')}>Unread</button>
      </div>

      <div className="panel">
        {items === null ? (
          <div className="skeleton" style={{ height: 140 }} />
        ) : items.length === 0 ? (
          <div className="empty-state" style={{ padding: '48px 24px' }}>
            <div className="e-ico">🔔</div>
            <h4>{filter === 'unread' ? 'Nothing unread' : 'No notifications yet'}</h4>
            <p>New leads, assigned conversations, AI approvals, failed automations, missed calls, payments and goal wins land here as they actually happen.</p>
          </div>
        ) : (
          items.map((n) => (
            <div className="agent-row" key={n.id} style={{ opacity: n.read ? 0.65 : 1 }}>
              {n.priority === 'HIGH' && <span className="chip err" style={{ fontSize: 10 }}>Important</span>}
              <span style={{ flex: 1 }}>
                <strong style={{ fontWeight: n.read ? 500 : 700 }}>{n.title}</strong>
                {n.body && <span className="muted" style={{ display: 'block', fontSize: 12 }}>{n.body}</span>}
                <span className="muted" style={{ fontSize: 11 }}>{new Date(n.createdAt).toLocaleString()} · {n.category}</span>
              </span>
              {n.href && <Link href={n.href} className="btn ghost sm" onClick={() => api.markNotificationRead(n.id).catch(() => {})}>Open</Link>}
              {!n.read && <button className="btn ghost sm" onClick={async () => { await api.markNotificationRead(n.id).catch(() => {}); load(); }}>Mark read</button>}
            </div>
          ))
        )}
      </div>
    </>
  );
}
