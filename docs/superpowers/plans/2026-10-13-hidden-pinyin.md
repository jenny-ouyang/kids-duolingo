# Hidden Pinyin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide pinyin on kid-facing practice screens and let the child reveal it with one "pīn" toggle per question.

**Architecture:** One small presentational component (`PinyinToggle`) renders in a new optional `headerAction` slot of `ExerciseShell`. Each session page derives `showPinyin` from the question index the toggle was pressed on, so the toggle resets on the next question without an effect. `PictureChoice` and `SentenceBuild` take a `showPinyin` prop and also reveal pinyin by themselves after a correct answer. The celebrate page keeps its own local toggle.

**Tech Stack:** Next.js 14 (app router, static export for iOS), React 18, Tailwind, framer-motion. No test suite exists in this repo.

Spec: `docs/superpowers/specs/2026-10-13-hidden-pinyin-design.md`.

## Global Constraints

- Work on branch `feat/hidden-pinyin`. Push the branch; Jenny merges. Never deploy.
- No database, API, or content change.
- Parent report (`app/parent/report/page.tsx`) is unchanged.
- No test suite exists (AGENTS.md: "TypeScript + `npm run lint` are the primary quality checks"). Every task's check is `npx tsc --noEmit` plus `npm run lint`, and the final task is a browser check.
- Hidden pinyin uses Tailwind `invisible` (keeps its space) so tiles and prompts do not jump in height when it appears.
- `ExerciseShell` is also used by math sessions. The new prop must be optional, and math must render exactly as before.
- Do not run `./scripts/build-ios.sh` or Xcode without Jenny's approval.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: PinyinToggle component and ExerciseShell slot

**Files:**
- Create: `components/exercise/PinyinToggle.tsx`
- Modify: `components/exercise/ExerciseShell.tsx`

**Interfaces:**
- Produces: `export default function PinyinToggle({ on, onToggle }: { on: boolean; onToggle: () => void })`
- Produces: `ExerciseShell` accepts optional `headerAction?: React.ReactNode`, rendered on the same row as the question counter chip.

- [ ] **Step 1: Create `components/exercise/PinyinToggle.tsx`**

```tsx
'use client'

interface PinyinToggleProps {
  on: boolean
  onToggle: () => void
}

/** "pīn" hint chip — pinyin stays hidden until the child asks for it */
export default function PinyinToggle({ on, onToggle }: PinyinToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      aria-label={on ? 'Hide pinyin' : 'Show pinyin'}
      className={`pressable rounded-full px-4 py-1.5 text-sm font-extrabold tracking-wide select-none transition-colors duration-200 ${
        on ? 'bg-chinese text-white shadow-press-chinese' : 'bg-white text-chinese shadow-press-chip'
      }`}
    >
      pīn
    </button>
  )
}
```

- [ ] **Step 2: Add the `headerAction` slot to `components/exercise/ExerciseShell.tsx`**

Change the props interface and signature:

```tsx
interface ExerciseShellProps {
  current: number
  total: number
  /** Optional control on the counter row (e.g. the pinyin toggle) */
  headerAction?: React.ReactNode
  children: React.ReactNode
}

export default function ExerciseShell({ current, total, headerAction, children }: ExerciseShellProps) {
```

Replace the counter chip block:

```tsx
      {/* Question counter chip */}
      <div className="self-center bg-white rounded-full px-5 py-1.5 shadow-press-chip text-sm font-extrabold text-ink tracking-wide">
        {current} / {total}
      </div>
```

with:

```tsx
      {/* Question counter chip — optional action pinned right, counter stays centered */}
      <div className="relative flex justify-center">
        <div className="bg-white rounded-full px-5 py-1.5 shadow-press-chip text-sm font-extrabold text-ink tracking-wide">
          {current} / {total}
        </div>
        {headerAction && <div className="absolute right-0 top-1/2 -translate-y-1/2">{headerAction}</div>}
      </div>
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (`PinyinToggle` is unused for now; that is not a lint error for a default export.)

- [ ] **Step 4: Commit**

```bash
git add components/exercise/PinyinToggle.tsx components/exercise/ExerciseShell.tsx
git commit -m "feat(pinyin): add PinyinToggle and ExerciseShell header slot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Word session hides pinyin (PictureChoice + session page)

**Files:**
- Modify: `components/exercise/PictureChoice.tsx` (props interface near line 11, `ChineseCard` near line 140, `AudioPrompt` near line 163, main component near line 205)
- Modify: `app/practice/session/page.tsx` (imports near line 7, state near line 47, render near line 238)

**Interfaces:**
- Consumes: `PinyinToggle` and `ExerciseShell.headerAction` from Task 1.
- Produces: `PictureChoiceProps.showPinyin: boolean` (required).

- [ ] **Step 1: Add the prop to `PictureChoiceProps`**

```tsx
interface PictureChoiceProps {
  question: ExerciseQuestion
  onAnswer: (correct: boolean) => void
  /** Child pressed the "pīn" toggle for this question */
  showPinyin: boolean
}
```

- [ ] **Step 2: Hide pinyin on `ChineseCard` unless revealed or solved**

Add `showPinyin: boolean` to the `ChineseCard` parameter list and its type:

```tsx
function ChineseCard({
  word, state, shaking, isCorrect, onClick, disabled, edgeClass, showPinyin,
}: {
  word: Word; state: AnswerState; shaking: boolean; isCorrect: boolean; onClick: () => void; disabled: boolean; edgeClass: string; showPinyin: boolean
}) {
  // Pinyin is a hint, not a crutch: hidden until asked for, or shown on the solved tile
  const pinyinVisible = showPinyin || (state !== 'idle' && isCorrect)
```

Replace the pinyin line:

```tsx
      <span className="text-base font-bold text-ink-soft">{word.pinyin}</span>
```

with:

```tsx
      <span className={`text-base font-bold text-ink-soft ${pinyinVisible ? '' : 'invisible'}`}>{word.pinyin}</span>
```

- [ ] **Step 3: Hide pinyin on `AudioPrompt` unless revealed**

Change the signature:

```tsx
function AudioPrompt({ word, pinyinVisible }: { word: Word; pinyinVisible: boolean }) {
```

Replace:

```tsx
          <span className="text-lg font-bold text-chinese">{word.pinyin}</span>
```

with:

```tsx
          <span className={`text-lg font-bold text-chinese ${pinyinVisible ? '' : 'invisible'}`}>{word.pinyin}</span>
```

- [ ] **Step 4: Wire the prop through the main component**

Change the signature:

```tsx
export default function PictureChoice({ question, onAnswer, showPinyin }: PictureChoiceProps) {
```

Change the audio prompt line:

```tsx
      {question.type === 'audio_to_picture' && <AudioPrompt word={question.word} pinyinVisible={showPinyin || solved} />}
```

Add `showPinyin={showPinyin}` to the `<ChineseCard ... />` element (not to `PictureCard`; picture tiles show no pinyin):

```tsx
            <ChineseCard
              key={word.id}
              word={word}
              state={cardState}
              shaking={shaking}
              isCorrect={isCorrect}
              onClick={() => handleSelect(word.id)}
              disabled={cardDisabled}
              edgeClass={edgeClass}
              showPinyin={showPinyin}
            />
```

- [ ] **Step 5: Add the toggle to `app/practice/session/page.tsx`**

Add the import after the `PictureChoice` import:

```tsx
import PinyinToggle from '@/components/exercise/PinyinToggle'
```

Add this state directly after `const [currentIndex, setCurrentIndex] = useState(0)`:

```tsx
  // Which question index the child revealed pinyin on. Derived, not reset by an
  // effect: moving to the next index hides pinyin in the same render.
  const [pinyinIndex, setPinyinIndex] = useState<number | null>(null)
  const showPinyin = pinyinIndex === currentIndex
```

Replace the render block:

```tsx
        <ExerciseShell current={currentIndex + 1} total={questions.length}>
```

with:

```tsx
        <ExerciseShell
          current={currentIndex + 1}
          total={questions.length}
          headerAction={
            <PinyinToggle
              on={showPinyin}
              onToggle={() => setPinyinIndex(showPinyin ? null : currentIndex)}
            />
          }
        >
```

and replace:

```tsx
              <PictureChoice question={currentQuestion} onAnswer={handleAnswer} />
```

with:

```tsx
              <PictureChoice question={currentQuestion} onAnswer={handleAnswer} showPinyin={showPinyin} />
```

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. If tsc reports another caller of `PictureChoice` missing `showPinyin`, run `grep -rn "<PictureChoice" app components` and pass `showPinyin={false}` there.

- [ ] **Step 7: Commit**

```bash
git add components/exercise/PictureChoice.tsx app/practice/session/page.tsx
git commit -m "feat(pinyin): hide pinyin in word sessions behind the pīn toggle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Sentence page hides pinyin (SentenceBuild + sentences page)

**Files:**
- Modify: `components/exercise/SentenceBuild.tsx` (props near line 12, state near line 24, guards near lines 38 and 67, pinyin block near line 143)
- Modify: `app/practice/sentences/page.tsx` (imports near line 8, state near line 29, render near line 166)

**Interfaces:**
- Consumes: `PinyinToggle` and `ExerciseShell.headerAction` from Task 1.
- Produces: `SentenceBuild` `Props.showPinyin: boolean` (required).

Note: today `SentenceBuild` has a local state named `showPinyin` that also works as the "solved, ignore taps" lock. Rename it to `solved` so the prop can take the name without changing the lock behavior.

- [ ] **Step 1: Add the prop and rename the local state**

```tsx
interface Props {
  question: SentenceQuestion
  onAnswer: (correct: boolean) => void
  /** Child pressed the "pīn" toggle for this question */
  showPinyin: boolean
}

export default function SentenceBuild({ question, onAnswer, showPinyin }: Props) {
```

Replace `const [showPinyin, setShowPinyin] = useState(false)` with:

```tsx
  const [solved, setSolved] = useState(false)
```

- [ ] **Step 2: Update the three uses of the old local state**

In `tapBankTile`:

```tsx
    if (placed.length >= slotCount || shaking || solved) return
```

and in the correct branch replace `setShowPinyin(true)` with:

```tsx
        setSolved(true)
```

In `tapPlacedTile`:

```tsx
    if (shaking || solved) return
```

In the bank tile button (near line 177):

```tsx
                disabled={shaking || solved}
```

- [ ] **Step 3: Show the pinyin block when toggled or solved**

Replace:

```tsx
      {/* Pinyin — appears on correct */}
      <AnimatePresence>
        {showPinyin && (
```

with:

```tsx
      {/* Pinyin — appears when the child asks (pīn toggle) or on correct */}
      <AnimatePresence>
        {(showPinyin || solved) && (
```

- [ ] **Step 4: Confirm no stale name remains**

Run: `grep -n "setShowPinyin" components/exercise/SentenceBuild.tsx`
Expected: no output.

- [ ] **Step 5: Add the toggle to `app/practice/sentences/page.tsx`**

Add the import after the `SentenceBuild` import:

```tsx
import PinyinToggle from '@/components/exercise/PinyinToggle'
```

Add directly after `const [currentIndex, setCurrentIndex] = useState(0)`:

```tsx
  // Which question index the child revealed pinyin on. Derived, not reset by an
  // effect: moving to the next index hides pinyin in the same render.
  const [pinyinIndex, setPinyinIndex] = useState<number | null>(null)
  const showPinyin = pinyinIndex === currentIndex
```

Replace:

```tsx
        <ExerciseShell current={currentIndex + 1} total={questions.length}>
```

with:

```tsx
        <ExerciseShell
          current={currentIndex + 1}
          total={questions.length}
          headerAction={
            <PinyinToggle
              on={showPinyin}
              onToggle={() => setPinyinIndex(showPinyin ? null : currentIndex)}
            />
          }
        >
```

Replace:

```tsx
              <SentenceBuild key={currentQuestion.sentence.id} question={currentQuestion} onAnswer={handleAnswer} />
```

with:

```tsx
              <SentenceBuild
                key={currentQuestion.sentence.id}
                question={currentQuestion}
                onAnswer={handleAnswer}
                showPinyin={showPinyin}
              />
```

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/exercise/SentenceBuild.tsx app/practice/sentences/page.tsx
git commit -m "feat(pinyin): hide sentence pinyin until toggled or solved

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Celebrate page hides the praise pinyin

**Files:**
- Modify: `app/celebrate/page.tsx` (imports near line 3, `CelebrationContent` state, praise block near line 104)

**Interfaces:**
- Consumes: `PinyinToggle` from Task 1.

- [ ] **Step 1: Import the toggle**

Add after the `Mascot` import:

```tsx
import PinyinToggle from '@/components/exercise/PinyinToggle'
```

- [ ] **Step 2: Add local state inside `CelebrationContent`**

Add with the other `useState` calls at the top of `CelebrationContent`:

```tsx
  const [showPinyin, setShowPinyin] = useState(false)
```

- [ ] **Step 3: Replace the praise phrase block**

Replace the whole `<motion.div ...>` that wraps the praise `<button>` (the block under `{/* Chinese praise phrase — teaches through encouragement */}`) with:

```tsx
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col items-center gap-2"
        >
          <button
            onClick={() => speakChinese(enc.chinesePhrase)}
            className="pressable bg-white rounded-3xl px-7 py-4 shadow-press-card flex flex-col items-center gap-1 cursor-pointer"
          >
            <span className="font-hanzi text-4xl text-ink border-b-[6px] border-gold pb-0.5">
              {enc.chinesePhrase}
            </span>
            <span className={`text-base font-bold text-chinese ${showPinyin ? '' : 'invisible'}`}>
              {enc.chinesePinyin}
            </span>
            <span className="text-sm font-bold text-ink-soft">
              {enc.chineseMeaning} <span className="font-emoji">🔊</span>
            </span>
          </button>
          {/* Separate control: tapping the phrase plays audio, so reveal can't share that tap */}
          <PinyinToggle on={showPinyin} onToggle={() => setShowPinyin((v) => !v)} />
        </motion.div>
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/celebrate/page.tsx
git commit -m "feat(pinyin): hide praise-phrase pinyin on the celebrate page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Browser verification and push

**Files:** none changed unless a check fails.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (background). Wait for `Ready` on `http://localhost:3000`.

- [ ] **Step 2: Check the word session**

Open `http://localhost:3000/practice/session?pack=animals`. For each exercise type that appears (`audio_to_picture`, `picture_to_chinese`, `english_to_chinese`), confirm:
1. Pinyin is not visible at load, and tiles do not change height when it appears.
2. Tapping "pīn" shows pinyin on the prompt (audio type) or on all four Chinese tiles. Tapping again hides it.
3. Tapping a tile still answers the question; tapping the audio prompt still plays sound.
4. A correct answer shows pinyin on the correct tile / audio prompt.
5. The next question loads with pinyin hidden and the toggle off.

- [ ] **Step 3: Check the sentence page**

Open `http://localhost:3000/practice/sentences`. Confirm the same 5 points: hidden at load, toggle shows the pinyin card, wrong order still shakes and resets, correct shows pinyin, next sentence starts hidden.

- [ ] **Step 4: Check the celebrate page and math**

Finish one session to reach `/celebrate`. Confirm praise pinyin is hidden, "pīn" reveals it, tapping the phrase plays audio. Open one math session and confirm the counter row looks unchanged (no toggle).

- [ ] **Step 5: Final quality gate**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 6: Push the branch**

```bash
git push -u origin feat/hidden-pinyin
```

Report to Jenny: the branch name, what was checked in the browser, and that iOS was not rebuilt.
