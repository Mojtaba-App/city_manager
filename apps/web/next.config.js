/** @type {import('next').NextConfig} */
const useStandalone =
  process.env.DOCKER_BUILD === '1' ||
  process.env.NEXT_OUTPUT_STANDALONE === '1' ||
  process.platform !== 'win32';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@city-manager/shared'],
  allowedDevOrigins: [
    'localhost:3000',
    '127.0.0.1:3000',
    ...(process.env.ALLOWED_DEV_ORIGINS
      ? process.env.ALLOWED_DEV_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
      : []),
  ],
  experimental: {
    // Default rewrite proxy aborts after 30s — large GIS ingest needs longer.
    proxyTimeout: 15 * 60 * 1000,
    // Default 10MB truncates KMZ/GeoJSON bodies before they reach Nest (corrupts upload).
    proxyClientMaxBodySize: '110mb',
  },
  async rewrites() {
    const api = process.env.API_PROXY_TARGET || 'http://localhost:3001';
    return [
      { source: '/favicon.ico', destination: '/favicon.svg' },
      { source: '/api/v1/:path*', destination: `${api}/api/v1/:path*` },
    ];
  },
  // standalone needs symlinks; skip on local Windows unless explicitly forced
  ...(useStandalone ? { output: 'standalone' } : {}),
};

module.exports = nextConfig;
