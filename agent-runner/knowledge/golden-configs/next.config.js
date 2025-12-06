/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // ✅ PHASE 2.1: Explicit root for file tracing - silences workspace warnings
  outputFileTracingRoot: __dirname,
  
  // ✅ PHASE 2.1: Explicit workspace root to silence Turbopack warnings
  turbopack: {
    root: __dirname,
  },
  
  // ✅ PHASE 2.1: Next.js 16 experimental features
  experimental: {
    reactCompiler: true,  // React 19 auto-memoization
    ppr: true,            // Partial Prerendering
    serverActions: {
      bodySizeLimit: '5mb'
    }
  },
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

// ✅ NO turbo.root, NO swcMinify (deprecated in v16)
module.exports = nextConfig;

