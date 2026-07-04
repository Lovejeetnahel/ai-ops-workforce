'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SidebarNav } from '../../components/Sidebar';
import { SofilicMark } from '../../components/Logo';

/** SOFILIC OS shell: desktop sidebar, OS top header, mobile drawer. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    try {
      const u = JSON.parse(window.localStorage.getItem('aiow_user') ?? 'null');
      if (u?.name) setUserName(String(u.name).split(' ')[0]);
      else if (u?.email) setUserName(String(u.email).split('@')[0]);
    } catch {}
  }, []);

  return (
    <>
      <div className="mobilebar">
        <Link href="/" className="brand" style={{ gap: 8, textDecoration: 'none' }}>
          <SofilicMark size={28} />
          <span className="sofilic-name" style={{ fontSize: 13 }}>SOFILIC</span>
        </Link>
        <button className="hamburger" onClick={() => setDrawer(true)} aria-label="Open menu">☰</button>
      </div>

      {drawer && (
        <>
          <div className="drawer-overlay" onClick={() => setDrawer(false)} />
          <div className="drawer">
            <SidebarNav onNavigate={() => setDrawer(false)} />
          </div>
        </>
      )}

      <div className="app">
        <SidebarNav />
        <div className="main">
          <div className="os-topbar">
            <div className="os-greeting">
              <h2>Welcome back{userName ? `, ${userName}` : ''} 👋</h2>
              <span className="muted">Sofilic OS · AI Command Center · Executive Briefing</span>
            </div>
            <div className="os-actions">
              <Link href="/executive" className="btn ghost sm">Executive Briefing</Link>
              <Link href="/dashboard" className="btn sm">Command Center</Link>
            </div>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}
