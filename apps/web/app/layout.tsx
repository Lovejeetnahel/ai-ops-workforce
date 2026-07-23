import './globals.css';
import type { Metadata } from 'next';
import { ToastProvider } from '../components/Toast';

export const metadata: Metadata = {
  metadataBase: new URL('https://sofilic.com'),
  title: 'Sofilic — The AI Business Operating System',
  description: 'CRM, sales, automation, payments and field operations for local service businesses — with an AI workforce rolling out feature by feature.',
  // Site-wide Open Graph defaults; per-page title/description are inherited
  // automatically. No og:image is set because no real social card asset
  // exists yet — better absent than a broken or fabricated one.
  openGraph: {
    siteName: 'Sofilic',
    type: 'website',
    locale: 'en_US',
  },
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
