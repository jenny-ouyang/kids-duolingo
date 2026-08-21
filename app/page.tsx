import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import KidHome from '@/components/home/KidHome'
import Landing from '@/components/home/Landing'

// Cookie name mirrors CHILD_COOKIE in lib/auth.ts (not imported — that module
// pulls in Prisma, which doesn't belong in a page's module graph).
const CHILD_COOKIE = 'kd_child'

export const metadata: Metadata = {
  title: 'Mandarineer: Mandarin for Kids — Learn Chinese, Ages 4–8',
  description:
    'Learn Chinese for kids, the gentle way. Mandarin for kids ages 4–8 with spoken words, pictures, and early math — short 8-question sessions, no ads, and no punishment for wrong answers.',
  openGraph: {
    images: ['/og.png'],
    title: 'Mandarineer: Mandarin for Kids — Learn Chinese, Ages 4–8',
    description:
      'A playful web app where kids 4–8 learn Chinese words and early math. Spoken Mandarin, spaced repetition, and kind-by-design practice — free to play.',
    type: 'website',
    siteName: 'Mandarineer',
  },
}

/**
 * Server-side fork: returning families (kd_child cookie set) go straight to
 * the kid home; everyone else — first-time visitors and crawlers, which never
 * carry the cookie — sees the public marketing landing (the SEO surface).
 *
 * The Capacitor build is statically exported (no request cookies) and is an
 * installed app, not a marketing surface — it always renders the kid home.
 */
export default function HomePage() {
  if (process.env.NEXT_PUBLIC_CAP_BUILD === '1') return <KidHome />
  const hasChild = cookies().has(CHILD_COOKIE)
  return hasChild ? <KidHome /> : <Landing />
}
