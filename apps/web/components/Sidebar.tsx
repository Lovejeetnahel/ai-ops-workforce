'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, isAuthed, logout } from '../lib/api';
import { SofilicLogo } from './Logo';

type NavItem = { href: string; label: string; ico: string };
type NavSection = { title?: string; links: NavItem[] };

/**
 * SOFILIC 2.0 — frozen Rev-2 navigation (Product Constitution Rule 4: no new
 * top-level item without explicit approval). This tree is static: industries
 * customize content via presets/templates, never the sidebar shape. The only
 * per-tenant variable is the small brand subtitle under the logo.
 */
const SECTIONS: NavSection[] = [
  { links: [{ href: '/dashboard', label: 'Dashboard', ico: '⌘' }] },
  {
    title: 'CRM & Sales',
    links: [
      { href: '/crm', label: 'CRM', ico: '◈' },
      { href: '/sales', label: 'Sales', ico: '▲' },
    ],
  },
  {
    title: 'Talk to Customers',
    links: [
      { href: '/conversations', label: 'Conversations', ico: '▤' },
      { href: '/voice-ai', label: 'Voice AI', ico: '◎' },
    ],
  },
  {
    title: 'Grow & Get Found',
    links: [
      { href: '/marketing', label: 'Marketing', ico: '◬' },
      { href: '/social', label: 'Social Media', ico: '⬡' },
      { href: '/websites', label: 'Websites', ico: '▣' },
      { href: '/seo', label: 'SEO', ico: '∿' },
    ],
  },
  { links: [{ href: '/automation', label: 'Automation', ico: '⟳' }] },
  { links: [{ href: '/payments', label: 'Payments', ico: '▭' }] },
];

const PINNED: NavItem[] = [
  { href: '/apps', label: 'Apps', ico: '▦' },
  { href: '/settings', label: 'Settings', ico: '⚙' },
];

/** The nav column. Rendered in the desktop sidebar and the mobile drawer. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState('dark');
  const [authed, setAuthed] = useState(false);
  const [brandSub, setBrandSub] = useState('Business OS');

  useEffect(() => {
    const saved = window.localStorage.getItem('aiow_theme') ?? 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
    setAuthed(isAuthed());
    // Presets customize content (templates, automations, pipelines) — never
    // the nav shape. This read is display-only: the small label under the logo.
    if (isAuthed()) {
      api
        .moduleConfig()
        .then((cfg) => {
          if (cfg?.preset?.label) setBrandSub(cfg.preset.label);
        })
        .catch(() => {});
    }
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

  const renderLink = (l: NavItem) => (
    <Link key={l.href} href={l.href} className={path === l.href ? 'active' : ''} onClick={onNavigate}>
      <span className="ico">{l.ico}</span>
      {l.label}
    </Link>
  );

  return (
    <aside className="sidebar">
      <Link href="/" className="brand" style={{ textDecoration: 'none' }}>
        <SofilicLogo size={34} sub={brandSub} animated />
      </Link>
      <nav className="nav">
        {SECTIONS.map((s, i) => (
          <div key={s.title ?? i}>
            {s.title && <div className="nav-section">{s.title}</div>}
            {s.links.map(renderLink)}
          </div>
        ))}
        <div className="nav-section">&nbsp;</div>
        {PINNED.map(renderLink)}
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
