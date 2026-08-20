import type { Metadata } from 'next'
import { Baloo_2, ZCOOL_KuaiLe, Noto_Color_Emoji } from 'next/font/google'
import VoicePreloader from '@/components/layout/VoicePreloader'
import AuthBootstrap from '@/components/auth/AuthBootstrap'
import './globals.css'

const baloo = Baloo_2({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-baloo',
})

const kuaile = ZCOOL_KuaiLe({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-kuaile',
})

// Windows/Android parity: without this, the panda/lantern/stickers fall back to
// flat Segoe glyphs. Loaded as a webfont so emoji render the same everywhere.
const notoEmoji = Noto_Color_Emoji({
  subsets: ['emoji'],
  weight: '400',
  variable: '--font-emoji',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://mandarineer.com'),
  title: 'Mandarineer — Mandarin for Kids',
  description: 'A gentle, playful way for kids to learn Mandarin Chinese, with early math practice included. No punishment, just practice.',
  icons: { apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Mandarineer', statusBarStyle: 'default' },
  openGraph: { images: ['/og.png'] },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${baloo.variable} ${kuaile.variable} ${notoEmoji.variable} font-display antialiased`}>
        <AuthBootstrap />
        <VoicePreloader />
        {children}
      </body>
    </html>
  )
}
