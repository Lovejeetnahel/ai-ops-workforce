'use client';
import { useEffect, useState } from 'react';

const TABS = ['Agents', 'Phone numbers', 'Knowledge', 'Scripts', 'Campaigns', 'Live calls', 'Recordings', 'Analytics'] as const;
type Tab = (typeof TABS)[number];

const SETUP_COPY: Record<Exclude<Tab, 'Agents'>, { icon: string; title: string; body: string }> = {
  'Phone numbers': { icon: '◎', title: 'Connect a phone number', body: 'Bring your existing business line or get a new number to let Voice AI start answering calls.' },
  Knowledge: { icon: '✦', title: 'Build your Knowledge base', body: 'Upload your services, pricing and common questions so Voice AI can answer callers accurately.' },
  Scripts: { icon: '▤', title: 'Write your first script', body: 'Define how Voice AI greets callers, qualifies leads and books appointments.' },
  Campaigns: { icon: '⟳', title: 'No campaigns yet', body: 'Set up reminder, confirmation or reactivation calls that Voice AI places automatically.' },
  'Live calls': { icon: '◔', title: 'No calls in progress', body: 'Calls Voice AI is actively handling will appear here in real time.' },
  Recordings: { icon: '▭', title: 'No recordings yet', body: 'Call recordings and transcripts will appear here once Voice AI starts taking calls.' },
  Analytics: { icon: '∿', title: 'Analytics will appear here', body: 'Call volume, booking rate and containment will show up once Voice AI is live.' },
};

export default function VoiceAiPage() {
  const [tab, setTab] = useState<Tab>('Agents');
  const [employees, setEmployees] = useState<any[] | null>(null);

  useEffect(() => {
    import('../../../lib/api').then(({ api }) =>
      api.employees().then((e) => setEmployees(e ?? [])).catch(() => setEmployees([])),
    );
  }, []);

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Voice AI</h2>
          <span className="muted">Your AI phone agent — setup, scripts, campaigns and analytics</span>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Agents' ? (
        <div className="panel">
          {employees === null ? (
            <div className="skeleton" style={{ height: 120 }} />
          ) : employees.length === 0 ? (
            <div className="empty-state">
              <div className="e-ico">◎</div>
              <h4>No AI agents installed</h4>
              <p>Install an AI receptionist or sales agent from the Marketplace to start answering calls automatically.</p>
            </div>
          ) : (
            <div className="grid">
              {employees.map((e: any) => (
                <div className="card" key={e.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="name">{e.name}</span>
                    <span className={`chip ${e.installation?.enabled ? 'ok' : 'warn'}`}>{e.installation?.enabled ? 'Active' : 'Off'}</span>
                  </div>
                  <div className="meta">{e.department}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="panel empty-state" style={{ padding: '56px 24px' }}>
          <div className="e-ico" style={{ width: 56, height: 56, fontSize: 26 }}>{SETUP_COPY[tab].icon}</div>
          <h4 style={{ fontSize: 16 }}>{SETUP_COPY[tab].title}</h4>
          <p>{SETUP_COPY[tab].body}</p>
        </div>
      )}
    </>
  );
}
