'use client';

/**
 * Live feed of what the AI workforce has been doing — the "did the robots earn
 * their keep today" panel owners actually look at. In production this streams
 * from the EventLog via SSE; here it shows a representative slice.
 */
const DEMO = [
  { agent: 'Voice', text: 'Answered call from Jordan M., booked emergency A/C visit', time: '2m ago' },
  { agent: 'Dispatch', text: 'Assigned job to Tina Tech (Eastside, +Heating/Cooling)', time: '2m ago' },
  { agent: 'Chat', text: 'Qualified web-chat lead Priya K. for water heater quote', time: '14m ago' },
  { agent: 'Follow-up', text: 'Sent review request to Sam R. after completed tune-up', time: '1h ago' },
  { agent: 'Document', text: 'Generated invoice #4821 with Stripe pay link', time: '1h ago' },
  { agent: 'CRM', text: 'Re-engaged 3 cold leads from last month', time: '3h ago' },
];

const COLOR: Record<string, string> = {
  Voice: '#60a5fa', Chat: '#a78bfa', CRM: '#34d399',
  Dispatch: '#fbbf24', 'Follow-up': '#f472b6', Document: '#22d3ee',
};

export function AgentActivity() {
  return (
    <div className="panel">
      <h3>AI Workforce Activity</h3>
      {DEMO.map((row, i) => (
        <div className="agent-row" key={i}>
          <span className="agent-pill" style={{ color: COLOR[row.agent] }}>{row.agent}</span>
          <span style={{ flex: 1 }}>{row.text}</span>
          <span className="muted">{row.time}</span>
        </div>
      ))}
    </div>
  );
}
