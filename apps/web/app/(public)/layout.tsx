'use client';
import Link from 'next/link';
import { useState } from 'react';

const NAV = [
  { href: '/features', label: 'Features' },
  { href: '/industries', label: 'Industries' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/demo', label: 'Demo' },
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="mk-header">
        <Link href="/" className="brand">
          <span className="brand-mark">⚡</span>
          <span>
            <span className="brand-name">AI Operations Workforce</span>
            <br />
            <span className="brand-sub">AI Business OS</span>
          </span>
        </Link>
        <nav className="mk-nav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}>{n.label}</Link>
          ))}
        </nav>
        <div className="mk-cta">
          <Link href="/login" className="btn ghost sm" style={{ display: 'inline-block' }}>Login</Link>
          <Link href="/signup" className="btn sm">Start Free Demo</Link>
          <button className="mk-menu-btn" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
        </div>
      </header>
      <div className={`mk-mobile-nav ${open ? 'open' : ''}`}>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} onClick={() => setOpen(false)}>{n.label}</Link>
        ))}
        <Link href="/login" onClick={() => setOpen(false)}>Login</Link>
        <Link href="/signup" onClick={() => setOpen(false)}>Start Free Demo</Link>
      </div>

      {children}

      <footer className="mk-footer">
        <div>
          <strong style={{ color: 'var(--text)' }}>⚡ AI Operations Workforce</strong>
          <div style={{ marginTop: 6 }}>The AI Business OS for service industries.</div>
        </div>
        <div>
          <Link href="/features">Features</Link>
          <Link href="/industries">Industries</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/demo">Demo</Link>
          <Link href="/login">Login</Link>
        </div>
        <div>© {new Date().getFullYear()} AI Operations Workforce. All rights reserved.</div>
      </footer>
    </>
  );
}
