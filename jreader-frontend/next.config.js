/**
 * Next.js config factory that receives the phase.
 * Uses separate .next directories for dev vs prod to prevent cache collisions.
 * @param {string} phase - The Next.js build phase
 */
export default function config(phase) {
  // Phase values: 'phase-development-server', 'phase-production-build', 'phase-production-server'
  const isDev = phase === 'phase-development-server';

  // Dev server uses .next-dev, both prod build and prod start use .next-prod
  const distDir = isDev ? '.next-dev' : '.next-prod';

  console.log(`[next.config] phase = ${phase} → distDir = ${distDir}`);

  /** @type {import('next').NextConfig} */
  const nextConfig = {
    distDir,
    compiler: {
      removeConsole: process.env.NODE_ENV === 'production'
        ? { exclude: ["error", "warn"] }
        : false,
    },
    experimental: {
      serverActions: {
        bodySizeLimit: '10mb',
      },
      externalDir: true,
    },
    eslint: {
      ignoreDuringBuilds: true,
    },
    typescript: {
      // !! WARN !!
      // Dangerously allow production builds to successfully complete even if
      // your project has type errors.
      // !! WARN !!
      ignoreBuildErrors: true,
    },
    transpilePackages: ['@jreader/shared-types-ts'],
    async rewrites() {
      return [
        {
          source: '/dicts/:path*',
          destination: process.env.NODE_ENV === 'production'
            ? 'https://jreader-service.onrender.com/dicts/:path*' // Production backend
            : 'https://waiwais-macbook-pro-2.unicorn-lime.ts.net/jreader-service/dicts/:path*', // Development backend
        },
      ];
    },
  };

  return nextConfig;
}
