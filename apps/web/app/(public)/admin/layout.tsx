import type { Metadata } from 'next';

/** Operator-only pages: never indexed, never linked from the public site. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
