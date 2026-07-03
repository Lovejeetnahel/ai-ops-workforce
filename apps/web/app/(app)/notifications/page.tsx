'use client';

/**
 * Notification Center. In production this streams from /portal/notifications
 * (customers) and the activity feed (staff). Shown here with representative
 * items; importance + category drive grouping and the unread badge.
 */
const ITEMS = [
  { title: 'Payment received', body: '$240 from Jordan M. (invoice #4821)', importance: 'IMPORTANT', time: '4m ago' },
  { title: 'Appointment confirmed', body: 'Tomorrow 10:30 AM — Priya K.', importance: 'IMPORTANT', time: '22m ago' },
  { title: 'Job completed', body: 'Furnace tune-up — Sam R.', importance: 'IMPORTANT', time: '1h ago' },
  { title: 'New lead created', body: 'Web chat — water heater', importance: 'NORMAL', time: '2h ago' },
  { title: 'Sales AI scored a lead', body: 'Score 78/100 → qualified', importance: 'NORMAL', time: '2h ago' },
];

export default function NotificationsPage() {
  const unread = ITEMS.filter((i) => i.importance === 'IMPORTANT').length;
  return (
    <>
      <div className="topbar">
        <div><h2 style={{ margin: 0 }}>Notification Center</h2><span className="muted">{unread} important · {ITEMS.length} total</span></div>
        <button className="btn">Mark all read</button>
      </div>
      <div className="panel">
        {ITEMS.map((n, i) => (
          <div className="agent-row" key={i}>
            <span className="dot" style={{ background: n.importance === 'IMPORTANT' ? '#f59e0b' : '#475569' }} />
            <span style={{ flex: 1 }}><strong>{n.title}</strong> — <span className="muted">{n.body}</span></span>
            <span className="muted">{n.time}</span>
          </div>
        ))}
      </div>
    </>
  );
}
