/**
 * DISPATCH BOARD. Live view of who is where, on what, and what's waiting.
 * Smart dispatch assigns by skill, zone and urgency; this board is the
 * human override surface.
 */
const ACTIVE = [
  { tech: 'Tina Tech', zone: 'Eastside', skills: 'Heating/Cooling', job: 'Emergency A/C repair — Jordan M.', status: 'En route · ETA 12 min', chip: 'warn' },
  { tech: 'Marco V.', zone: 'Downtown', skills: 'Plumbing', job: 'Water heater replacement — Priya K.', status: 'On site · 42 min', chip: 'ok' },
  { tech: 'Dee Patel', zone: 'Westside', skills: 'Heating/Cooling', job: 'Furnace tune-up — Sam R.', status: 'Scheduled 3:30 PM', chip: 'ok' },
];

const QUEUE = [
  { job: 'Thermostat replacement — Lena W.', zone: 'Downtown', urgency: 'NORMAL', suggested: 'Marco V. (after current job)' },
  { job: 'Duct inspection — Omar N.', zone: 'Eastside', urgency: 'NORMAL', suggested: 'Tina Tech (tomorrow AM)' },
  { job: 'No heat — Ruth B.', zone: 'Westside', urgency: 'EMERGENCY', suggested: 'Dee Patel (bump tune-up?)' },
];

const CAPACITY = [
  { zone: 'Eastside', load: 82 },
  { zone: 'Downtown', load: 64 },
  { zone: 'Westside', load: 91 },
];

export default function DispatchPage() {
  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Dispatch</h2>
          <span className="muted">Skill, zone and urgency-aware assignment — with human override</span>
        </div>
        <span className="badge">Smart dispatch: ON</span>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h3>🚚 Active assignments</h3>
        {ACTIVE.map((a) => (
          <div className="agent-row" key={a.tech}>
            <span className="agent-pill">{a.tech}</span>
            <span style={{ flex: 2 }}>{a.job}</span>
            <span className="muted" style={{ flex: 1 }}>{a.zone} · {a.skills}</span>
            <span className={`chip ${a.chip}`}>{a.status}</span>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3>⏳ Waiting for dispatch</h3>
          {QUEUE.map((q) => (
            <div className="agent-row" key={q.job}>
              <span style={{ flex: 2 }}>
                {q.job}
                {q.urgency === 'EMERGENCY' && (
                  <span className="chip err" style={{ marginLeft: 8 }}>🚨 Emergency</span>
                )}
              </span>
              <span className="muted" style={{ flex: 1 }}>{q.zone}</span>
              <span className="tag">AI suggests: {q.suggested}</span>
            </div>
          ))}
          <button className="btn sm" style={{ marginTop: 12 }}>Accept all suggestions</button>
        </div>
        <div className="panel">
          <h3>📍 Zone capacity today</h3>
          {CAPACITY.map((c) => (
            <div key={c.zone} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                <span>{c.zone}</span>
                <span className="muted">{c.load}% booked</span>
              </div>
              <div style={{ background: 'var(--panel-2)', borderRadius: 4, height: 8 }}>
                <div className="bar" style={{ width: `${c.load}%` }} />
              </div>
            </div>
          ))}
          <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>
            Westside is near capacity — smart dispatch will start offering next-day slots.
          </p>
        </div>
      </div>
    </>
  );
}
