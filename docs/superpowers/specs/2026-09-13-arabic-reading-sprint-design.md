# Harf Sprint - Design Spec

- **Date:** 2026-09-13
- **Status:** Approved (2026-09-14)
- **Working name:** Harf Sprint ("harf" means "letter"). Final name to be confirmed.

## 1. Goal

A responsive web game for practicing reading Arabic.
Players read as many Arabic letters, words or short sentences as they can in a 60-second sprint.
The next item appears the moment the current one is answered.
Scores are saved locally per player and ranked on local leaderboards.

## 2. Players and devices

- A mixed family (kids and adults) sharing one device.
- No accounts and no database: all data lives in the browser's localStorage.
- Target browsers: Chrome and Edge on desktop, Chrome on Android, Safari on iPhone and iPad.
- Interface language: English. Practice content: Arabic.

## 3. Scope

### In scope (v1)

- Player profiles selected by name.
- Three modes: Letters, Words, Sentences.
- 60-second sprints with three speed levels.
- Letters checked by multiple choice; words and sentences checked by speech recognition.
- Local leaderboards per mode, speed level and variant.
- Two content packs for words and sentences: Quranic and Modern Standard Arabic (MSA).
- Settings: sound, rename and delete players, reset all data.
- Hosting on Vercel as a static site.

### Out of scope (v1)

- Accounts, cloud sync, backup or export of data.
- Dark mode (the design deliberately commits to one light look).
- Audio pronunciation of letters or words.
- Hamza and extra letter forms beyond the 28 base letters.
- A "no harakat" level. All words and sentences are fully vowelled.
- Adaptive difficulty, offline/PWA install, Arabic interface.

## 4. Key decisions and evidence

### 4.1 Hybrid answer checking

A speech recognition spike (Chrome 152 desktop, `ar-SA`, one adult voice, 4 runs) measured:

| Content             | Recognized               | Median time to match |
| ------------------- | ------------------------ | -------------------- |
| Words               | 80-93%                   | ~2.5 s               |
| Sentences           | 80-100%                  | ~5 s                 |
| Single letter names | 32-86% depending on mode | ~1.6 s               |

Single letters were unreliable: short utterances were often dropped, and similar letters were confused (ب as ماء, ذ as ظل, ه as حاء, غ as عين).
Therefore:

- **Letters** use multiple choice, which is instant, honest and works everywhere.
- **Words and sentences** use speech recognition, which worked well in testing.
- If speech is unavailable, words and sentences fall back to unranked practice.

### 4.2 Other decisions

- Profiles: pick your name, no PIN.
- Leaderboards: separate per mode, speed level and variant, so kids on easy settings are not ranked against adults on hard ones.
- No backup: clearing browser data wipes profiles and scores. Accepted.
- Wrong answers cost time (a lockout), not points, so random tapping does not pay off and kids never see negative scores.
- Architecture: static client-only SvelteKit app, game logic in pure TypeScript modules.

## 5. Game rules

### 5.1 Sprint structure

1. A 3-2-1 countdown (not counted in the 60 seconds).
2. The sprint runs for 60 seconds of active time.
3. Each item has a per-item time limit set by the speed level.
4. When the sprint time runs out mid-item, that item is not counted as an attempt.
5. If the page becomes hidden (tab switch, phone lock), the sprint pauses.
   The player taps "Continue" to resume, and paused time is not counted.

### 5.2 Speed levels (per-item time limit)

| Level   | Letters | Words | Sentences |
| ------- | ------- | ----- | --------- |
| Relaxed | 6 s     | 10 s  | 20 s      |
| Normal  | 3 s     | 6 s   | 12 s      |
| Fast    | 1.5 s   | 4 s   | 8 s       |

Word and sentence limits are based on the spike's measured recognition times.

### 5.3 Letters mode

- One letter is shown large, with four answer buttons in a 2x2 grid.
- Each button shows the transliterated name and the Arabic name, for example "baa · باء".
  The Arabic name disambiguates letters whose transliterations look alike (حاء "Haa" vs هاء "haa").
- Keyboard: keys 1-4 map to the buttons in reading order (top-left, top-right, bottom-left, bottom-right).
- **Correct:** the next letter appears immediately.
- **Wrong:** the chosen button turns red, the correct button turns green, then a 1.5 s lockout before the next letter.
- **Time limit reached:** treated like a wrong answer (reveal the correct button, then the lockout).
- **Variants:**
  - `isolated`: letters in their standalone shape.
  - `forms`: each letter appears in a random positional form (isolated, initial, medial or final).

### 5.4 Words and sentences modes

- One item is shown on a large card, fully vowelled.
- The microphone listens continuously; a "Listening" indicator and the latest heard text are shown.
- **Match:** the next item appears immediately.
- **Skip button:** counts as a miss, no lockout.
- **Time limit reached:** counts as a miss, no lockout.
- Transliteration and meaning are not shown during the sprint (that would give the answer away).
  They are shown in the results review list.
- **Variants:** `quran` or `msa` content pack.

### 5.5 Scoring

- Letters: +1 per correct answer.
- Words: +1 per matched word.
- Sentences: +1 per word in each matched sentence, so long sentences are not undervalued.
- Accuracy = correct / attempts, where attempts = correct + wrong + timeouts + skips.
- Best streak (consecutive correct) is recorded and shown as a stat.
- No combo multipliers.
- Ranking order: score (high first), then accuracy (high first), then finish time (earlier first).

### 5.6 Unranked practice

Used when speech recognition is unsupported, microphone permission is denied, or the speech service reports a network error.

- Words and sentences are shown the same way, with "Got it" and "Missed" buttons instead of the microphone.
- The results screen is labeled "Practice - not ranked".
- Practice runs are never saved to runs or leaderboards.

## 6. Screens and flow

| Route                         | Screen                                                                                                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                           | **Pick player:** name cards (colored initial, best score), "+ New player", links to Leaderboard and Settings.                                                              |
| `/modes`                      | **Sprint setup:** mode tiles, speed segmented control, variant control (letter shapes or content pack), best score, rank and accuracy on the selected board, Start button. |
| `/play?mode=&level=&variant=` | **Sprint:** countdown, the sprint, then the results view. Query parameters make reloads safe.                                                                              |
| `/leaderboard`                | Mode tabs plus level and variant controls, top 10 for the board, current player's row highlighted.                                                                         |
| `/settings`                   | Sound on/off, rename or delete players, reset all data.                                                                                                                    |

Flow details:

- Selecting a player sets them as the current player (remembered as `lastPlayerId`) and navigates to `/modes`.
- Visiting `/modes` or `/play` without a current player redirects to `/`.
- **New player:** a name field with inline validation (see 8.8).
- **Mic check:** before the first speech sprint in a page session, `/modes` asks the player to say "بِسْمِ اللَّهِ".
  It explains that Chrome sends audio to Google and needs internet.
  Passing continues to the sprint; failure offers retry or unranked practice.
- **Results view:** score, accuracy, best streak, a "New personal best" badge when applicable, the top 3 on the board with the player's row highlighted, a "Review what you missed" list (Arabic, transliteration, meaning), and Home and Again buttons.
  The badge is withheld from a run that scored nothing, which would otherwise be a player's first run on every board.
  The review list shows its first six items and holds the rest behind a "Show all (n)" button, since a Fast sprint can miss enough to push Home and Again off the screen.

## 7. Visual design

Direction: "Sunset Pop, softer" (approved via mockups).
A light peach-to-pink gradient, white floating cards with soft blurred shadows, gradient primary buttons and pill toggles.

### 7.1 Tokens

| Token                        | Value                                                            |
| ---------------------------- | ---------------------------------------------------------------- |
| Background                   | `linear-gradient(170deg, #ffe0cf 0%, #ffc2d4 55%, #f6a3c6 100%)` |
| Ink (text)                   | `#3b1235`                                                        |
| Crimson (primary)            | `#e8175d`, light `#ff4d8a`                                       |
| Purple (selection, progress) | `#7b3fb2`, light `#9656d6`                                       |
| Success (correct)            | `#1fb574`                                                        |
| Surface                      | `#ffffff`                                                        |
| Soft shadow                  | `0 6px 18px rgba(59,18,53,.10)`                                  |
| Primary shadow               | `0 10px 22px rgba(232,23,93,.35)`                                |
| Purple shadow                | `0 8px 18px rgba(123,63,178,.35)`                                |
| Radius                       | cards 20px, item card 28px, buttons 18px, chips and pills 999px  |

### 7.2 Typography

- UI: Rubik (500, 700, 900), bundled via `@fontsource/rubik`.
- Arabic: Noto Naskh Arabic (600, 700), bundled via `@fontsource/noto-naskh-arabic`.
- All Arabic text is marked with `lang="ar"` and `dir="rtl"`.
- The sprint item scales with the viewport using `clamp()`.

### 7.3 Components

- Primary button: crimson gradient, primary shadow, no border.
- Secondary button: white surface, soft shadow.
- Segmented control: translucent white track, active option as a white pill with crimson text.
- Mode tile: white card; selected tile uses the purple gradient with white text.
- Chips: white pill with soft shadow; the timer chip is crimson.
- Player avatar: colored circle with the name's first letter, white 2px ring.
- Item card: white, 28px radius, diffused pink shadow.
- Emoji are not used as icons (they render inconsistently across devices).

### 7.4 Motion and feedback

- The item card pops in (scale 0.94 to 1, 150 ms).
- Correct: the button flashes success green.
- Wrong: the button shakes and turns crimson; the correct button turns green.
- Timer bar shrinks smoothly across the per-item limit.
- `prefers-reduced-motion` disables pop and shake animations.

### 7.5 Layout and accessibility

- Mobile-first single column, centered with a max width of 480px on larger screens, and at least 16px side padding.
- Tap targets are at least 48px tall.
- Visible focus rings on all interactive elements.
- The sprint's feedback (correct, wrong, time up) is announced through an `aria-live="polite"` region.

### 7.6 Sound

- Short synthesized tones (Web Audio API, no audio files) for correct, wrong and time up.
- Toggle in Settings, on by default.
- Speech modes play no sounds while listening, so the microphone never hears the game.

## 8. Architecture

### 8.1 Stack

- SvelteKit 2 with Svelte 5 runes, TypeScript, Tailwind CSS 4.
- `@sveltejs/adapter-static`; the root `+layout.ts` sets `prerender = true` and `ssr = false`.
- Deployed to Vercel as a static site (Vercel serves `adapter-static` output with zero configuration).
- pnpm for all package management and scripts.

### 8.2 Module layout

```
src/lib/
  content/
    types.ts           Letter, Word, Sentence, Pack types
    letters.ts         28 letters: char, name, arabicName, joins
    confusables.ts     shape and sound confusion groups
    packs/quran.ts     Quranic words and sentences
    packs/msa.ts       MSA words and sentences
  game/
    levels.ts          per-item time limits, lockout, sprint duration
    deck.ts            shuffled deck with no immediate repeats
    distractors.ts     picks 3 wrong options for a letter
    forms.ts           positional letter form rendering
    scoring.ts         points, accuracy, streak, ranking comparator
    sprint.ts          pure reducer for sprint state
    sprint.svelte.ts   runes wrapper: clock, visibility pause, listener glue
  speech/
    listener.ts        SpeechListener interface
    web-speech.ts      Web Speech API implementation
    normalize.ts       Arabic text normalization
    match.ts           transcript vs expected item matching
  storage/
    schema.ts          data types, validation, migrations
    store.svelte.ts    repository over localStorage with reactive state
    boards.ts          board keys and leaderboard queries
  audio/sfx.ts         synthesized feedback tones
  ui/                  Button, SegmentedControl, ModeTile, Chip, Avatar,
                       ItemCard, AnswerGrid, TimerBar, MicIndicator,
                       LeaderboardTable, ResultsView
src/routes/
  +layout.svelte, +layout.ts, +page.svelte (pick player)
  modes/+page.svelte
  play/+page.svelte
  leaderboard/+page.svelte
  settings/+page.svelte
```

### 8.3 Sprint engine

A pure reducer with no timers or DOM access, so it is fully unit-testable:

```ts
type SprintEvent =
	| { type: 'tick'; now: number }
	| { type: 'answer'; choice: string; now: number } // letters
	| { type: 'matched'; now: number } // speech match
	| { type: 'skip'; now: number }
	| { type: 'selfReport'; correct: boolean; now: number } // unranked practice
	| { type: 'pause'; now: number }
	| { type: 'resume'; now: number };

type SprintPhase = 'countdown' | 'active' | 'lockout' | 'paused' | 'finished';

function reduce(state: SprintState, event: SprintEvent): SprintState;
```

- `SprintState` holds the config, deck position, current item, item start time, active elapsed time, lockout end, counters (correct, wrong, timeouts, skips, streak, best streak) and missed item ids.
- `sprint.svelte.ts` owns a `requestAnimationFrame` loop that dispatches `tick`, listens to `visibilitychange` for `pause`, and forwards speech matches.
- Randomness (deck shuffle, distractors, forms) is injected as a seeded RNG function for deterministic tests.

### 8.4 Deck

- Items are shuffled into a deck and dealt in order.
- When the deck is exhausted it is reshuffled, with the constraint that the first new item differs from the last dealt item.

### 8.5 Distractors

Confusion groups:

- Shape: ب ت ث ن ي · ج ح خ · د ذ · ر ز · س ش · ص ض · ط ظ · ع غ · ف ق
- Sound: ت ط · د ض · س ص · ث س · ذ ز ظ · ح ه · ك ق · ع ا

For a target letter:

1. Collect every letter sharing a shape or sound group with the target.
2. Pick up to 2 of them at random.
3. Fill the remaining slots with random other letters.
4. Shuffle the 4 options into button positions.

Guarantees: exactly 3 distractors, all unique, never the target.

### 8.6 Letter forms

- Rendered with the zero-width joiner (U+200D): initial = letter + ZWJ, medial = ZWJ + letter + ZWJ, final = ZWJ + letter.
- Non-joining letters (ا د ذ ر ز و) only use isolated and final forms.

### 8.7 Speech module

```ts
interface SpeechListener {
	readonly supported: boolean;
	start(handlers: {
		onTranscript: (t: { text: string; isFinal: boolean }) => void;
		onError: (e: 'not-allowed' | 'network' | 'unsupported' | 'other') => void;
		onListeningChange: (listening: boolean) => void;
	}): void;
	markItemBoundary(): void;
	stop(): void;
}
```

Web Speech implementation, applying spike learnings:

- `lang = 'ar-SA'`, `continuous = true`, `interimResults = true`, `maxAlternatives = 5`.
- One session for the whole sprint, started during the countdown so the microphone is warm.
  Restarted automatically on `end`.
- `markItemBoundary()` records the current result count.
  Only results from index `boundary - 1` onward are reported, because Chrome can append a new answer to the previous item's still-open result.
- `no-speech` errors are ignored (the session restarts).
- `not-allowed` and `network` errors stop the listener; the sprint switches to self-report for its remaining time and is marked unranked (see section 10).

Matching (`match.ts`):

- `normalize` strips harakat, superscript alef, Quranic annotation marks and tatweel; unifies أ إ آ ٱ to ا, ة to ه, ى and ئ to ي, ؤ to و; removes standalone hamza and punctuation; collapses whitespace.
- Only the tail of a transcript is compared: the last `expectedWordCount + 2` tokens.
- A word matches when its normalized token appears in the tail.
- A sentence matches when all of its normalized words appear in the tail, except that a final result for a sentence of three or more words may miss one of them.
- The one-word allowance applies only to final results.
  Measured against the shipped packs, an 80% ratio forgave a word in just 4 of 26 Quranic sentences and none of the 26 MSA ones, because most are two to four words long; the allowance is stated directly so its effect is visible.
  Interim results are excluded because a word missing from an open result usually means "not said yet" rather than "not recognized", and forgiving it would score the reader before the end of the sentence.
- Interim results count, so the game advances as early as possible.

### 8.8 Storage

A single localStorage key, `harf-sprint:v1`:

```ts
type StoredData = {
	version: 1;
	players: { id: string; name: string; createdAt: string }[];
	lastPlayerId: string | null;
	runs: Run[]; // newest first, capped at 1000
	bests: Record<BoardKey, Record<PlayerId, Run>>;
	settings: { sound: boolean };
};

type Run = {
	id: string;
	playerId: string;
	board: BoardKey; // `${mode}:${level}:${variant}`
	score: number;
	correct: number;
	attempts: number;
	bestStreak: number;
	missed: string[]; // item ids
	finishedAt: string; // ISO timestamp
};
```

- Ids use `crypto.randomUUID()`.
- Every write reads, modifies and writes the whole object.
- The `storage` event reloads state when another tab changes the data.
- **Validation on load:** unparseable or invalid data is copied to `harf-sprint:corrupt:<timestamp>`, the app starts with empty data, and a notice explains the reset.
- **Migrations:** `migrate(raw)` upgrades by `version`; v1 is the first version.
- **Write failure** (for example quota exceeded): a notice is shown, the run is not saved, the game keeps working.
- **Run cap:** the oldest runs beyond 1000 are dropped; `bests` is stored separately, so bests are never lost.
- **Player names:** trimmed, internal spaces collapsed, 1-20 characters, unique ignoring case, any script allowed.
- **Rename** keeps the player id, so scores stay attached.
- **Delete** (with confirmation) removes the player, their runs and their bests.
- **Reset all data** (with confirmation) removes the key.

### 8.9 Leaderboards

- Board key: `${mode}:${level}:${variant}`.
  Letters variants: `isolated`, `forms`. Words and sentences variants: `quran`, `msa`.
  That is 3 modes × 3 levels × 2 variants = 18 boards.
- A board lists each player's best run, sorted by the ranking order in 5.5, top 10.
- The current player's row is highlighted, and shown below the top 10 with their rank if they are outside it.

## 9. Content

### 9.1 Letters

28 base letters, each with: character, transliterated name, Arabic name, and whether it joins to the next letter.

### 9.2 Word and sentence packs

```ts
type Word = { id: string; text: string; translit: string; meaning: string };
type Sentence = { id: string; text: string; translit: string; meaning: string; source?: string };
type Pack = { id: 'quran' | 'msa'; name: string; words: Word[]; sentences: Sentence[] };
```

- About 80 words and 25 sentences per pack.
- Sentences have at most 6 words.
- Fully vowelled standard Unicode Arabic (no Uthmani-specific marks), which keeps the font and the matcher consistent.
- Quranic sentences carry a `source` reference (surah:ayah) where applicable.
- Content is drafted by Claude and must be reviewed by the user or a fluent reader before Phase 2 is released.

### 9.3 Content validation (automated)

- Every item contains Arabic letters and at least one harakah.
- No duplicate ids or texts within a pack.
- Sentences have 2-6 words.
- Every item's normalized text is non-empty and matches itself through `match.ts`.

## 10. Error handling and edge cases

| Situation                                    | Behavior                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| Speech API unsupported (e.g. Firefox)        | Words and sentences offer unranked practice; letters unaffected.                  |
| Microphone permission denied                 | Mic check explains how to allow it; offers unranked practice.                     |
| Speech network error mid-sprint              | Sprint switches to self-report for the rest of the sprint and is marked unranked. |
| Tab hidden                                   | Sprint pauses; "Continue" resumes.                                                |
| Corrupt stored data                          | Backed up under a corrupt key, fresh start, notice shown.                         |
| localStorage write fails                     | Notice shown, run not saved, game continues.                                      |
| No current player on `/modes` or `/play`     | Redirect to `/`.                                                                  |
| Invalid `/play` query parameters             | Redirect to `/modes`.                                                             |
| Deleted player still selected in another tab | `storage` event clears the selection; redirect to `/`.                            |

## 11. Testing

### 11.1 Unit tests (Vitest, node project)

- `sprint.ts`: countdown, per-item timeouts, lockout timing, sprint ending mid-item, pause and resume excluding paused time, scoring per mode, streaks, unranked self-report.
- `deck.ts`: full deck before repeats, no immediate repeat across reshuffles.
- `distractors.ts`: 3 unique distractors, never the target, confusables included when available.
- `forms.ts`: correct ZWJ placement, non-joiners limited to isolated and final.
- `normalize.ts` and `match.ts`: fixtures built from the spike's real transcripts, including the merged-result cases (for example "شن ص" must match ص and not ش).
- `schema.ts` and `store.svelte.ts`: validation, corruption recovery, migration hook, run cap preserving bests, rename, delete, name rules.
- `boards.ts`: ranking order and tie-breaks.
- Content validation (9.3).

### 11.2 End-to-end tests (Playwright)

- Create a player, run a letters sprint with `page.clock` fast-forwarding time, answer with keys 1-4, see results, see the player on the leaderboard, reload and confirm persistence.
- Duplicate name is rejected.
- Tab hidden pauses the sprint.
- Words sprint with a fake `SpeechRecognition` class injected via `addInitScript`, so the real `web-speech.ts` code runs.
- Permission denied path leads to unranked practice, and the run does not appear on the leaderboard.
- Screens render at a phone viewport (390×844) and a desktop viewport, with screenshots reviewed.

### 11.3 Manual device checks (before Phase 2 release)

- Speech sprints on Chrome desktop, Edge, Android Chrome and iOS Safari via the Vercel HTTPS deployment.
- At least one child reading a words sprint.

### 11.4 Quality gates

`pnpm lint`, `pnpm check`, `pnpm test:unit --run` and `pnpm test:e2e` all pass with no warnings.

## 12. Delivery phases

### Phase 1: Letters (playable on its own)

1. Housekeeping (section 13).
2. Theme tokens, fonts and UI components.
3. Storage, profiles and the pick player screen.
4. Letters content, distractors, forms, deck and the sprint engine.
5. Sprint setup, sprint and results screens.
6. Leaderboard and settings screens.
7. Unit and end-to-end tests for all of the above.
8. First Vercel deployment.

### Phase 2: Words and sentences

1. Quranic and MSA content packs drafted, then reviewed by the user (release gate).
2. Speech module, matcher and fixtures.
3. Mic check and unranked practice.
4. Words and sentences in setup, sprint, results and leaderboards.
5. Unit and end-to-end tests.
6. Manual device checks (11.3).

## 13. Housekeeping

- Change `package.json` scripts from `npm run` to `pnpm` (including the `test` script), and the Playwright `webServer` command.
- Replace `@sveltejs/adapter-auto` with `@sveltejs/adapter-static`.
- Remove the scaffold demo routes (`src/routes/demo`) and `src/lib/vitest-examples`.
- Remove the throwaway spike (`src/routes/spike`) after copying its transcripts into test fixtures.
- Set the page title and favicon.

## 14. Open items

- Final app name (working name: Harf Sprint). The storage key uses the name, so decide before Phase 1 ships.
- Content review by a fluent reader (Phase 2 release gate).
- Speech behavior on Android Chrome and iOS Safari is untested; a Safari-specific adjustment may be needed.
- Recognition accuracy for children's voices is untested; Skip and the per-item time limit keep the game playable either way.
