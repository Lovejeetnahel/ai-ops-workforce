import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Set a New Sofilic Password',
  description: 'Choose a new password for your Sofilic account.',
  alternates: { canonical: 'https://sofilic.com/reset-password' },
  robots: { index: false, follow: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
