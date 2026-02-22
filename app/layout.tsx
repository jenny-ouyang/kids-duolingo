import type { Metadata } from 'next'
import { Nunito } from 'next/font/google'
import VoicePreloader from '@/components/layout/VoicePreloader'
import './globals.css'

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-nunito',
})

export const metadata: Metadata = {
  title: "Julian's Chinese",
  description: 'Learn Mandarin Chinese with Julian',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${nunito.variable} font-nunito antialiased`}>
        <VoicePreloader />
        {children}
      </body>
    </html>
  )
}
