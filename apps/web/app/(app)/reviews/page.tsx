'use client';
import { useState } from 'react';

/**
 * REVIEWS WORKSPACE v1 (Phase 1). Reputation score, incoming reviews with
 * AI-drafted replies, and review-request stats from the post-job automation.
 * Google/Facebook ingestion connects per-tenant; until connected this renders
 * the workspace with representative data so the surface is always usable.
 */
const REVIEWS = [
  { id: 'r1', source: 'Google', author: 'Jordan M.', rating: 5, text: 'Tina arrived within the hour on the hottest day of the year and had our A/C running in 40 minutes. Absolute lifesavers.', when: '2h ago', replied: false },
  { id: 'r2', source: 'Google', author: 'Sam R.', rating: 5, text: 'Furnace tune-up was quick and professional. Booking over text was the easiest I have ever had with a contractor.', when: '1d ago', replied: true },
  { id: 'r3', source: 'Facebook', author: 'Priya K.', rating: 4, text: 'Great water heater install. Only reason for 4 stars is scheduling moved once — but they told me in advance.', when: '2d ago', replied: false },
  { id: 'r4', source: 'Google', author: 'Omar N.', rating: 3, text: 'Work was fine but the invoice took a few days to arrive after the visit.', when: '4d ago', replied: false },
];

const AI_DRAFTS: Record<string, string> = {
  r1: 'Thank you Jordan! Emergency calls on scorching days are exactly what we staff for — glad Tina got you cooled down fast. We appreciate you trusting us!',
  r3: 'Thanks Priya! Sorry about the reschedule — and really glad the heads-up helped. Enjoy the new water heater, and we are here if you need anything.',
  r4: 'Thanks for the honest feedback, Omar. You are right that the invoice should arrive same-day — we have tightened that up. Glad the work itself was solid.',
};

const STARS = (n: number) => '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);

export default function ReviewsPage() {
  const [drafts, setDrafts] = useState<Record<string, string>>(AI_DRAFTS);
  const [sent, setSent] = useState<Record<string, boolean>>({});

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Reviews & Reputation</h2>
          <span className="muted">Every review, answered fast — requests fire automatically after completed jobs</span>
        </div>
        <span className="badge">Replaces Podium / Birdeye</span>
      </div>

      <div className="grid-kpi" style={{ marginBottom: 20 }}>
        <div className="panel"><div className="muted">Reputation score</div><div className="kpi">4.8</div><div className="kpi-delta up">▲ 0.2 this quarter</div></div>
        <div className="panel"><div className="muted">Total reviews</div><div className="kpi">127</div><div className="kpi-delta up">+9 this month</div></div>
        <div className="panel"><div className="muted">Requests sent (30d)</div><div className="kpi">41</div><div className="muted" style={{ fontSize: 12 }}>auto after job completion</div></div>
        <div className="panel"><div className="muted">Request → review rate</div><div className="kpi">22%</div><div className="kpi-delta up">above 15% industry avg</div></div>
        <div className="panel"><div className="muted">Awaiting reply</div><div className="kpi">{REVIEWS.filter((r) => !r.replied && !sent[r.id]).length}</div><div className="muted" style={{ fontSize: 12 }}>AI drafts ready</div></div>
      </div>

      <div className="grid-2">
        <div className="panel" style={{ gridColumn: '1 / -1' }}>
          <h3>★ Incoming reviews</h3>
          {REVIEWS.map((r) => (
            <div key={r.id} style={{ borderBottom: '1px solid var(--border)', padding: '14px 0' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="agent-pill">{r.source}</span>
                <strong style={{ fontSize: 14 }}>{r.author}</strong>
                <span style={{ color: r.rating >= 4 ? 'var(--amber)' : 'var(--red)', letterSpacing: 2 }}>{STARS(r.rating)}</span>
                <span className="muted" style={{ marginLeft: 'auto' }}>{r.when}</span>
              </div>
              <p style={{ margin: '8px 0', fontSize: 14, lineHeight: 1.6 }}>{r.text}</p>
              {r.replied || sent[r.id] ? (
                <span className="chip ok">Replied</span>
              ) : (
                <div style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                  <div className="muted" style={{ fontSize: 11.5, marginBottom: 6 }}>✦ AI-drafted reply — edit before sending</div>
                  <textarea
                    value={drafts[r.id] ?? ''}
                    onChange={(e) => setDrafts({ ...drafts, [r.id]: e.target.value })}
                    style={{
                      width: '100%', minHeight: 60, background: 'transparent', color: 'var(--text)',
                      border: '1px solid var(--border)', borderRadius: 8, padding: 10, fontSize: 13.5,
                      fontFamily: 'inherit', resize: 'vertical',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn sm" onClick={() => setSent({ ...sent, [r.id]: true })}>Send reply</button>
                    <button className="btn ghost sm" onClick={() => setDrafts({ ...drafts, [r.id]: '' })}>Write my own</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="panel">
          <h3>🔗 Connected sources</h3>
          <div className="agent-row"><span style={{ flex: 1 }}>Google Business Profile</span><button className="btn ghost sm">Connect</button></div>
          <div className="agent-row"><span style={{ flex: 1 }}>Facebook Page</span><button className="btn ghost sm">Connect</button></div>
          <p className="muted" style={{ marginTop: 10, fontSize: 12.5 }}>
            Connect your profiles to pull reviews in live. Review requests already send automatically after every completed job.
          </p>
        </div>
        <div className="panel">
          <h3>⟳ Request automation</h3>
          <div className="agent-row"><span style={{ flex: 1 }}>Send review request 2h after job completion</span><span className="chip ok">Active</span></div>
          <div className="agent-row"><span style={{ flex: 1 }}>Skip customers with open complaints</span><span className="chip ok">Active</span></div>
          <div className="agent-row"><span style={{ flex: 1 }}>Follow-up nudge after 3 days (max 1)</span><span className="chip ok">Active</span></div>
        </div>
      </div>
    </>
  );
}
