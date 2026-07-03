import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Operations Workforce — The AI Business OS for Service Industries',
  description:
    'Automate leads, dispatch, field teams, customer portal, invoices, payments, analytics, AI employees, workflows, and marketplace apps from one operating system.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
