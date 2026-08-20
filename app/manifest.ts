import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mandarineer — Mandarin for Kids',
    short_name: 'Mandarineer',
    description: 'A gentle, playful way for kids to learn Mandarin Chinese, with early math included.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFF8E7',
    theme_color: '#FFF8E7',
    orientation: 'portrait',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
