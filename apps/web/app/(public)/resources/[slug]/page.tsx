import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { GUIDES, getGuide } from '../../../../lib/guides';

/** Real product guides — statically generated, one per slug in lib/guides.ts. */

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const guide = getGuide(params.slug);
  if (!guide) return {};
  return {
    title: `${guide.title} — Sofilic Guides`,
    description: guide.description,
    alternates: { canonical: `https://sofilic.com/resources/${guide.slug}` },
  };
}

export default function GuidePage({ params }: { params: { slug: string } }) {
  const guide = getGuide(params.slug);
  if (!guide) notFound();

  return (
    <main className="mk-main">
      <article className="legal-doc">
        <p className="updated">
          <Link href="/resources" style={{ color: 'var(--cyan)' }}>← All resources</Link>
        </p>
        <h1>{guide.icon} {guide.title}</h1>
        <p>{guide.description}</p>
        {guide.sections.map((s) => (
          <section key={s.h}>
            <h2>{s.h}</h2>
            {s.paragraphs?.map((p, i) => <p key={i}>{p}</p>)}
            {s.bullets && (
              <ul>
                {s.bullets.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            )}
          </section>
        ))}
        <section>
          <h2>Still stuck?</h2>
          <p>
            <Link href="/support" style={{ color: 'var(--cyan)' }}>Support</Link> and the{' '}
            <Link href="/contact" style={{ color: 'var(--cyan)' }}>contact form</Link> reach a human.
          </p>
        </section>
      </article>
    </main>
  );
}
