import type { MetadataRoute } from 'next';
import { GUIDES } from '../lib/guides';

const BASE = 'https://sofilic.com';

/** Public, indexable marketing routes only. Authenticated application routes,
 * the customer portal and auth pages (login/signup/password flows) are
 * deliberately excluded — they are noindexed and disallowed in robots.ts. */
const PUBLIC_ROUTES: { path: string; priority: number }[] = [
  { path: '/', priority: 1.0 },
  { path: '/features', priority: 0.9 },
  { path: '/industries', priority: 0.9 },
  { path: '/pricing', priority: 0.9 },
  { path: '/demo', priority: 0.7 },
  { path: '/resources', priority: 0.8 },
  { path: '/contact', priority: 0.6 },
  { path: '/support', priority: 0.6 },
  { path: '/security', priority: 0.6 },
  { path: '/privacy', priority: 0.3 },
  { path: '/terms', priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    ...PUBLIC_ROUTES.map((r) => ({
      url: `${BASE}${r.path}`,
      lastModified,
      priority: r.priority,
    })),
    ...GUIDES.map((g) => ({
      url: `${BASE}/resources/${g.slug}`,
      lastModified,
      priority: 0.7,
    })),
  ];
}
