/**
 * STAFF DASHBOARD. A technician/contractor/caseworker sees only their assigned
 * work for today with one-tap status updates — the minimal mobile surface field
 * staff actually use. Labels ("Job" vs "Work Order" vs "Case") come from the
 * industry module.
 */
const JOBS = [
  { id: 'j1', title: 'No A/C — emergency', customer: 'Jordan M.', when: '10:30 AM', where: 'Eastside', status: 'Tech En Route' },
  { id: 'j2', title: 'Water heater replacement', customer: 'Priya K.', when: '1:00 PM', where: 'Downtown', status: 'Scheduled' },
  { id: 'j3', title: 'Furnace tune-up', customer: 'Sam R.', when: '3:30 PM', where: 'Westside', status: 'Scheduled' },
];

export default function StaffJobs() {
  return (
    <>
      <div className="topbar">
        <div><h2 style={{ margin: 0 }}>My Jobs — Today</h2><span className="muted">Tina Tech · 3 visits</span></div>
        <span className="badge">Staff view</span>
      </div>
      <div className="grid">
        {JOBS.map((j) => (
          <div className="panel" key={j.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{j.when}</strong>
              <span className="tag">{j.status}</span>
            </div>
            <h3 style={{ margin: '8px 0 2px' }}>{j.title}</h3>
            <div className="muted">{j.customer} · {j.where}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn">Start</button>
              <button className="btn" style={{ background: '#22c55e' }}>Complete</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
