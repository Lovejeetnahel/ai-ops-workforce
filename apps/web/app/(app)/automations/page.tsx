/**
 * AUTOMATION BUILDER (owner). Lists the active "when → then" rules. Module
 * presets are seeded per vertical; owners toggle/extend them. Each row is a
 * trigger event + ordered actions, backed by /api/automation/rules.
 */
const RULES = [
  { name: 'Text back missed callers', trigger: 'call.missed', actions: ['Send SMS w/ booking link', 'CRM: create lead'], on: true },
  { name: 'Emergency fast-track dispatch', trigger: 'lead.created (urgency = EMERGENCY)', actions: ['Dispatch nearest on-call', 'Alert owner'], on: true },
  { name: 'Request review after completion', trigger: 'job.completed', actions: ['Wait 2h', 'Send review SMS'], on: true },
  { name: 'Re-engage past customers', trigger: 'schedule.maintenance_window', actions: ['Send seasonal email'], on: false },
];

export default function Automations() {
  return (
    <>
      <div className="topbar">
        <div><h2 style={{ margin: 0 }}>Automations</h2><span className="muted">Your always-on workflows</span></div>
        <button className="btn">+ New rule</button>
      </div>
      <div className="grid">
        {RULES.map((r) => (
          <div className="panel" key={r.name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{r.name}</strong>
              <span className="tag" style={{ color: r.on ? '#34d399' : '#94a3b8' }}>{r.on ? 'Active' : 'Off'}</span>
            </div>
            <div className="muted" style={{ margin: '8px 0' }}>When <code>{r.trigger}</code></div>
            {r.actions.map((a, i) => (
              <div className="agent-row" key={i}><span className="agent-pill">{i + 1}</span><span>{a}</span></div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
