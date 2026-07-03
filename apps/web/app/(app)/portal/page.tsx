/**
 * CUSTOMER PORTAL. The end customer / tenant-resident / applicant authenticates
 * with a scoped portal token and sees only their own bookings, conversation
 * history, and documents (invoices/quotes/forms to e-sign or pay).
 */
export default function CustomerPortal() {
  return (
    <>
      <div className="topbar">
        <div><h2 style={{ margin: 0 }}>Welcome back, Jordan</h2><span className="muted">Acme HVAC & Plumbing</span></div>
        <span className="badge">Customer portal</span>
      </div>
      <div className="grid">
        <div className="panel">
          <h3>Upcoming visit</h3>
          <div className="kpi" style={{ fontSize: 20 }}>Today · 10:30 AM</div>
          <p className="muted">Emergency A/C repair — Tina Tech is on the way.</p>
          <button className="btn">Reschedule</button>
        </div>
        <div className="panel">
          <h3>Documents</h3>
          <div className="agent-row"><span style={{ flex: 1 }}>Quote #4820</span><span className="tag">Accepted</span></div>
          <div className="agent-row"><span style={{ flex: 1 }}>Invoice #4821</span><button className="btn" style={{ padding: '4px 10px' }}>Pay $240</button></div>
        </div>
        <div className="panel">
          <h3>Conversation</h3>
          <p className="muted">You: “My A/C stopped working”</p>
          <p className="muted">AI: “Got it — booked an emergency visit for today at 10:30 AM. ✅”</p>
        </div>
      </div>
    </>
  );
}
