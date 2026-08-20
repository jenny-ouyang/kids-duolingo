import Link from 'next/link'

/* Calm variant of Sunrise Playground — parent-facing, but the panda is
   allowed here (per design direction for the thank-you moment). */

export default function ThanksPage() {
  return (
    <div className="min-h-screen bg-canvas-top flex items-center justify-center p-6">
      <div className="bg-white rounded-[26px] p-8 shadow-press-card w-full max-w-md text-center">
        <div className="font-emoji text-6xl mb-4">🐼</div>
        <h1 className="text-[27px] font-extrabold text-ink leading-tight">
          Thank you! <span className="font-emoji">💛</span>
        </h1>
        <p className="text-ink-soft text-[15px] font-bold mt-3">
          Everything is unlocked for your whole family — every pack, every topic,
          and everything we add next. Forever.
        </p>
        <p className="text-ink-soft text-sm font-bold mt-2">
          A receipt is on its way to your email.
        </p>
        <Link
          href="/"
          className="pressable inline-flex items-center justify-center min-h-[56px] bg-success text-white rounded-2xl px-8 mt-6 text-[15px] font-extrabold shadow-press-success"
        >
          Back to the app
        </Link>
      </div>
    </div>
  )
}
