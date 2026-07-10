'use client';

/**
 * Unified inbox layout for voice, SMS, chat and email. No conversation
 * threads exist until channels are connected, so this renders the real
 * two-pane inbox structure with an honest empty state rather than
 * fabricated sample messages.
 */
export default function ConversationsPage() {
  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Conversations</h2>
          <span className="muted">Voice, SMS, chat and email in one queue</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) 1fr', gap: 16, alignItems: 'start' }}>
        <div className="panel" style={{ padding: 10, minHeight: 420 }}>
          <div className="empty-state" style={{ padding: '40px 16px' }}>
            <div className="e-ico">▤</div>
            <h4>No conversations yet</h4>
            <p>Connect a phone number, SMS line or inbox to start seeing messages here.</p>
          </div>
        </div>

        <div className="panel" style={{ minHeight: 420, display: 'flex', flexDirection: 'column' }}>
          <div className="empty-state" style={{ margin: 'auto', padding: '40px 16px' }}>
            <div className="e-ico">◎</div>
            <h4>Select a conversation</h4>
            <p>Channel, customer context, assignment and internal notes will appear here once you have conversations.</p>
          </div>
        </div>
      </div>
    </>
  );
}
