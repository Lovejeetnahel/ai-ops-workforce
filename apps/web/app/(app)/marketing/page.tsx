'use client';
import { useState } from 'react';

/**
 * MARKETING STUDIO v1 (Phase 1). AI post generator fed by real operational
 * events (completed jobs, five-star reviews), a simple campaign calendar, and
 * channel connections. Posting goes live per-channel once accounts connect.
 */
const EVENT_POSTS = [
  {
    id: 'p1', trigger: 'Job completed — Emergency A/C repair (Eastside)',
    draft: '🔥 95° outside and no A/C? Our tech Tina had this Eastside family cooled back down in under an hour today. Same-day emergency service, every day of the summer. 📞 Call or text us — we answer 24/7.',
    channel: 'Facebook + Instagram',
  },
  {
    id: 'p2', trigger: 'New ★★★★★ review from Sam R.',
    draft: '"Booking over text was the easiest I’ve ever had with a contractor." — Sam R. ⭐⭐⭐⭐⭐\n\nThat’s the goal: fast to book, fast to fix, easy to pay. Thanks Sam!',
    channel: 'Google Business Profile',
  },
  {
    id: 'p3', trigger: 'Seasonal — fall furnace tune-up window opens',
    draft: '❄️ First cold night is coming. A 45-minute furnace tune-up now beats a no-heat emergency in January. Book your fall tune-up this week — link in bio.',
    channel: 'Facebook + Instagram',
  },
];

const CALENDAR = [
  { day: 'Mon', item: 'Before/after: water heater install', status: 'scheduled' },
  { day: 'Tue', item: '5-star review spotlight (auto)', status: 'scheduled' },
  { day: 'Wed', item: '—', status: 'empty' },
  { day: 'Thu', item: 'Fall tune-up campaign post', status: 'draft' },
  { day: 'Fri', item: 'Meet the team: Tina', status: 'idea' },
  { day: 'Sat', item: 'Weekend emergency availability', status: 'scheduled' },
  { day: 'Sun', item: '—', status: 'empty' },
];

export default function MarketingPage() {
  const [approved, setApproved] = useState<Record<string, boolean>>({});

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Marketing Studio</h2>
          <span className="muted">Posts generated from real jobs and reviews — content Buffer can’t write</span>
        </div>
        <span className="badge">AI Post Generator</span>
      </div>

      <div className="grid-kpi" style={{ marginBottom: 20 }}>
        <div className="panel"><div className="muted">Posts this month</div><div className="kpi">14</div><div className="kpi-delta up">+6 vs last month</div></div>
        <div className="panel"><div className="muted">From operational events</div><div className="kpi">9</div><div className="muted" style={{ fontSize: 12 }}>jobs & reviews → posts</div></div>
        <div className="panel"><div className="muted">Booking-link clicks</div><div className="kpi">86</div><div className="kpi-delta up">4 booked jobs attributed</div></div>
        <div className="panel"><div className="muted">Channels connected</div><div className="kpi">0/3</div><div className="muted" style={{ fontSize: 12 }}>connect below to go live</div></div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h3>✦ AI drafts from your business activity</h3>
        {EVENT_POSTS.map((p) => (
          <div key={p.id} style={{ borderBottom: '1px solid var(--border)', padding: '13px 0' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
              <span className="agent-pill">Trigger</span>
              <span className="muted" style={{ fontSize: 12.5, flex: 1 }}>{p.trigger}</span>
              <span className="tag">{p.channel}</span>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
              {p.draft}
            </p>
            {approved[p.id] ? (
              <span className="chip ok">Queued — publishes when channel connects</span>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn sm" onClick={() => setApproved({ ...approved, [p.id]: true })}>Approve & schedule</button>
                <button className="btn ghost sm">Regenerate</button>
                <button className="btn ghost sm">Edit</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="panel">
          <h3>📅 This week’s campaign calendar</h3>
          {CALENDAR.map((c) => (
            <div className="agent-row" key={c.day}>
              <span className="agent-pill" style={{ minWidth: 44, textAlign: 'center' }}>{c.day}</span>
              <span style={{ flex: 1, color: c.status === 'empty' ? 'var(--muted)' : undefined }}>{c.item}</span>
              {c.status === 'scheduled' && <span className="chip ok">Scheduled</span>}
              {c.status === 'draft' && <span className="chip warn">Draft</span>}
              {c.status === 'idea' && <span className="tag">Idea</span>}
            </div>
          ))}
        </div>
        <div className="panel">
          <h3>🔗 Channels</h3>
          <div className="agent-row"><span style={{ flex: 1 }}>Google Business Profile</span><button className="btn ghost sm">Connect</button></div>
          <div className="agent-row"><span style={{ flex: 1 }}>Facebook Page</span><button className="btn ghost sm">Connect</button></div>
          <div className="agent-row"><span style={{ flex: 1 }}>Instagram Business</span><button className="btn ghost sm">Connect</button></div>
          <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>
            Approved posts queue up and publish automatically once a channel is connected. Drafts keep
            generating from your completed jobs and new reviews either way.
          </p>
        </div>
      </div>
    </>
  );
}
