/**
 * Preview of the customer-facing portal. Customers authenticate with a scoped
 * portal link and see their own bookings, documents and conversation history.
 * This route shows the owner what that experience looks like structurally —
 * clearly labeled as a preview, never presented as a real customer's data.
 */
export default function CustomerPortalPreview() {
  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Customer Portal</h2>
          <span className="muted">This is a preview of what your customers see when they sign in</span>
        </div>
        <span className="badge">Preview</span>
      </div>
      <div className="grid">
        <div className="panel">
          <h3>Upcoming visit</h3>
          <div className="empty-state" style={{ padding: '24px 16px' }}>
            <div className="e-ico" style={{ width: 40, height: 40, fontSize: 18 }}>◈</div>
            <h4 style={{ fontSize: 13.5 }}>No upcoming visits</h4>
            <p style={{ fontSize: 12.5 }}>A customer&rsquo;s next booking shows here, with a reschedule option.</p>
          </div>
        </div>
        <div className="panel">
          <h3>Documents</h3>
          <div className="empty-state" style={{ padding: '24px 16px' }}>
            <div className="e-ico" style={{ width: 40, height: 40, fontSize: 18 }}>▤</div>
            <h4 style={{ fontSize: 13.5 }}>No documents yet</h4>
            <p style={{ fontSize: 12.5 }}>Quotes and invoices with pay links appear here for the customer.</p>
          </div>
        </div>
        <div className="panel">
          <h3>Conversation</h3>
          <div className="empty-state" style={{ padding: '24px 16px' }}>
            <div className="e-ico" style={{ width: 40, height: 40, fontSize: 18 }}>▤</div>
            <h4 style={{ fontSize: 13.5 }}>No messages yet</h4>
            <p style={{ fontSize: 12.5 }}>The customer&rsquo;s conversation history with your business appears here.</p>
          </div>
        </div>
      </div>
    </>
  );
}
