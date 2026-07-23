import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In to Sofilic',
  description: 'Sign in to your Sofilic account.',
  alternates: { canonical: 'https://sofilic.com/login' },
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
