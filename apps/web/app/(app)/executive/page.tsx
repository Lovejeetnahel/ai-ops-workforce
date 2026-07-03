'use client';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';

export default function ExecutivePage() {
  const [briefing, setBriefing] = useState<any>(null);

  useEffect(() => {
    api.briefing().then(setBriefing).catch(() => {});
  }, []);

  const fallback = 'Connect the API and run the Executive AI to generate today\'s briefing. It assembles KPIs, the 30-day revenue forecast, overdue invoices, pending approvals and urgent jobs into a prioritized action list.';

  return (
    <>
      <div className="topbar">
        <div><h2 style={{ margin: 0 }}>Executive Briefing</h2><span className="muted">"What should I do today?"</span></div>
        <span className="badge">AI generated</span>
      </div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <h3>Daily briefing</h3>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{briefing?.briefing ?? fallback}</p>
      </div>
      {briefing?.signals && (
        <div className="grid">
          <div className="panel"><div className="muted">Revenue forecast (30d)</div><div className="kpi">${Number(briefing.signals.revenueForecast30d ?? 0).toLocaleString()}</div></div>
          <div className="panel"><div className="muted">Overdue invoices</div><div className="kpi">{briefing.signals.overdueInvoices ?? 0}</div></div>
          <div className="panel"><div className="muted">Pending approvals</div><div className="kpi">{briefing.signals.pendingApprovals ?? 0}</div></div>
          <div className="panel"><div className="muted">Urgent open jobs</div><div className="kpi">{briefing.signals.urgentOpenJobs ?? 0}</div></div>
        </div>
      )}
    </>
  );
}
