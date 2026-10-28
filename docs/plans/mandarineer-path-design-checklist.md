---
type: checklist
source: ~/Documents/builds/ui-library/_ai-design-tells/handoffs/kids-duolingo.md
date: 2026-10-27
status: plan, not started
---

# Mandarineer path and reward design: checklist

Pick: 6-B as the base, with the reward and motion from 6-C. No push, merge, deploy or App Store until Jenny says "yes apply".

## Decisions for Jenny (before any code)

- [x] Base branch. Jenny (2026-10-27): ignore the branch rule, commit as needed. Work goes on `feat/mandarineer-path`, made from `feat/hidden-pinyin` so the pinyin work stays.
- [x] No local database. Jenny (2026-10-27): use the hosted Supabase project.
- [x] Access checked: `psql "$DATABASE_URL"` from `.env.local` reads project `odwoxbxkvmjjqvjyynko`. It has 179 Auth users, and 178 are anonymous (the AuthBootstrap defect). The Supabase MCP servers and the Supabase CLI login do not include this project.
- [ ] Test data on the live project. Proposal: fix AuthBootstrap first, so local browsing makes no users. Then make one test family (`zz-test-mandarineer`), use it for all shots, and delete it at the end. Record the user ID here: {{test-user-id}}. Waits for Jenny's "go".
- [ ] Tests. `package.json` has no test script and no test runner. Proposal: the proof is `tsc --noEmit`, `next build`, `npx cap sync ios` plus an Xcode build, and the screenshots.

## Mock first (Jenny, 2026-10-27: "I just want to see your mocked html")

- [x] Merged 6-B + 6-C mock, before and after for 13 screens: https://claude.ai/artifact/EZ9aHZ9s6XCTFrH8tDtCMo (source: scratchpad `mock/`).
- [ ] Jenny reviews the mock. Code work waits for her changes or her "go".
- [ ] Copy the mock source into the repo (`docs/design/mock-mandarineer-path/`) after review.

## Phase 0: read and map

- [ ] Read OWN-APPS-FIXES.md section 6, the three rounds and research files, the B and C `notes.md` for 7 screens, and `docs/design/DESIGN.md`.
- [ ] Map each `notes.md` change to a file in this repo. Write the map in this doc.

## Step 1: defects (check first, one commit each, no design change)

- [ ] AuthBootstrap: sign in only when `/welcome` creates a child.
- [ ] `<MotionConfig reducedMotion="user">` around the app.
- [ ] `KidLayout`: add an `align` prop.
- [ ] Contrast: check `ink-mid #7E5522` and teal `#15836C`, then use them.
- [ ] Pinyin font with tone marks.
- [ ] Reward: one "5 hearts earned!", no invisible confetti nodes, palette colors.
- [ ] Lesson headings (picture, sentence, math).
- [ ] Packs: show all rows at once.
- [ ] Sentence: keep words on a wrong order. "Next" button, no auto-advance.
- [ ] Parent Zone at 390 px, plus the 90-day guest notice.
- [ ] Child report: started packs only, "not started" line, 🔊 on words, no streaks.
- [ ] `/switch`: "Add" behind the Parent Zone gate.
- [ ] Live CSS vs repo (`.right-0`): read the deploy log and report.

## Step 2: 6-B, then 6-C (one screen per commit)

- [ ] Kid home: "Play next" card, week dots, path.
- [ ] Packs: open path, "Start here", no locks.
- [ ] Feedback band ("Right" / "Not quite" + reason), panda reacts, "Next".
- [ ] Sentence lesson.
- [ ] Math lesson.
- [ ] Math topics.
- [ ] Parent Zone.
- [ ] Child report.
- [ ] Profile switch.
- [ ] Reward: pack progress, word sticker, sticker book, skippable confetti.
- [ ] Reduce Motion: a still version for each motion in the 6-C list.

## Proof (each screen)

- [ ] 1440 and 390 shots next to the target shots, also with Reduce Motion.
- [ ] tell-check: 2 tells or fewer (L1 and C1 allowed).
- [ ] No sideways scroll at 390 px.
- [ ] Type check, build, iOS build.
- [ ] Before and after shots in one folder: {{shots-folder}}.
- [ ] Report in ASD-STE100.
