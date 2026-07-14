import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Sofilic',
  description: 'Reach the Sofilic team with a question about sales, support or security.',
  alternates: { canonical: 'https://sofilic.com/contact' },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
