'use client';
import { useState } from 'react';

const TABS = ['Site audit', 'Keywords', 'Google Business Profile', 'Search Console', 'AI content briefs'] as const;
type Tab = (typeof TABS)[number];

const COPY: Record<Tab, { icon: string; title: string; body: string }> = {
  'Site audit': { icon: '∿', title: 'Connect a website to audit', body: 'Once your website is live, we’ll scan it for technical SEO issues and recommendations.' },
  Keywords: { icon: '◈', title: 'No keywords tracked yet', body: 'Add the search terms you want to rank for and track your position over time.' },
  'Google Business Profile': { icon: '◎', title: 'Connect Google Business Profile', body: 'Manage your local listing and pull performance data into Sofilic.' },
  'Search Console': { icon: '▤', title: 'Connect Search Console', body: 'See real search traffic and indexing status for your website.' },
  'AI content briefs': { icon: '✦', title: 'No content briefs yet', body: 'Generate an AI content brief for your next blog post, targeted at real search demand.' },
};

export default function SeoPage() {
  const [tab, setTab] = useState<Tab>('Site audit');
  const c = COPY[tab];

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>SEO</h2>
          <span className="muted">Get found — audits, keywords and content briefs</span>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <div className="panel empty-state" style={{ padding: '56px 24px' }}>
        <div className="e-ico" style={{ width: 56, height: 56, fontSize: 26 }}>{c.icon}</div>
        <h4 style={{ fontSize: 16 }}>{c.title}</h4>
        <p>{c.body}</p>
      </div>
    </>
  );
}
