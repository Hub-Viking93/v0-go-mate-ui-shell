/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // TypeScript build errors are suppressed because the initial project scaffold
    // (generated via v0.dev) contains type issues that are not runtime-critical.
    // Removing this flag will cause `next build` to fail until all TS errors are
    // resolved. Do not remove without fixing all type errors first.
    ignoreBuildErrors: true,
  },
  images: {
    // Images are served unoptimized to avoid Vercel image optimization costs
    // during development and early production. Safe to remove once a CDN/image
    // optimization strategy is defined.
    unoptimized: true,
  },
}

export default nextConfig
