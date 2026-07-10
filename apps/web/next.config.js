/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output is only needed for the Docker image; it uses symlinks that
  // require elevated privileges on Windows. Enable it via NEXT_OUTPUT=standalone
  // (set in the web Dockerfile). Local/CI builds use the default output.
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' } : {}),
  env: {
    WEB_PUBLIC_API_URL: process.env.WEB_PUBLIC_API_URL ?? 'http://localhost:4000',
  },
  // Legacy pre-Rev-2 routes redirect to their approved module home. The
  // underlying pages/components/backends are untouched and still exist —
  // this only changes which URL a visitor lands on.
  async redirects() {
    return [
      { source: '/pipeline', destination: '/sales', permanent: false },
      { source: '/inbox', destination: '/conversations', permanent: false },
      { source: '/workforce', destination: '/voice-ai', permanent: false },
      { source: '/revenue', destination: '/payments', permanent: false },
      { source: '/billing', destination: '/payments', permanent: false },
      { source: '/reviews', destination: '/marketing', permanent: false },
      { source: '/automations', destination: '/automation', permanent: false },
      { source: '/workflows', destination: '/automation', permanent: false },
      { source: '/marketplace', destination: '/apps', permanent: false },
      { source: '/analytics', destination: '/dashboard', permanent: false },
      { source: '/executive', destination: '/dashboard', permanent: false },
      { source: '/dispatch', destination: '/apps', permanent: false },
      { source: '/jobs', destination: '/apps', permanent: false },
    ];
  },
};

module.exports = nextConfig;
