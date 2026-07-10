'use client';
import { useState } from 'react';

const TABS = ['Composer', 'Calendar', 'Brand Kit', 'Media Library', 'Analytics'] as const;
type Tab = (typeof TABS)[number];

const PLATFORMS = ['Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'YouTube', 'Google Business Profile'];

export default function SocialPage() {
  const [tab, setTab] = useState<Tab>('Composer');

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Social Media</h2>
          <span className="muted">Post, schedule and grow across every channel</span>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === 'Composer' && (
        <div className="panel empty-state" style={{ padding: '56px 24px' }}>
          <div className="e-ico" style={{ width: 56, height: 56, fontSize: 26 }}>⬡</div>
          <h4 style={{ fontSize: 16 }}>Create your first social post</h4>
          <p>Connect a channel below, then write a post or let AI draft one from a recent job or review.</p>
        </div>
      )}

      {tab === 'Calendar' && (
        <div className="panel empty-state" style={{ padding: '56px 24px' }}>
          <div className="e-ico" style={{ width: 56, height: 56, fontSize: 26 }}>▤</div>
          <h4 style={{ fontSize: 16 }}>No posts scheduled</h4>
          <p>Scheduled and drafted posts will appear on your content calendar here.</p>
        </div>
      )}

      {tab === 'Brand Kit' && (
        <div className="panel empty-state" style={{ padding: '56px 24px' }}>
          <div className="e-ico" style={{ width: 56, height: 56, fontSize: 26 }}>◈</div>
          <h4 style={{ fontSize: 16 }}>Set up your Brand Kit</h4>
          <p>Add your logo, colors and fonts so every post, page and document looks consistently on-brand.</p>
        </div>
      )}

      {tab === 'Media Library' && (
        <div className="panel empty-state" style={{ padding: '56px 24px' }}>
          <div className="e-ico" style={{ width: 56, height: 56, fontSize: 26 }}>▣</div>
          <h4 style={{ fontSize: 16 }}>No media yet</h4>
          <p>Photos and videos from completed jobs and uploads will live here, ready to use in posts.</p>
        </div>
      )}

      {tab === 'Analytics' && (
        <div className="panel empty-state" style={{ padding: '56px 24px' }}>
          <div className="e-ico" style={{ width: 56, height: 56, fontSize: 26 }}>∿</div>
          <h4 style={{ fontSize: 16 }}>Analytics will appear here</h4>
          <p>Engagement and reach per platform will show up once you connect a channel and publish posts.</p>
        </div>
      )}

      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Connected accounts</h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {PLATFORMS.map((p) => (
            <div className="agent-row" key={p}>
              <span style={{ flex: 1 }}>{p}</span>
              <button className="btn ghost sm">Connect</button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
