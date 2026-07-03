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
};

module.exports = nextConfig;
