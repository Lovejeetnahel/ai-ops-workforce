/**
 * WORKFLOW RUNS. Where automations (the rules) meet reality (the runs).
 * Every execution is logged with outcome and value attribution.
 */
const RUNS = [
  { flow: 'Missed-call text-back', trigger: 'call.missed — (555) 014-2291', outcome: 'SMS sent · lead created · booked', value: '+$240', chip: 'ok', when: '9:41 AM' },
  { flow: 'Emergency fast-track', trigger: 'lead.created — urgency EMERGENCY', outcome: 'Dispatched Tina Tech · owner alerted', value: 'SLA met', chip: 'ok', when: '9:12 AM' },
  { flow: 'Review request', trigger: 'job.completed — Sam R.', outcome: '★★★★★ review received', value: '+reputation', chip: 'ok', when: '8:55 AM' },
  { flow: 'Re-engagement email', trigger: 'schedule.maintenance_window', outcome: '28 delivered · 1 bounce', value: '3 replies', chip: 'warn', when: '8:00 AM' },
  { flow: 'Missed-call text-back', trigger: 'call.missed — (555) 019-8804', outcome: 'SMS sent · awaiting reply', value: 'pending', chip: 'warn', when: '7:48 AM' },
];

const STATS = [
  { label: 'Runs today', value: '51' },
  { label: 'Success rate', value: '98%' },
  { label: 'Revenue attributed', value: '$1,120' },
  { label: 'Hours saved (est.)', value: '6.5' },
];

export default function WorkflowsPage() {
  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Workflows</h2>
          <span className="muted">Every automation run, its outcome, and the value it produced</span>
        </div>
        <span className="badge">Event-driven · idempotent</span>
      </div>

      <div className="grid-kpi" style={{ marginBottom: 20 }}>
        {STATS.map((s) => (
          <div className="panel" key={s.label}>
            <div className="muted">{s.label}</div>
            <div className="kpi">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="panel">
        <h3>🔀 Today’s runs</h3>
        {RUNS.map((r, i) => (
          <div className="agent-row" key={i}>
            <span className="agent-pill">{r.when}</span>
            <span style={{ flex: 1 }}>
              <strong>{r.flow}</strong>
              <span className="muted"> · {r.trigger}</span>
            </span>
            <span className="muted" style={{ flex: 1 }}>{r.outcome}</span>
            <span className={`chip ${r.chip}`}>{r.value}</span>
          </div>
        ))}
      </div>

      <p className="muted" style={{ marginTop: 14, fontSize: 12.5 }}>
        Rules are managed under <strong>Automations</strong>; this page shows their execution history and outcomes.
      </p>
    </>
  );
}
