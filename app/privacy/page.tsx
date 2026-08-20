import Link from 'next/link'

/*
 * ============================================================================
 * DRAFT — PENDING OWNER REVIEW. DO NOT TREAT AS A PUBLISHED LEGAL DOCUMENT.
 * ============================================================================
 * This privacy policy was drafted from the actual data model (2026-08-19) and
 * needs Jenny's review before it counts as the app's real policy. The contact
 * email "support@mandarinandmath.com" is a PLACEHOLDER — replace it with a real
 * address (and a real domain) before launch.
 * ============================================================================
 */

export const metadata = {
  title: 'Privacy Policy',
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

export default function PrivacyPage() {
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
              Privacy Policy
            </h1>
            <p className="text-ink-soft text-sm font-bold">Last updated: 2026-08-19</p>
          </div>
        </div>

        <div className="bg-white rounded-[26px] p-6 sm:p-8 shadow-press-card flex flex-col gap-6 text-[15px] font-semibold text-ink leading-relaxed">
          <p>
            This app is a small, family-focused learning app for practicing Chinese
            and math. We collect as little as possible, and what we do collect exists
            only to make the app work for your family. We show no ads, we use no
            third-party analytics or trackers, and we never sell data.
          </p>

          <Section title="What we collect">
            <ul className="list-disc pl-5 flex flex-col gap-1.5">
              <li>
                <strong>Parent email</strong> — only if you choose to claim your
                account by adding an email. Until then, the app runs on an anonymous
                guest account with no email at all.
              </li>
              <li>
                <strong>Child profile</strong> — a nickname and an avatar emoji,
                both chosen by the parent. We do not collect a child&apos;s last
                name, birthdate, photo, location, or contact details.
              </li>
              <li>
                <strong>Practice history</strong> — which questions were answered,
                whether they were right, and the hearts and streaks earned. This
                powers the spaced-repetition scheduling and the progress you see in
                the Parent Zone.
              </li>
            </ul>
          </Section>

          <Section title="Children's privacy">
            <p>
              Children never create their own accounts. All children&apos;s data
              lives under the parent&apos;s account, is limited to the nickname,
              avatar emoji, and practice history described above, and the app never
              asks a child for personal information. We designed this with
              children&apos;s privacy laws such as COPPA in mind: minimal data,
              collected only under a parent&apos;s control, used only to run the
              learning experience.
            </p>
          </Section>

          <Section title="Where your data lives">
            <p>
              Data is stored with Supabase, our hosting and database provider, in
              the United States. Supabase processes the data on our behalf and does
              not use it for its own purposes.
            </p>
          </Section>

          <Section title="What we don't do">
            <ul className="list-disc pl-5 flex flex-col gap-1.5">
              <li>No advertising of any kind.</li>
              <li>No third-party analytics, tracking pixels, or ad SDKs.</li>
              <li>No selling or sharing of data with anyone.</li>
            </ul>
          </Section>

          <Section title="Deleting your data">
            <p>
              You can delete a child&apos;s profile and all of their practice
              history at any time from the Parent Zone. To delete your entire
              account, use the in-app options or email us at{' '}
              <strong>support@mandarinandmath.com</strong> (mailbox pending domain setup — a real
              contact address will replace this before launch) and we will remove
              everything associated with your account.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              If this policy changes, we will update this page and the &quot;Last
              updated&quot; date above.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about privacy? Email{' '}
              <strong>support@mandarinandmath.com</strong> (mailbox pending domain setup).
            </p>
          </Section>
        </div>

        <footer className="flex items-center justify-center gap-6 pb-4">
          <Link
            href="/terms"
            className="text-ink-soft text-sm font-bold underline underline-offset-2"
          >
            Terms
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
