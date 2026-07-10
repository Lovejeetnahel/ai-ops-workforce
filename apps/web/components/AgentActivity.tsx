'use client';

/**
 * Live feed of what the AI workforce has been doing. Once wired to the real
 * event log this streams real agent actions; until then it shows an honest
 * empty state rather than fabricated activity.
 */
export function AgentActivity() {
  return (
    <div className="panel">
      <h3>AI Workforce Activity</h3>
      <div className="empty-state" style={{ padding: '32px 16px' }}>
        <div className="e-ico">✦</div>
        <h4>No AI activity yet</h4>
        <p>Once your AI employees start handling calls, leads and follow-ups, you&rsquo;ll see their activity here.</p>
      </div>
    </div>
  );
}
