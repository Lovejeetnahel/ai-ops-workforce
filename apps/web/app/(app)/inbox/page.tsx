'use client';
import { useState } from 'react';

/**
 * UNIFIED INBOX v1 (Phase 1). One queue over every channel — voice
 * transcripts, SMS, web chat and email — with AI handling routine volume and
 * humans taking over on demand. Renders representative threads until the
 * tenant's channels are connected.
 */
const THREADS = [
  { id: 't1', channel: 'SMS', who: 'Jordan M.', last: 'Perfect, see Tina at 10:30. Thank you!!', when: '2m', unread: false, ai: true },
  { id: 't2', channel: 'Voice', who: '(555) 014-2291', last: 'Voicemail transcript: "Hi, my furnace is making a rattling noise, hoping someone can come take a look…"', when: '18m', unread: true, ai: false },
  { id: 't3', channel: 'Chat', who: 'Priya K.', last: 'AI: Your water heater install is confirmed for tomorrow 10:30 AM ✅', when: '31m', unread: false, ai: true },
  { id: 't4', channel: 'Email', who: 'omar.n@getmail.com', last: 'Could you send the invoice from last week again? I can’t find it.', when: '1h', unread: true, ai: false },
  { id: 't5', channel: 'SMS', who: 'Lena W.', last: 'AI: We can fit you in Thursday 9 AM or Friday 1 PM — which works better?', when: '2h', unread: false, ai: true },
];

const MESSAGES: Record<string, { from: string; text: string; ai?: boolean }[]> = {
  t2: [
    { from: 'them', text: 'Voicemail (0:32) — transcript: "Hi, my furnace is making a rattling noise when it kicks on, hoping someone can come take a look this week. My name is Dale, I’m over on the west side."' },
    { from: 'ai', text: 'Suggested reply: "Hi Dale, thanks for calling! A rattling furnace is usually a quick fix. We have Thursday 9 AM or Friday 1 PM open on the west side — want me to book one?"', ai: true },
  ],
  t4: [
    { from: 'them', text: 'Could you send the invoice from last week again? I can’t find it.' },
    { from: 'ai', text: 'Suggested reply: "Of course — here’s invoice #4802 with a pay link: [link]. It’s also always available in your customer portal."', ai: true },
  ],
};

const CHANNEL_COLOR: Record<string, string> = { SMS: '#34d399', Voice: '#60a5fa', Chat: '#a78bfa', Email: '#fbbf24' };

export default function InboxPage() {
  const [active, setActive] = useState('t2');
  const thread = THREADS.find((t) => t.id === active)!;
  const msgs = MESSAGES[active] ?? [{ from: 'them', text: thread.last }];

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Inbox</h2>
          <span className="muted">Voice, SMS, chat and email in one queue — AI handles the routine, you take the rest</span>
        </div>
        <span className="badge">{THREADS.filter((t) => t.unread).length} needs a human</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) 1fr', gap: 16, alignItems: 'start' }}>
        <div className="panel" style={{ padding: 10 }}>
          {THREADS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                background: active === t.id ? 'var(--panel-2)' : 'transparent',
                border: '1px solid', borderColor: active === t.id ? 'var(--border-strong)' : 'transparent',
                borderRadius: 10, padding: '10px 12px', marginBottom: 4, color: 'var(--text)',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="dot" style={{ background: CHANNEL_COLOR[t.channel] }} />
                <strong style={{ fontSize: 13.5, flex: 1 }}>{t.who}</strong>
                {t.ai && <span className="tag" style={{ fontSize: 10 }}>AI handling</span>}
                <span className="muted" style={{ fontSize: 11 }}>{t.when}</span>
              </div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: t.unread ? 700 : 400, color: t.unread ? 'var(--text)' : undefined }}>
                {t.last}
              </div>
            </button>
          ))}
        </div>

        <div className="panel" style={{ minHeight: 420, display: 'flex', flexDirection: 'column' }}>
          <h3>
            <span className="dot" style={{ background: CHANNEL_COLOR[thread.channel] }} />
            {thread.who} <span className="muted" style={{ fontWeight: 400 }}>· {thread.channel}</span>
          </h3>
          <div style={{ flex: 1 }}>
            {msgs.map((m, i) => (
              <div
                key={i}
                style={{
                  background: m.ai ? 'rgba(99,102,241,0.1)' : 'var(--panel-2)',
                  border: '1px solid', borderColor: m.ai ? 'rgba(99,102,241,0.35)' : 'var(--border)',
                  borderRadius: 12, padding: '10px 14px', marginBottom: 10, maxWidth: 560, fontSize: 13.5, lineHeight: 1.6,
                }}
              >
                {m.ai && <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>✦ AI suggestion</div>}
                {m.text}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              placeholder={`Reply by ${thread.channel}…`}
              style={{
                flex: 1, background: 'rgba(7,10,20,0.6)', border: '1px solid var(--border-strong)',
                borderRadius: 10, color: 'var(--text)', padding: '10px 13px', fontSize: 14, outline: 'none',
              }}
            />
            <button className="btn sm">Send</button>
            <button className="btn ghost sm">Use AI draft</button>
          </div>
        </div>
      </div>
    </>
  );
}
