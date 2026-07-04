'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isAuthed, logout } from '../lib/api';
import { SofilicLogo } from './Logo';

const SECTIONS: { title: string; links: { href: string; label: string; ico: string }[] }[] = [
  {
    title: 'Operate',
    links: [
      { href: '/dashboard', label: 'Dashboard', ico: '⌘' },
      { href: '/pipeline', label: 'Pipeline', ico: '▤' },
      { href: '/workforce', label: 'AI Workforce', ico: '✦' },
      { href: '/dispatch', label: 'Dispatch', ico: '➤' },
      { href: '/jobs', label: 'Field Team', ico: '▣' },
      { href: '/portal', label: 'Customer Portal', ico: '◉' },
    ],
  },
  {
    title: 'Grow',
    links: [
      { href: '/revenue', label: 'Revenue', ico: '◈' },
      { href: '/analytics', label: 'Analytics', ico: '∿' },
      { href: '/executive', label: 'Executive Briefing', ico: '❖' },
    ],
  },
  {
    title: 'Automate',
    links: [
      { href: '/automations', label: 'Automations', ico: '⟳' },
      { href: '/workflows', label: 'Workflows', ico: '⇶' },
      { href: '/marketplace', label: 'Marketplace', ico: '▦' },
    ],
  },
  {
    title: 'Manage',
    links: [
      { href: '/notifications', label: 'Notifications', ico: '◔' },
      { href: '/billing', label: 'Billing', ico: '▭' },
      { href: '/settings', label: 'Settings', ico: '⚙' },
    ],
  },
];

/** The nav column. Rendered in the desktop sidebar and the mobile drawer. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState('dark');
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem('aiow_theme') ?? 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
    setAuthed(isAuthed());
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    window.localStorage.setItem('aiow_theme', next);
  };

  const signOut = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside className="sidebar">
      <Link href="/" className="brand" style={{ textDecoration: 'none' }}>
        <SofilicLogo size={34} sub="Sofilic OS" animated />
      </Link>
      <nav className="nav">
        {SECTIONS.map((s) => (
          <div key={s.title}>
            <div className="nav-section">{s.title}</div>
            {s.links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={path === l.href ? 'active' : ''}
                onClick={onNavigate}
              >
                <span className="ico">{l.ico}</span>
                {l.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <button className="theme-toggle" onClick={toggle}>
        {theme === 'dark' ? '☀ Light mode' : '🌙 Dark mode'}
      </button>
      {authed ? (
        <button className="theme-toggle" onClick={signOut} style={{ marginTop: 8 }}>
          ↩ Sign out
        </button>
      ) : (
        <Link
          href="/login"
          className="theme-toggle"
          style={{ marginTop: 8, textAlign: 'center', textDecoration: 'none', display: 'block' }}
        >
          Sign in
        </Link>
      )}
    </aside>
  );
}
