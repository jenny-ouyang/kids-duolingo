/** @type {import('next').NextConfig} */

// CAP_BUILD=1 produces the static bundle for the Capacitor iOS shell
// (scripts/build-ios.sh). The default config is the normal Vercel server build.
const capBuild = process.env.CAP_BUILD === '1'

const nextConfig = capBuild
  ? {
      output: 'export',
      images: { unoptimized: true },
      env: {
        NEXT_PUBLIC_CAP_BUILD: '1',
        NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE ?? 'https://mandarineer.com',
      },
    }
  : {}

export default nextConfig
