import Link from 'next/link'

/*
 * ============================================================================
 * DRAFT — PENDING OWNER REVIEW. DO NOT TREAT AS A PUBLISHED LEGAL DOCUMENT.
 * ============================================================================
 * Plain-language terms drafted 2026-08-19. Needs Jenny's review before launch.
 * The governing-law jurisdiction and the contact email "support@[appdomain]"
 * are PLACEHOLDERS — fill both in before this page goes live.
 * ============================================================================
 */

export const metadata = {
  title: 'Terms of Use',
}

/* Trust page — calm Sunrise Playground variant: same palette and warm ink,
   no mascot/hills/sparkles (per DESIGN.md, parent zone rule). */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-extrabold text-ink">{title}</h2>
      {children}
    </section>
  )
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-canvas-top">
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Link
            href="/parent"
            aria-label="Back to the parent zone"
            className="pressable bg-white rounded-2xl w-14 h-14 flex items-center justify-center text-2xl text-ink shadow-press-chip flex-shrink-0"
          >
            ←
          </Link>
          <div>
            <h1 className="text-[27px] font-extrabold text-ink leading-tight">
              Terms of Use
            </h1>
            <p className="text-ink-soft text-sm font-bold">Last updated: 2026-08-19</p>
          </div>
        </div>

        <div className="bg-white rounded-[26px] p-6 sm:p-8 shadow-press-card flex flex-col gap-6 text-[15px] font-semibold text-ink leading-relaxed">
          <p>
            These are the plain-language rules for using this app. By using it, you
            agree to them.
          </p>

          <Section title="Personal and family use">
            <p>
              The app is for you and your family to learn with. Use it at home, on
              the go, with as many of your own children as the app allows. Please
              don&apos;t resell it, scrape it, or use it to build a competing
              service.
            </p>
          </Section>

          <Section title="It's free right now">
            <p>
              The app is currently free during its trial period. There are no
              subscriptions and no in-app purchases today. If that ever changes, we
              will say so clearly before anything costs money.
            </p>
          </Section>

          <Section title="No warranty">
            <p>
              We work hard to keep the app running and the content accurate, but it
              is provided as-is, without warranties of any kind. We may change,
              pause, or discontinue features at any time. To the extent the law
              allows, we are not liable for damages arising from your use of the
              app.
            </p>
          </Section>

          <Section title="Your account">
            <p>
              You are responsible for the account you create and for supervising
              your children&apos;s use of the app. How we handle your family&apos;s
              data is covered in the{' '}
              <Link href="/privacy" className="underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </p>
          </Section>

          <Section title="Governing law">
            <p>
              These terms are governed by the laws of{' '}
              <strong>[Jurisdiction — placeholder, to be set before launch]</strong>.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these terms? Email{' '}
              <strong>support@[appdomain]</strong> (placeholder address).
            </p>
          </Section>
        </div>

        <footer className="flex items-center justify-center gap-6 pb-4">
          <Link
            href="/privacy"
            className="text-ink-soft text-sm font-bold underline underline-offset-2"
          >
            Privacy
          </Link>
          <Link
            href="/parent"
            className="text-ink-soft text-sm font-bold underline underline-offset-2"
          >
            Parent Zone
          </Link>
        </footer>
      </div>
    </div>
  )
}
