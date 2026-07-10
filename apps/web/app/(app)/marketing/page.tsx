'use client';
import { useState } from 'react';

const TABS = ['Campaigns', 'Sequences', 'Templates', 'Reputation'] as const;
type Tab = (typeof TABS)[number];

const CHANNELS = ['Google Business Profile', 'Facebook Page', 'Instagram Business'];

export default function MarketingPage() {
  const [tab, setTab] = useState<Tab>('Campaigns');

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Marketing</h2>
          <span className="muted">Campaigns, sequences and reputation — powered by your real business activity</span>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Campaigns' && (
        <div className="panel empty-state" style={{ padding: '56px 24px' }}>
          <div className="e-ico" style={{ width: 56, height: 56, fontSize: 26 }}>◬</div>
          <h4 style={{ fontSize: 16 }}>Create your first campaign</h4>
          <p>Send an email or SMS campaign to a segment of your contacts.</p>
        </div>
      )}

      {tab === 'Sequences' && (
        <div className="panel empty-state" style={{ padding: '56px 24px' }}>
          <div className="e-ico" style={{ width: 56, height: 56, fontSize: 26 }}>⟳</div>
          <h4 style={{ fontSize: 16 }}>No sequences yet</h4>
          <p>Build a multi-step nurture sequence that sends automatically as contacts move through your pipeline.</p>
        </div>
      )}

      {tab === 'Templates' && (
        <div className="panel empty-state" style={{ padding: '56px 24px' }}>
          <div className="e-ico" style={{ width: 56, height: 56, fontSize: 26 }}>▤</div>
          <h4 style={{ fontSize: 16 }}>No templates yet</h4>
          <p>Save reusable email and SMS templates for the messages you send most often.</p>
        </div>
      )}

      {tab === 'Reputation' && (
        <div className="grid-2">
          <div className="panel" style={{ gridColumn: '1 / -1' }}>
            <h3>Reviews</h3>
            <div className="empty-state" style={{ padding: '40px 16px' }}>
              <div className="e-ico">★</div>
              <h4>No reviews connected yet</h4>
              <p>Connect Google or Facebook below to bring reviews in and reply with AI-drafted responses.</p>
            </div>
          </div>
          <div className="panel">
            <h3>Connected sources</h3>
            {CHANNELS.slice(0, 2).map((c) => (
              <div className="agent-row" key={c}>
                <span style={{ flex: 1 }}>{c}</span>
                <button className="btn ghost sm">Connect</button>
              </div>
            ))}
          </div>
          <div className="panel">
            <h3>Review requests</h3>
            <div className="empty-state" style={{ padding: '24px 16px' }}>
              <div className="e-ico" style={{ width: 40, height: 40, fontSize: 18 }}>⟳</div>
              <h4 style={{ fontSize: 13.5 }}>No requests sent yet</h4>
              <p style={{ fontSize: 12.5 }}>Review requests send automatically after a job or visit is marked complete.</p>
            </div>
          </div>
        </div>
      )}

      {tab !== 'Reputation' && (
        <div className="panel" style={{ marginTop: 16 }}>
          <h3>Channels</h3>
          {CHANNELS.map((c) => (
            <div className="agent-row" key={c}>
              <span style={{ flex: 1 }}>{c}</span>
              <button className="btn ghost sm">Connect</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
