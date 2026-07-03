import { PipelineBoard } from '../../components/PipelineBoard';
import { AgentActivity } from '../../components/AgentActivity';

/**
 * BUSINESS OWNER DASHBOARD. Minimal-clicks: at-a-glance KPIs, the live pipeline
 * board (columns from the industry module), and the AI workforce activity feed.
 */
export default function OwnerDashboard() {
  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Operations Overview</h2>
          <span className="muted">Your AI team handled 27 interactions today</span>
        </div>
        <span className="badge">Acme HVAC & Plumbing · Field Services</span>
      </div>

      <div className="grid" style={{ marginBottom: 18 }}>
        <div className="panel"><div className="muted">New leads today</div><div className="kpi">12</div></div>
        <div className="panel"><div className="muted">Booked automatically</div><div className="kpi">8</div></div>
        <div className="panel"><div className="muted">Missed-call saves</div><div className="kpi">4</div></div>
        <div className="panel"><div className="muted">Est. pipeline value</div><div className="kpi">$18.4k</div></div>
      </div>

      <h3 style={{ margin: '6px 0 12px' }}>Pipeline</h3>
      <PipelineBoard />

      <div style={{ marginTop: 18 }}>
        <AgentActivity />
      </div>
    </>
  );
}
