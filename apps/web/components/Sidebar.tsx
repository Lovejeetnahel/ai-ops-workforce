'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const LINKS = [
  { href: '/dashboard', label: 'Pipeline' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/executive', label: 'Executive' },
  { href: '/workforce', label: 'AI Workforce' },
  { href: '/automations', label: 'Automations' },
  { href: '/jobs', label: 'My Jobs (Staff)' },
  { href: '/portal', label: 'Customer Portal' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/billing', label: 'Billing' },
  { href: '/settings', label: 'Settings' },
];

/** Shared shell nav + light/dark toggle. The nav spans every role surface. */
export function Sidebar() {
  const path = usePathname();
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const saved = window.localStorage.getItem('aiow_theme') ?? 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    window.localStorage.setItem('aiow_theme', next);
  };

  return (
    <aside className="sidebar">
      <h1>⚡ AI Ops Workforce</h1>
      <p className="muted" style={{ marginTop: 4, fontSize: 12 }}>Version 1.0</p>
      <nav className="nav" style={{ marginTop: 18 }}>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={path === l.href ? 'active' : ''}>
            {l.label}
          </Link>
        ))}
      </nav>
      <button className="theme-toggle" onClick={toggle}>
        {theme === 'dark' ? '☀ Light mode' : '🌙 Dark mode'}
      </button>
    </aside>
  );
}
