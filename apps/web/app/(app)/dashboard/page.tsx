'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PipelineBoard } from '../../../components/PipelineBoard';
import { AgentActivity } from '../../../components/AgentActivity';
import { api } from '../../../lib/api';

const KPIS_FALLBACK = [
  { label: "Today's revenue", value: '$4,820', delta: '+18% vs yesterday', up: true },
  { label: 'New leads', value: '12', delta: '+4 today', up: true },
  { label: 'Booked jobs', value: '8', delta: '6 auto-booked by AI', up: true },
  { label: 'Completed jobs', value: '5', delta: 'on schedule', up: true },
  { label: 'Urgent issues', value: '1', delta: 'emergency dispatch active', up: false },
  { label: 'AI employees active', value: '8', delta: '27 actions today', up: true },
];

const DISPATCH = [
  { tech: 'Tina Tech', zone: 'Eastside', job: 'Emergency A/C repair', status: 'En route', chip: 'warn' },
  { tech: 'Marco V.', zone: 'Downtown', job: 'Water heater replacement', status: 'On site', chip: 'ok' },
  { tech: 'Dee Patel', zone: 'Westside', job: 'Furnace tune-up', status: 'Scheduled 3:30 PM', chip: 'ok' },
];

const FIELD_STATUS = [
  { name: 'Tina Tech', state: 'Driving · ETA 12 min', chip: 'warn' },
  { name: 'Marco V.', state: 'Clocked in · on job 42 min', chip: 'ok' },
  { name: 'Dee Patel', state: 'Available · next job 3:30 PM', chip: 'ok' },
  { name: 'Sam Ortiz', state: 'On break', chip: 'err' },
];

const PORTAL_ACTIVITY = [
  { who: 'Jordan M.', what: 'Viewed invoice #4821 and opened pay link', when: '6m ago' },
  { who: 'Priya K.', what: 'Confirmed tomorrow’s 10:30 AM appointment', when: '31m ago' },
  { who: 'Sam R.', what: 'Left a ★★★★★ review after furnace tune-up', when: '1h ago' },
];

const INVOICE_SUMMARY = [
  { label: 'Outstanding', value: '$3,140', sub: '4 invoices' },
  { label: 'Paid this week', value: '$12,470', sub: '11 invoices' },
  { label: 'Overdue', value: '$480', sub: '1 invoice · Collections AI chasing' },
];

const AUTOMATION_HEALTH = [
  { name: 'Missed-call text-back', runs: 14, ok: 14 },
  { name: 'Emergency fast-track', runs: 2, ok: 2 },
  { name: 'Review requests', runs: 5, ok: 5 },
  { name: 'Re-engagement emails', runs: 30, ok: 29 },
];

const EXEC_RECS = [
  'Follow up the $1,900 water-heater quote for Priya K. — it expires Friday.',
  'One invoice is 12 days overdue; Collections AI has sent 2 reminders — consider a call.',
  'Eastside emergency volume is up 40% this week — consider adding on-call capacity.',
];

const NOTIFS = [
  { t: 'Payment received', d: '$240 from Jordan M. (invoice #4821)', when: '4m ago' },
  { t: 'Job completed', d: 'Furnace tune-up — Sam R.', when: '1h ago' },
  { t: 'New lead', d: 'Web chat — water heater replacement', when: '2h ago' },
];

const UPCOMING = [
  { when: 'Today 3:30 PM', what: 'Furnace tune-up — Dee Patel → Sam R. (Westside)' },
  { when: 'Tomorrow 9:00 AM', what: 'Duct inspection — Marco V. → Lena W. (Downtown)' },
  { when: 'Tomorrow 10:30 AM', what: 'Water heater install — Tina Tech → Priya K.' },
];

const MARKET_RECS = [
  { name: 'Collections AI', why: 'You have 1 overdue invoice — automate the chase.', price: '$49/mo' },
  { name: 'QuickBooks Sync', why: 'Sync 11 paid invoices to accounting automatically.', price: '$29/mo' },
];

export default function CommandCenter() {
  const [briefing, setBriefing] = useState<string | null>(null);
  const [tenantBadge, setTenantBadge] = useState('Acme HVAC & Plumbing · Field Services');

  useEffect(() => {
    api.briefing().then((b) => { if (b?.briefing) setBriefing(b.briefing); }).catch(() => {});
    try {
      const u = JSON.parse(window.localStorage.getItem('aiow_user') ?? 'null');
      if (u?.tenant?.name) setTenantBadge(u.tenant.name);
    } catch {}
  }, []);

  return (
    <>
      {/* Command center hero */}
      <div
        className="panel glow"
        style={{ marginBottom: 20, background: 'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(34,211,238,0.05))' }}
      >
        <div className="topbar" style={{ marginBottom: 8 }}>
          <div>
            <h2 style={{ margin: 0 }}>⚡ AI Command Center</h2>
            <span className="muted">
              {briefing
                ? briefing.split('\n')[0]
                : 'Your AI workforce handled 27 interactions today — 8 jobs booked, $4,820 collected, 1 emergency dispatched.'}
            </span>
          </div>
          <span className="badge">{tenantBadge}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="chip ok">● All systems operational</span>
          <span className="chip ok">8 AI employees active</span>
          <span className="chip warn">1 emergency in progress</span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid-kpi" style={{ marginBottom: 20 }}>
        {KPIS_FALLBACK.map((k) => (
          <div className="panel" key={k.label}>
            <div className="muted">{k.label}</div>
            <div className="kpi">{k.value}</div>
            <div className={`kpi-delta ${k.up ? 'up' : 'down'}`}>{k.delta}</div>
          </div>
        ))}
      </div>

      {/* Live pipeline */}
      <h3 style={{ margin: '4px 0 12px' }}>Live operations pipeline</h3>
      <PipelineBoard />

      {/* Activity + dispatch */}
      <div className="grid-2" style={{ marginTop: 20 }}>
        <AgentActivity />
        <div className="panel">
          <h3>🚚 Dispatch board</h3>
          {DISPATCH.map((d) => (
            <div className="agent-row" key={d.tech}>
              <span className="agent-pill">{d.tech}</span>
              <span style={{ flex: 1 }}>{d.job} <span className="muted">· {d.zone}</span></span>
              <span className={`chip ${d.chip}`}>{d.status}</span>
            </div>
          ))}
          <Link href="/dispatch" className="btn ghost sm" style={{ marginTop: 12 }}>Open dispatch →</Link>
        </div>
      </div>

      {/* Field team + portal activity */}
      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="panel">
          <h3>📱 Field team status</h3>
          {FIELD_STATUS.map((f) => (
            <div className="agent-row" key={f.name}>
              <span style={{ flex: 1 }}><strong>{f.name}</strong></span>
              <span className="muted" style={{ flex: 2 }}>{f.state}</span>
              <span className={`chip ${f.chip}`}>●</span>
            </div>
          ))}
        </div>
        <div className="panel">
          <h3>🏡 Customer portal activity</h3>
          {PORTAL_ACTIVITY.map((p) => (
            <div className="agent-row" key={p.who}>
              <span className="agent-pill">{p.who}</span>
              <span style={{ flex: 1 }}>{p.what}</span>
              <span className="muted">{p.when}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Invoices + automation health */}
      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="panel">
          <h3>🧾 Invoices & payments</h3>
          <div className="grid-kpi">
            {INVOICE_SUMMARY.map((i) => (
              <div key={i.label}>
                <div className="muted">{i.label}</div>
                <div className="kpi" style={{ fontSize: 22 }}>{i.value}</div>
                <div className="muted" style={{ fontSize: 12 }}>{i.sub}</div>
              </div>
            ))}
          </div>
          <Link href="/revenue" className="btn ghost sm" style={{ marginTop: 14 }}>Open revenue →</Link>
        </div>
        <div className="panel">
          <h3>⚙️ Automation health</h3>
          {AUTOMATION_HEALTH.map((a) => (
            <div className="agent-row" key={a.name}>
              <span style={{ flex: 1 }}>{a.name}</span>
              <span className="muted">{a.runs} runs today</span>
              <span className={`chip ${a.ok === a.runs ? 'ok' : 'warn'}`}>
                {a.ok === a.runs ? '100%' : `${Math.round((a.ok / a.runs) * 100)}%`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Exec recommendations + notifications */}
      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="panel glow">
          <h3>🧠 Executive recommendations</h3>
          {EXEC_RECS.map((r, i) => (
            <div className="agent-row" key={i}>
              <span className="agent-pill">{i + 1}</span>
              <span>{r}</span>
            </div>
          ))}
          <Link href="/executive" className="btn ghost sm" style={{ marginTop: 12 }}>Full briefing →</Link>
        </div>
        <div className="panel">
          <h3>🔔 Recent notifications</h3>
          {NOTIFS.map((n) => (
            <div className="agent-row" key={n.t}>
              <span style={{ flex: 1 }}><strong>{n.t}</strong> — <span className="muted">{n.d}</span></span>
              <span className="muted">{n.when}</span>
            </div>
          ))}
          <Link href="/notifications" className="btn ghost sm" style={{ marginTop: 12 }}>All notifications →</Link>
        </div>
      </div>

      {/* Upcoming + marketplace recs */}
      <div className="grid-2" style={{ marginTop: 16, marginBottom: 8 }}>
        <div className="panel">
          <h3>📅 Upcoming jobs</h3>
          {UPCOMING.map((u) => (
            <div className="agent-row" key={u.when}>
              <span className="agent-pill">{u.when}</span>
              <span>{u.what}</span>
            </div>
          ))}
        </div>
        <div className="panel">
          <h3>🧩 Recommended from marketplace</h3>
          {MARKET_RECS.map((m) => (
            <div className="agent-row" key={m.name}>
              <span style={{ flex: 1 }}><strong>{m.name}</strong> — <span className="muted">{m.why}</span></span>
              <span className="tag">{m.price}</span>
            </div>
          ))}
          <Link href="/marketplace" className="btn ghost sm" style={{ marginTop: 12 }}>Browse marketplace →</Link>
        </div>
      </div>
    </>
  );
}
