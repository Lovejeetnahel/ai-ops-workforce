import './globals.css';
import type { Metadata } from 'next';
import { ToastProvider } from '../components/Toast';

export const metadata: Metadata = {
  title: 'Sofilic — The AI Business Operating System',
  description:
    'Run your entire business with AI. Leads, dispatch, field teams, customer portal, invoices, payments, analytics, AI employees, workflows and marketplace apps — one operating system.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
