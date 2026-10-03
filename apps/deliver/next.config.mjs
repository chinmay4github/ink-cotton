/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  transpilePackages: ['@ic/ui'],
  // monorepo: trace shared package files into the standalone bundle
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  images: { remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }] },
};
export default nextConfig;
