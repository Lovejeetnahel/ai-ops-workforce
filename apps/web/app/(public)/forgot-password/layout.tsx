import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reset Your Sofilic Password',
  description: 'Request a password reset link for your Sofilic account.',
  alternates: { canonical: 'https://sofilic.com/forgot-password' },
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
