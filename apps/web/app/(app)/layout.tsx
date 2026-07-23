import type { Metadata } from 'next';
import AppShell from './AppShell';

/** Authenticated application routes must never be indexed. Search engines are
 * additionally blocked by robots.ts, but the meta tag covers pages reached
 * through direct links. The interactive shell itself lives in AppShell.tsx
 * (client component) — this server wrapper only owns metadata. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
