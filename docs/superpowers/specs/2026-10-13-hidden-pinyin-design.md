# Hidden pinyin with a per-screen toggle

Date: 2026-10-13. Status: approved by Jenny, not built. Branch: `feat/hidden-pinyin`.

This is feature 1 of 3 from Jenny's request on 2026-10-13. The agreed order is: hidden pinyin, then scenarios and sentences, then voice recognition. Voice recognition goes in 1.0.1, after build 6 is submitted, because it changes the App Privacy label.

## Goal

A child reads the characters first. Pinyin is a hint that the child asks for, not a crutch that is always on the screen. Visible pinyin on the answer tiles lets a child match letters to letters and skip the characters.

## Behavior

1. **Default.** Pinyin is hidden on every screen that a child sees during practice.
2. **Toggle.** A "pīn" button sits in the session header. One tap shows pinyin on the prompt and on all answer tiles. A second tap hides it.
3. **Reset.** The toggle turns off when the next question loads. The app does not remember the choice, so each question starts as a reading test. A re-queued question (stay-until-right) also starts with pinyin hidden.
4. **After a correct answer.** Pinyin shows by itself on the correct item. `SentenceBuild` already does this; `PictureChoice` must do the same on the correct Chinese tile and on the audio prompt.
5. **Sentence page.** The same toggle shows the sentence pinyin before the child answers.
6. **Celebrate page.** The praise phrase hides its pinyin. A "pīn" button next to the phrase reveals it. Tapping the phrase itself still plays the audio.
7. **Parent report.** No change. Pinyin stays visible because parents read it.

## Why a separate button

A tap on an answer tile already means "this is my answer". A tap on the audio prompt already plays the sound. A reveal gesture on the same element would collide with those, so the reveal is its own control.

## Code shape

- New component `components/exercise/PinyinToggle.tsx`: a pressed/unpressed button with props `on: boolean` and `onToggle: () => void`. It follows the existing design tokens (`text-chinese`, `shadow-press-*`).
- `app/practice/session/page.tsx` and `app/practice/sentences/page.tsx` each hold one `showPinyin` state. It resets to `false` whenever `currentIndex` changes. The toggle renders in the header area that `ExerciseShell` provides.
- `PictureChoice` takes a new prop `showPinyin: boolean`. `ChineseCard` and `AudioPrompt` render pinyin when `showPinyin` is true, or when the item is the correct answer and the question is answered.
- `SentenceBuild` takes a new prop `showPinyin: boolean`. Its pinyin block renders when the prop is true or when its own correct-answer state is true.
- `app/celebrate/page.tsx` holds its own local `showPinyin` state for the praise phrase.
- No database change, no API change, no content change. Pinyin still comes from the API, so the parent report and a later setting can use it.

## Out of scope

- A parent setting to turn pinyin on permanently. Add it later only if parents ask.
- Tone colors or per-syllable pinyin.

## Checks

The project has no test suite.

1. Run `npx tsc --noEmit` and `npm run lint`. Both must pass.
2. Run `npm run dev` and check in a browser: the word session (all three exercise types), the sentence page, and the celebrate page.
3. On each screen, confirm: pinyin is hidden at load, the toggle shows it, the next question hides it again, and a correct answer shows it.
4. Run `./scripts/build-ios.sh` only with Jenny's approval. The change is plain React, so the web check covers the iOS shell.
