import type { MetadataRoute } from 'next';

/** Crawler policy: the marketing site is crawlable; the authenticated
 * application, the customer portal and account/auth flows are not. This list
 * must cover every directory under app/(app)/ plus the auth pages — the same
 * routes also carry a noindex robots meta tag as a second layer. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Authenticated application routes (app/(app)/*)
          '/dashboard',
          '/ai-workforce',
          '/onboarding',
          '/crm',
          '/sales',
          '/conversations',
          '/voice-ai',
          '/marketing',
          '/social',
          '/websites',
          '/seo',
          '/automation',
          '/payments',
          '/apps',
          '/settings',
          '/portal',
          '/notifications',
          // Account / auth flows
          '/login',
          '/signup',
          '/forgot-password',
          '/reset-password',
        ],
      },
    ],
    sitemap: 'https://sofilic.com/sitemap.xml',
  };
}
