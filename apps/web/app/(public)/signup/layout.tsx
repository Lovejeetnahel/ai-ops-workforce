import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create a Sofilic Account',
  description: 'Create your Sofilic workspace — pick your industry and get started, no credit card required.',
  alternates: { canonical: 'https://sofilic.com/signup' },
  robots: { index: false, follow: false },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
