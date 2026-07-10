'use client';

export default function NotificationsPage() {
  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Notifications</h2>
          <span className="muted">Payments, appointments, jobs and lead activity</span>
        </div>
      </div>
      <div className="panel">
        <div className="empty-state">
          <div className="e-ico">🔔</div>
          <h4>You&rsquo;re all caught up</h4>
          <p>Payments received, appointments confirmed, jobs completed and new leads will show up here as they happen.</p>
        </div>
      </div>
    </>
  );
}
