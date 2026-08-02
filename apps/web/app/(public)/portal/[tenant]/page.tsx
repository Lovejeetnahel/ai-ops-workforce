'use client';
import { useCallback, useEffect, useState } from 'react';

const BASE = process.env.WEB_PUBLIC_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'aiow_portal_token';

async function preq(path: string, init?: RequestInit) {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null;
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

const TABS = ['Overview', 'Appointments', 'Invoices & payments', 'Messages', 'Documents', 'Profile'] as const;
type Tab = (typeof TABS)[number];
const money = (n: number) => `$${Number(n ?? 0).toLocaleString()}`;

/**
 * Customer Portal V1 — tenant-branded, customer-authenticated (separate
 * principal from staff), tenant-isolated on the server. Customers see only
 * their own data; honest empty states everywhere; mobile-first layout.
 */
export default function CustomerPortal({ params }: { params: { tenant: string } }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [login, setLogin] = useState({ email: '', password: '' });
  const [loginErr, setLoginErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('Overview');
  const [dash, setDash] = useState<any>(null);
  const [appts, setAppts] = useState<any[] | null>(null);
  const [invoices, setInvoices] = useState<any[] | null>(null);
  const [payments, setPayments] = useState<any[] | null>(null);
  const [messages, setMessages] = useState<any>(null);
  const [docs, setDocs] = useState<any[] | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => { setAuthed(!!window.localStorage.getItem(TOKEN_KEY)); }, []);

  const loadTab = useCallback((t: Tab) => {
    if (t === 'Overview') preq('/portal/dashboard').then(setDash).catch(() => setDash(false));
    if (t === 'Appointments') preq('/portal/appointments').then(setAppts).catch(() => setAppts([]));
    if (t === 'Invoices & payments') {
      preq('/portal/invoices').then(setInvoices).catch(() => setInvoices([]));
      preq('/portal/payments').then(setPayments).catch(() => setPayments([]));
    }
    if (t === 'Messages') preq('/portal/messages').then(setMessages).catch(() => setMessages(false));
    if (t === 'Documents') preq('/portal/documents').then(setDocs).catch(() => setDocs([]));
    if (t === 'Profile') preq('/portal/profile').then(setProfile).catch(() => setProfile(false));
  }, []);

  useEffect(() => { if (authed) loadTab(tab); }, [authed, tab, loadTab]);

  const doLogin = async () => {
    setBusy(true); setLoginErr('');
    try {
      const res = await fetch(`${BASE}/api/portal/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantSlug: params.tenant, email: login.email, password: login.password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message ?? 'Sign-in failed');
      window.localStorage.setItem(TOKEN_KEY, json.accessToken ?? json.token);
      setAuthed(true);
    } catch (e: any) { setLoginErr(String(e?.message ?? 'Sign-in failed').slice(0, 160)); }
    finally { setBusy(false); }
  };

  const signOut = () => { window.localStorage.removeItem(TOKEN_KEY); setAuthed(false); };

  const sendMessage = async () => {
    if (!msg.trim()) return;
    try { await preq('/portal/messages', { method: 'POST', body: JSON.stringify({ text: msg }) }); setMsg(''); loadTab('Messages'); }
    catch { setLoginErr('Could not send'); }
  };

  const wrap: React.CSSProperties = { maxWidth: 720, margin: '0 auto', padding: 16, fontFamily: 'system-ui, sans-serif' };
  const card: React.CSSProperties = { border: '1px solid rgba(128,128,128,0.3)', borderRadius: 12, padding: 16, marginBottom: 12 };
  const gold = '#ffc629';

  if (authed === null) return <main style={wrap}>Loading…</main>;

  if (!authed)
    return (
      <main style={{ ...wrap, maxWidth: 420, paddingTop: 64 }}>
        <h1 style={{ textAlign: 'center' }}>Customer portal</h1>
        <p style={{ textAlign: 'center', opacity: 0.7 }}>Sign in with the portal account this business created for you.</p>
        <div style={{ display: 'grid', gap: 10, marginTop: 20 }}>
          <input placeholder="Email" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} style={{ padding: 12, borderRadius: 8, border: '1px solid #666', background: 'transparent', color: 'inherit' }} />
          <input placeholder="Password" type="password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} style={{ padding: 12, borderRadius: 8, border: '1px solid #666', background: 'transparent', color: 'inherit' }} />
          {loginErr && <p style={{ color: '#f87171', fontSize: 13 }}>{loginErr}</p>}
          <button onClick={doLogin} disabled={busy || !login.email || !login.password} style={{ padding: 12, borderRadius: 8, background: gold, color: '#0a0a0a', border: 0, fontWeight: 700, cursor: 'pointer' }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </main>
    );

  return (
    <main style={wrap}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '12px 0' }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Your portal</h1>
        <button onClick={signOut} style={{ background: 'transparent', border: '1px solid #666', borderRadius: 8, padding: '6px 12px', color: 'inherit', cursor: 'pointer' }}>Sign out</button>
      </header>
      <nav style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8 }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '8px 12px', borderRadius: 8, whiteSpace: 'nowrap', border: tab === t ? `2px solid ${gold}` : '1px solid #555', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 13 }}>
            {t}
          </button>
        ))}
      </nav>

      {tab === 'Overview' && (
        dash === null ? <p>Loading…</p> : dash === false ? <p>Could not load — sign in again.</p> : (
          <>
            <div style={card}><strong>Upcoming visits</strong>
              {(dash.upcomingBookings ?? []).length === 0 ? <p style={{ opacity: 0.7, fontSize: 14 }}>No upcoming appointments.</p> :
                dash.upcomingBookings.map((b: any) => <p key={b.id} style={{ fontSize: 14 }}>{new Date(b.start).toLocaleString()} · {b.status}</p>)}
            </div>
            <div style={card}><strong>Balance due</strong>
              <p style={{ fontSize: 14 }}>{dash.unpaid?.count ? `${dash.unpaid.count} open invoice(s) — ${money(dash.unpaid.total)}` : 'Nothing owing. 🎉'}</p>
            </div>
          </>
        )
      )}

      {tab === 'Appointments' && (
        appts === null ? <p>Loading…</p> : appts.length === 0 ? <div style={card}><p style={{ opacity: 0.7 }}>No appointments on file yet.</p></div> :
        appts.map((b) => (
          <div key={b.id} style={card}>
            <strong>{new Date(b.start).toLocaleString()}</strong>
            <p style={{ margin: '4px 0', fontSize: 13 }}>Status: {b.status}{b.notes ? ` · ${b.notes}` : ''}</p>
          </div>
        ))
      )}

      {tab === 'Invoices & payments' && (
        <>
          <div style={card}><strong>Invoices</strong>
            {invoices === null ? <p>Loading…</p> : invoices.length === 0 ? <p style={{ opacity: 0.7, fontSize: 14 }}>No invoices yet.</p> :
              invoices.map((i: any) => <p key={i.id} style={{ fontSize: 14 }}>{i.title ?? 'Invoice'} — {money(Number(i.amount ?? 0))} · {i.status}</p>)}
          </div>
          <div style={card}><strong>Payment history</strong>
            {payments === null ? <p>Loading…</p> : payments.length === 0 ? <p style={{ opacity: 0.7, fontSize: 14 }}>No payments yet.</p> :
              payments.map((p: any) => <p key={p.id} style={{ fontSize: 14 }}>{money(Number(p.amount))} · {p.status} · {new Date(p.createdAt).toLocaleDateString()}</p>)}
          </div>
        </>
      )}

      {tab === 'Messages' && (
        <div style={card}>
          {messages === null ? <p>Loading…</p> : messages === false ? <p>Could not load messages.</p> : (
            <>
              <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(Array.isArray(messages) ? messages.flatMap((c: any) => c.messages ?? []) : []).length === 0 && <p style={{ opacity: 0.7 }}>No messages yet — say hello below.</p>}
                {(Array.isArray(messages) ? messages.flatMap((c: any) => c.messages ?? []) : []).map((m: any) => (
                  <p key={m.id} style={{ fontSize: 14, margin: 0, alignSelf: m.direction === 'INBOUND' ? 'flex-end' : 'flex-start', background: m.direction === 'INBOUND' ? `${gold}22` : 'rgba(128,128,128,0.12)', padding: '6px 10px', borderRadius: 8, maxWidth: '80%' }}>{m.body}</p>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #666', background: 'transparent', color: 'inherit' }} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Write a message…" />
                <button onClick={sendMessage} disabled={!msg.trim()} style={{ padding: '10px 16px', borderRadius: 8, background: gold, color: '#0a0a0a', border: 0, fontWeight: 700, cursor: 'pointer' }}>Send</button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'Documents' && (
        docs === null ? <p>Loading…</p> : docs.length === 0 ? <div style={card}><p style={{ opacity: 0.7 }}>No documents yet.</p></div> :
        docs.map((d: any) => (
          <div key={d.id} style={card}>
            <strong>{d.title}</strong>
            <p style={{ fontSize: 13, margin: '4px 0' }}>{d.type} · {d.status}{d.amount != null ? ` · ${money(Number(d.amount))}` : ''}</p>
          </div>
        ))
      )}

      {tab === 'Profile' && (
        profile === null ? <p>Loading…</p> : profile === false ? <p>Could not load your profile.</p> : (
          <div style={card}>
            <strong>{profile.name}</strong>
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              <input defaultValue={profile.phone ?? ''} placeholder="Phone" id="pp-phone" style={{ padding: 10, borderRadius: 8, border: '1px solid #666', background: 'transparent', color: 'inherit' }} />
              <input defaultValue={profile.email ?? ''} placeholder="Email" id="pp-email" style={{ padding: 10, borderRadius: 8, border: '1px solid #666', background: 'transparent', color: 'inherit' }} />
              <button onClick={async () => {
                const phone = (document.getElementById('pp-phone') as HTMLInputElement).value;
                const email = (document.getElementById('pp-email') as HTMLInputElement).value;
                try { await preq('/portal/profile', { method: 'PATCH', body: JSON.stringify({ phone, email }) }); loadTab('Profile'); } catch {}
              }} style={{ padding: 10, borderRadius: 8, background: gold, color: '#0a0a0a', border: 0, fontWeight: 700, cursor: 'pointer' }}>Save</button>
            </div>
          </div>
        )
      )}
      <footer style={{ textAlign: 'center', fontSize: 11, opacity: 0.5, padding: 16 }}>Powered by SOFILIC</footer>
    </main>
  );
}
