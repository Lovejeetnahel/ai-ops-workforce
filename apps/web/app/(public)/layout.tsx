'use client';
import Link from 'next/link';
import { useState } from 'react';
import { SofilicLogo } from '../../components/Logo';

const NAV = [
  { href: '/features', label: 'Features' },
  { href: '/industries', label: 'Industries' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/demo', label: 'Example Workflow' },
  { href: '/resources', label: 'Resources' },
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="mk-header">
        <Link href="/" style={{ textDecoration: 'none' }}>
          <SofilicLogo size={36} sub="The AI Business OS" animated />
        </Link>
        <nav className="mk-nav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}>{n.label}</Link>
          ))}
        </nav>
        <div className="mk-cta">
          <Link href="/login" className="btn ghost sm">Login</Link>
          <Link href="/signup" className="btn sm">Get Started</Link>
          <button className="mk-menu-btn" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
        </div>
      </header>
      <div className={`mk-mobile-nav ${open ? 'open' : ''}`}>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} onClick={() => setOpen(false)}>{n.label}</Link>
        ))}
        <Link href="/login" onClick={() => setOpen(false)}>Login</Link>
        <Link href="/signup" onClick={() => setOpen(false)}>Get Started</Link>
      </div>

      {children}

      <footer className="mk-footer">
        <div>
          <SofilicLogo size={30} sub="The AI Business OS" />
          <div style={{ marginTop: 12, maxWidth: 300 }}>
            One login for CRM, sales, automation, payments and field operations — with an AI workforce
            rolling out feature by feature, honestly labeled.
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 10, fontSize: 12, letterSpacing: '0.08em' }}>PRODUCT</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link href="/features">Features</Link>
            <Link href="/industries">Industries</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/demo">Example Workflow</Link>
            <Link href="/resources">Resources</Link>
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 10, fontSize: 12, letterSpacing: '0.08em' }}>COMPANY</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link href="/contact">Contact</Link>
            <Link href="/support">Support</Link>
            <Link href="/security">Security</Link>
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 10, fontSize: 12, letterSpacing: '0.08em' }}>LEGAL & ACCOUNT</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/login">Login</Link>
            <Link href="/signup">Get Started</Link>
          </div>
        </div>
        <div style={{ alignSelf: 'flex-end' }}>© {new Date().getFullYear()} Sofilic. All rights reserved.</div>
      </footer>
    </>
  );
}
