import './globals.css';
import type { Metadata } from 'next';
import { ToastProvider } from '../components/Toast';

export const metadata: Metadata = {
  metadataBase: new URL('https://sofilic.com'),
  title: 'Sofilic — The AI Business Operating System',
  description: 'CRM, sales, automation, payments and field operations for local service businesses — with an AI workforce rolling out feature by feature.',
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
