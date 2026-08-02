'use client';
import { useEffect, useState } from 'react';
import { SiteRenderer } from '../../../../../components/SiteRenderer';

const BASE = process.env.WEB_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Public render of a PUBLISHED tenant site page. Draft pages 404 honestly. */
export default function PublicSitePage({ params }: { params: { site: string; page: string } }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`${BASE}/api/public/sites/${params.site}/${params.page}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        setData(d);
        if (d?.page?.seo?.title) document.title = d.page.seo.title;
      })
      .catch(() => setData(false));
  }, [params.site, params.page]);

  if (data === null) return <main style={{ padding: 48, textAlign: 'center' }}>Loading…</main>;
  if (data === false)
    return (
      <main style={{ maxWidth: 560, margin: '80px auto', padding: 24, textAlign: 'center' }}>
        <h1>Page not found</h1>
        <p>This page doesn&rsquo;t exist or hasn&rsquo;t been published.</p>
      </main>
    );

  return (
    <main>
      {data.page?.seo?.noindex && <meta name="robots" content="noindex" />}
      <SiteRenderer sections={data.page.sections ?? []} business={data.business} siteSlug={params.site} pageSlug={params.page} apiBase={BASE} />
      <footer style={{ padding: 24, textAlign: 'center', fontSize: 12, opacity: 0.55 }}>
        {data.business} · Powered by SOFILIC
      </footer>
    </main>
  );
}
