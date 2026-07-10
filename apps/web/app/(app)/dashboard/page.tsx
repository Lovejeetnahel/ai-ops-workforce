'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const TODAY_CARDS = [
  { label: 'New leads today', icon: '◈' },
  { label: 'Booked this week', icon: '▲' },
  { label: 'Open conversations', icon: '▤' },
  { label: 'Revenue this month', icon: '▭' },
];

const QUICK_ACTIONS = [
  { href: '/crm', label: 'Add a contact', icon: '◈' },
  { href: '/sales', label: 'View your pipeline', icon: '▲' },
  { href: '/voice-ai', label: 'Set up Voice AI', icon: '◎' },
  { href: '/automation', label: 'Create an automation', icon: '⟳' },
];

/**
 * AI Command Center — honest placeholder structure ahead of Phase 2's real
 * data wiring. No fabricated numbers or invented activity: every metric is
 * clearly empty until connected, per the Sofilic 2.0 product rules.
 */
export default function Dashboard() {
  const [businessName, setBusinessName] = useState<string | null>(null);

  useEffect(() => {
    try {
      const u = JSON.parse(window.localStorage.getItem('aiow_user') ?? 'null');
      if (u?.tenant?.name) setBusinessName(u.tenant.name);
    } catch {}
  }, []);

  return (
    <>
      <div className="panel glow" style={{ marginBottom: 20 }}>
        <div className="topbar" style={{ marginBottom: 8 }}>
          <div>
            <h2 style={{ margin: 0 }}>⚡ AI Command Center</h2>
            <span className="muted">Your business overview, in one place.</span>
          </div>
          {businessName && <span className="badge">{businessName}</span>}
        </div>
      </div>

      {/* Today summary */}
      <div className="grid-kpi" style={{ marginBottom: 20 }}>
        {TODAY_CARDS.map((c) => (
          <div className="panel" key={c.label}>
            <div className="muted">{c.label}</div>
            <div className="kpi" style={{ color: 'var(--muted)' }}>—</div>
            <div className="kpi-delta muted">No data yet</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        {/* Recent activity */}
        <div className="panel">
          <h3>Recent activity</h3>
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <div className="e-ico">◔</div>
            <h4>No activity yet</h4>
            <p>Once you start receiving leads, calls and payments, you&rsquo;ll see them here.</p>
          </div>
        </div>

        {/* Needs attention */}
        <div className="panel">
          <h3>Needs attention</h3>
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <div className="e-ico">✓</div>
            <h4>Nothing needs your attention</h4>
            <p>Overdue invoices, unanswered conversations and urgent items will surface here.</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="panel">
        <h3>Quick actions</h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {QUICK_ACTIONS.map((a) => (
            <Link href={a.href} key={a.href} className="card" style={{ textDecoration: 'none', display: 'block' }}>
              <span className="ico" style={{ fontSize: 18 }}>{a.icon}</span>
              <div className="name" style={{ marginTop: 8 }}>{a.label}</div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
