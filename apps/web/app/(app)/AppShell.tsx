'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isAuthed } from '../../lib/api';
import { SidebarNav } from '../../components/Sidebar';
import { SofilicMark } from '../../components/Logo';
import { AccountSwitcher } from '../../components/AccountSwitcher';
import { UserMenu } from '../../components/UserMenu';
import { NotificationsMenu } from '../../components/NotificationsMenu';
import { CommandPalette } from '../../components/CommandPalette';

const PAGE_TITLES: Record<string, string> = {
  '/onboarding': 'Getting Started',
  '/dashboard': 'Dashboard',
  '/ai-workforce': 'AI Workforce',
  '/crm': 'CRM',
  '/sales': 'Sales',
  '/conversations': 'Conversations',
  '/voice-ai': 'Voice AI',
  '/marketing': 'Marketing',
  '/social': 'Social Media',
  '/websites': 'Websites',
  '/seo': 'SEO',
  '/automation': 'Automation',
  '/payments': 'Payments',
  '/apps': 'Apps',
  '/settings': 'Settings',
};

/** SOFILIC OS shell: desktop sidebar, top header (title, switcher, search,
 * notifications, profile), mobile drawer. Used by all 13 approved modules.
 * Client component — the (app) layout.tsx server wrapper owns metadata
 * (noindex) and renders this shell unchanged. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  // null = auth not yet checked (render nothing — never expose the app shell
  // to logged-out visitors), true = render, redirect fired otherwise.
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isAuthed()) {
      // `next` is only ever the CURRENT pathname (always an internal,
      // single-slash route), so this cannot become an open redirect; /login
      // itself lives outside this layout, so no redirect loop is possible.
      const next = path && path.startsWith('/') && !path.startsWith('//') ? path : '/dashboard';
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    setAuthed(true);
  }, [path, router]);

  useEffect(() => {
    try {
      const u = JSON.parse(window.localStorage.getItem('aiow_user') ?? 'null');
      if (u?.name) setUserName(String(u.name).split(' ')[0]);
      else if (u?.email) setUserName(String(u.email).split('@')[0]);
    } catch {}
    const savedCollapse = window.localStorage.getItem('aiow_sidebar_collapsed');
    if (savedCollapse === '1') setCollapsed(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      window.localStorage.setItem('aiow_sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  };

  const title = PAGE_TITLES[path] ?? 'Sofilic';

  // Auth unresolved or redirecting: render nothing rather than an app shell.
  if (authed !== true) return null;

  return (
    <>
      <div className="mobilebar">
        <Link href="/" className="brand" style={{ gap: 8, textDecoration: 'none' }}>
          <SofilicMark size={28} />
          <span className="sofilic-name" style={{ fontSize: 13 }}>SOFILIC</span>
        </Link>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <NotificationsMenu />
          <button className="hamburger" onClick={() => setDrawer(true)} aria-label="Open menu">☰</button>
        </div>
      </div>

      {drawer && (
        <>
          <div className="drawer-overlay" onClick={() => setDrawer(false)} />
          <div className="drawer">
            <SidebarNav onNavigate={() => setDrawer(false)} />
          </div>
        </>
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      <div className={collapsed ? 'app collapsed' : 'app'}>
        <SidebarNav collapsed={collapsed} onToggleCollapse={toggleCollapse} />
        <div className="main">
          <div className="os-topbar">
            <div className="os-greeting">
              <div className="shell-title-row">
                <h2>{userName ? `Welcome back, ${userName}` : title} 👋</h2>
              </div>
              <div className="breadcrumb">
                <span>Sofilic</span>
                <span className="sep">/</span>
                <span className="current">{title}</span>
              </div>
            </div>
            <div className="os-actions">
              <AccountSwitcher />
              <button type="button" className="search-trigger" onClick={() => setPaletteOpen(true)}>
                🔎 <span className="search-label">Search…</span>
                <kbd>⌘K</kbd>
              </button>
              <NotificationsMenu />
              <UserMenu />
            </div>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}
