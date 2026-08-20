import Link from 'next/link'
import { Hills, Sparkles, Sun } from '@/components/design/Scenery'
import Mascot from '@/components/design/Mascot'

/*
 * Public landing page — the SEO surface visitors (and crawlers) see before a
 * child profile exists. Parent-directed copy on the full Sunrise Playground
 * canvas (DESIGN.md): sunrise hero with hills/sparkles/mascot, then calm
 * white cards. Server component — no client JS; press physics is pure CSS.
 */

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Mandarineer',
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Any',
  browserRequirements: 'Requires a modern web browser',
  description:
    'A gentle, playful web app for kids ages 4–8 to learn Chinese. Short 8-question sessions, spoken Mandarin audio, spaced repetition, early math practice included — and no punishment for wrong answers.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  audience: {
    '@type': 'PeopleAudience',
    suggestedMinAge: 4,
    suggestedMaxAge: 8,
  },
  inLanguage: ['en', 'zh'],
  isAccessibleForFree: true,
}

const HOW_IT_WORKS = [
  {
    emoji: '👆',
    frame: '#FFE3E7', // coral tint
    edge: 'shadow-tile-chinese',
    title: 'Tap and learn',
    body: 'Bite-size sessions of 8 questions. Your child hears every Chinese word spoken aloud, taps a picture or character, and moves on — a full session fits in a few minutes.',
  },
  {
    emoji: '🧠',
    frame: '#E1EDFD', // ocean tint
    edge: 'shadow-tile-math',
    title: 'Remembers what’s tricky',
    body: 'Spaced repetition works quietly in the background, bringing each word back right before it slips away. Easy words step aside; tricky ones get more practice.',
  },
  {
    emoji: '💛',
    frame: '#FFF3D6', // gold tint
    edge: 'shadow-tile-gold',
    title: 'Kind by design',
    body: 'No punishment, no losing lives, no streak-shaming. A wrong answer shows the right one and offers another try. Kids collect hearts and cheers — that’s it.',
  },
]

const PACK_CHIPS = [
  { emoji: '🐾', name: 'Animals', hanzi: '动物' },
  { emoji: '🌈', name: 'Colors', hanzi: '颜色' },
  { emoji: '🔢', name: 'Numbers', hanzi: '数字' },
  { emoji: '🍎', name: 'Food', hanzi: '食物' },
  { emoji: '➕', name: 'Math', hanzi: '数学' },
]

export default function Landing() {
  return (
    <div className="bg-canvas-top select-text">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      {/* ── Hero: full sunrise scene ─────────────────────────────────── */}
      <header className="sunrise-canvas flex flex-col items-center justify-center px-5 py-14">
        <Sun />
        <Sparkles />
        <Hills />

        <div className="relative z-10 flex w-full max-w-xl flex-col items-center gap-5 text-center">
          <Mascot say="你好!" />

          <h1 className="-mt-4 text-[38px] font-extrabold leading-[1.1] text-ink md:text-[52px]">
            Mandarineer
          </h1>

          <p className="max-w-md text-[17px] font-bold leading-relaxed text-ink md:text-lg">
            A gentle, playful way for kids ages 4–8 to learn Chinese — real
            Mandarin words, spoken aloud, remembered for good. Early math
            practice included. No ads, no pressure — wrong answers simply get
            another try.
          </p>

          <Link
            href="/welcome"
            className="pressable mt-2 inline-flex min-h-[60px] items-center justify-center rounded-full bg-success px-12 py-4 text-xl font-extrabold text-white shadow-press-success"
          >
            Play free →
          </Link>

          <p className="text-sm font-extrabold text-ink-soft">
            Free to play · No sign-up needed · Works on phone, tablet &amp;
            computer
          </p>
        </div>
      </header>

      <main>
        {/* ── How it works ─────────────────────────────────────────────── */}
        <section
          aria-labelledby="how-it-works"
          className="mx-auto w-full max-w-5xl px-5 py-16 md:py-20"
        >
          <h2
            id="how-it-works"
            className="text-center text-[27px] font-extrabold text-ink md:text-[32px]"
          >
            How it works
          </h2>
          <div className="mt-8 grid gap-7 md:mt-10 md:grid-cols-3">
            {HOW_IT_WORKS.map((card) => (
              <article
                key={card.title}
                className={`rounded-[22px] bg-white p-6 ${card.edge}`}
              >
                <span
                  aria-hidden
                  className="inline-block rotate-[-4deg] rounded-2xl px-3 py-2 font-emoji text-[32px] leading-none"
                  style={{ background: card.frame }}
                >
                  {card.emoji}
                </span>
                <h3 className="mt-4 text-lg font-extrabold text-ink">
                  {card.title}
                </h3>
                <p className="mt-2 text-[15px] font-semibold leading-relaxed text-ink">
                  {card.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ── What's inside ────────────────────────────────────────────── */}
        <section
          aria-labelledby="whats-inside"
          className="mx-auto w-full max-w-5xl px-5 pb-16 md:pb-20"
        >
          <h2
            id="whats-inside"
            className="text-center text-[27px] font-extrabold text-ink md:text-[32px]"
          >
            What&apos;s inside
          </h2>
          <ul className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {PACK_CHIPS.map((chip) => (
              <li
                key={chip.name}
                className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-press-chip"
              >
                <span aria-hidden className="font-emoji text-xl leading-none">
                  {chip.emoji}
                </span>
                <span className="text-[15px] font-extrabold text-ink">
                  {chip.name}
                </span>
                <span className="font-hanzi text-[15px] leading-none text-chinese">
                  {chip.hanzi}
                </span>
              </li>
            ))}
          </ul>
          <p className="mx-auto mt-6 max-w-lg text-center text-[15px] font-semibold leading-relaxed text-ink">
            Thirteen themed word packs — family, feelings, actions, greetings
            and more — plus first sentences and addition up to 100.
          </p>
        </section>

        {/* ── For parents ──────────────────────────────────────────────── */}
        <section
          aria-labelledby="for-parents"
          className="mx-auto w-full max-w-5xl px-5 pb-20"
        >
          <div className="mx-auto max-w-2xl rounded-[26px] bg-white p-7 shadow-press-card md:p-10">
            <h2
              id="for-parents"
              className="text-[27px] font-extrabold text-ink md:text-[32px]"
            >
              For parents
            </h2>
            <ul className="mt-5 flex flex-col gap-4 text-[15px] font-semibold leading-relaxed text-ink">
              <li className="flex gap-3">
                <span aria-hidden className="font-emoji text-xl leading-none">
                  👨‍👩‍👧‍👦
                </span>
                <span>
                  One family account, a profile for each child — siblings keep
                  their own hearts, streaks, and progress.
                </span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="font-emoji text-xl leading-none">
                  📊
                </span>
                <span>
                  See what each child has practiced and mastered in the{' '}
                  <Link
                    href="/parent"
                    className="font-extrabold underline underline-offset-2"
                  >
                    Parent Zone
                  </Link>
                  .
                </span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="font-emoji text-xl leading-none">
                  🔒
                </span>
                <span>
                  Built privacy-first: no ads, no third-party trackers, and only
                  the minimum data needed to run the app. Read the{' '}
                  <Link
                    href="/privacy"
                    className="font-extrabold underline underline-offset-2"
                  >
                    privacy policy
                  </Link>
                  .
                </span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="font-emoji text-xl leading-none">
                  🎈
                </span>
                <span>
                  Free while in early access — every pack and feature, no
                  payment details asked.
                </span>
              </li>
            </ul>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-chip-track px-5 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 text-center">
          <nav
            aria-label="Footer"
            className="flex items-center gap-2 text-sm font-extrabold text-ink-soft"
          >
            <Link href="/privacy" className="underline underline-offset-2">
              Privacy
            </Link>
            <span aria-hidden>·</span>
            <Link href="/terms" className="underline underline-offset-2">
              Terms
            </Link>
            <span aria-hidden>·</span>
            <Link href="/parent" className="underline underline-offset-2">
              Parent Zone
            </Link>
          </nav>
          <p className="text-sm font-bold text-ink-soft">
            © 2026 Mandarineer · mandarineer.com
          </p>
        </div>
      </footer>
    </div>
  )
}
