'use client';
import Link from 'next/link';
import { useState } from 'react';
import { SidebarNav } from '../../components/Sidebar';

/** Authenticated app shell: desktop sidebar + mobile top bar with drawer. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [drawer, setDrawer] = useState(false);

  return (
    <>
      <div className="mobilebar">
        <Link href="/" className="brand" style={{ gap: 8 }}>
          <span className="brand-mark" style={{ width: 28, height: 28, fontSize: 14 }}>⚡</span>
          <span className="brand-name">AI Ops Workforce</span>
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
        <div className="main">{children}</div>
      </div>
    </>
  );
}
