import './globals.css';
import type { Metadata } from 'next';
import { Sidebar } from '../components/Sidebar';

export const metadata: Metadata = {
  title: 'AI Operations Workforce',
  description: 'Your AI receptionist, dispatcher, admin and follow-up team.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app">
          <Sidebar />
          <div className="main">{children}</div>
        </div>
      </body>
    </html>
  );
}
