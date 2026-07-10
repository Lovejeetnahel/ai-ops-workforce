'use client';
import { useState } from 'react';

const TABS = ['Sites', 'Blog', 'Funnels', 'Forms', 'Domains', 'Widgets'] as const;
type Tab = (typeof TABS)[number];

const COPY: Record<Tab, { icon: string; title: string; body: string }> = {
  Sites: { icon: '▣', title: 'Build your first website', body: 'Generate a site from your business profile and Brand Kit, then customize it with the page builder.' },
  Blog: { icon: '▤', title: 'Publish your first post', body: 'Blog posts share the same page builder and SEO tools as the rest of your site.' },
  Funnels: { icon: '▲', title: 'No funnels yet', body: 'Build a multi-step landing page flow to capture and convert leads.' },
  Forms: { icon: '◈', title: 'No forms yet', body: 'Build a form to capture leads on your website, a funnel, or standalone.' },
  Domains: { icon: '◎', title: 'No custom domain connected', body: 'Point your own domain at your Sofilic site once it’s ready to publish.' },
  Widgets: { icon: '⬡', title: 'No widgets added', body: 'Add a booking, chat or review widget to any page on your site.' },
};

export default function WebsitesPage() {
  const [tab, setTab] = useState<Tab>('Sites');
  const c = COPY[tab];

  return (
    <>
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>Websites</h2>
          <span className="muted">Your site, blog, funnels and forms, all in one builder</span>
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
