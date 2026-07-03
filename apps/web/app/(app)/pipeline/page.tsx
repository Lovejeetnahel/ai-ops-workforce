import { PipelineBoard } from '../../../components/PipelineBoard';

/**
 * FULL PIPELINE VIEW. The same industry-aware kanban as the dashboard widget,
 * with room to breathe. Columns come from the tenant's module config.
 */
export default function PipelinePage() {
  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Pipeline</h2>
          <span className="muted">Every lead from every channel, in your industry’s stages</span>
        </div>
        <span className="badge">Auto-updated by AI workforce</span>
      </div>
      <PipelineBoard />
      <div className="grid-kpi" style={{ marginTop: 20 }}>
        <div className="panel"><div className="muted">Pipeline value</div><div className="kpi">$82,500</div></div>
        <div className="panel"><div className="muted">Conversion rate</div><div className="kpi">38%</div></div>
        <div className="panel"><div className="muted">Avg. time to book</div><div className="kpi">2.4h</div></div>
        <div className="panel"><div className="muted">Leads this month</div><div className="kpi">96</div></div>
      </div>
    </>
  );
}
