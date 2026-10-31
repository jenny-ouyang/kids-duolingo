/** @type {import('next').NextConfig} */

// CAP_BUILD=1 produces the static bundle for the Capacitor iOS shell
// (scripts/build-ios.sh). The default config is the normal Vercel server build.
const capBuild = process.env.CAP_BUILD === '1'

const nextConfig = capBuild
  ? {
      output: 'export',
      // Only .tsx files count as routes: app/api (route.ts), middleware.ts and the
      // .ts metadata routes are server-only and drop out of the static export,
      // without moving any file in the working tree.
      pageExtensions: ['tsx', 'jsx'], // two entries: Next's app loader reads a one-item list as a string
      images: { unoptimized: true },
      env: {
        NEXT_PUBLIC_CAP_BUILD: '1',
        NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE ?? 'https://mandarineer.com',
      },
    }
  : {}

export default nextConfig
