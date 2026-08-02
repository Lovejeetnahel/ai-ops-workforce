'use client';
import { useEffect, useState } from 'react';

const BASE = process.env.WEB_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Public self-booking page. Slots come from the business's REAL availability
 * engine (working hours minus bookings/time-off) — never invented. Booking
 * creates a REQUESTED appointment the business confirms.
 */
export default function PublicBookingPage({ params }: { params: { slug: string } }) {
  const [link, setLink] = useState<any>(null);
  const [slots, setSlots] = useState<any>(null);
  const [picked, setPicked] = useState<{ userId: string; start: string } | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [state, setState] = useState<'idle' | 'booking' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${BASE}/api/public/book/${params.slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setLink)
      .catch(() => setLink(false));
    fetch(`${BASE}/api/public/book/${params.slug}/slots`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setSlots)
      .catch(() => setSlots(false));
  }, [params.slug]);

  const book = async () => {
    if (!picked || !form.name.trim() || (!form.phone && !form.email)) return;
    setState('booking'); setError('');
    try {
      const res = await fetch(`${BASE}/api/public/book/${params.slug}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: picked.userId, start: picked.start, ...form }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message ?? 'Booking failed');
      setState('done');
    } catch (e: any) {
      setState('error'); setError(String(e?.message ?? 'Booking failed').slice(0, 200));
    }
  };

  if (link === false)
    return <main style={{ maxWidth: 560, margin: '80px auto', padding: 24, textAlign: 'center' }}><h1>Booking link not available</h1><p>This link may have been turned off. Contact the business directly.</p></main>;

  return (
    <main style={{ maxWidth: 640, margin: '40px auto', padding: 24 }}>
      {link === null ? <p>Loading…</p> : (
        <>
          <h1 style={{ marginBottom: 4 }}>{link.business}</h1>
          <p style={{ opacity: 0.7, marginTop: 0 }}>
            {link.name}{link.service ? ` — ${link.service.name} (${link.service.durationMin} min${link.service.priceCents != null ? `, $${(link.service.priceCents / 100).toFixed(0)}` : ''})` : ''}
          </p>

          {state === 'done' ? (
            <div style={{ padding: 24, border: '1px solid #2a2', borderRadius: 12, marginTop: 24 }}>
              <h2>Request received ✓</h2>
              <p>Your appointment request for <strong>{picked && new Date(picked.start).toLocaleString()}</strong> is in. The business will confirm it — you&rsquo;ll hear from them at the contact details you provided.</p>
            </div>
          ) : (
            <>
              <h3 style={{ marginTop: 28 }}>1. Pick a time</h3>
              {slots === null && <p>Checking real availability…</p>}
              {slots === false && <p>Could not load availability — try again shortly.</p>}
              {slots && slots !== false && (slots.staff ?? []).length === 0 && (
                <p style={{ opacity: 0.75 }}>No open slots in the next week. The business&rsquo;s calendar is full or hours aren&rsquo;t set — contact them directly.</p>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(slots?.staff ?? []).flatMap((s: any) =>
                  s.slots.slice(0, 24).map((slot: any) => {
                    const start = slot.start ?? slot;
                    const key = `${s.userId}-${start}`;
                    const active = picked?.userId === s.userId && picked?.start === start;
                    return (
                      <button key={key} onClick={() => setPicked({ userId: s.userId, start })}
                        style={{ padding: '8px 12px', borderRadius: 8, border: active ? '2px solid #ffc629' : '1px solid #555', background: active ? 'rgba(255,198,41,0.15)' : 'transparent', cursor: 'pointer', color: 'inherit', fontSize: 13 }}>
                        {new Date(start).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </button>
                    );
                  }),
                )}
              </div>

              <h3 style={{ marginTop: 28 }}>2. Your details</h3>
              <div style={{ display: 'grid', gap: 10 }}>
                <input placeholder="Your name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} />
                <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inp} />
                <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inp} />
                <textarea placeholder="Anything we should know? (optional)" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={inp} />
              </div>
              {error && <p style={{ color: '#f87171' }}>{error}</p>}
              <button onClick={book} disabled={state === 'booking' || !picked || !form.name.trim() || (!form.phone && !form.email)}
                style={{ marginTop: 16, padding: '12px 24px', borderRadius: 10, background: '#ffc629', color: '#0a0a0a', border: 0, fontWeight: 700, cursor: 'pointer', opacity: !picked || !form.name.trim() || (!form.phone && !form.email) ? 0.5 : 1 }}>
                {state === 'booking' ? 'Requesting…' : 'Request this time'}
              </button>
              <p style={{ fontSize: 12, opacity: 0.6, marginTop: 10 }}>You&rsquo;re requesting a slot from this business&rsquo;s live calendar; they confirm it before it&rsquo;s final.</p>
            </>
          )}
        </>
      )}
    </main>
  );
}

const inp: React.CSSProperties = { padding: '10px 12px', borderRadius: 8, border: '1px solid #555', background: 'transparent', color: 'inherit', fontSize: 14 };
