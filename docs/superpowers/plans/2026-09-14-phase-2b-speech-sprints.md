# Harf Sprint Phase 2B (Words and Sentences with Speech) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Words and Sentences playable: read items aloud and have the browser's speech recognition check them, with a mic check, unranked practice when speech is unavailable, results and leaderboards.

**Architecture:** The pure sprint reducer gains a text prompt next to the letter prompt, plus `matched`, `skip`, `selfReport` and `speechLost` events and a `ranked` flag, so all rules stay unit-tested without a browser.
A `SpeechListener` interface wraps the Web Speech API (`web-speech.ts`, unit-tested against a fake recognition class); the rAF runner connects it to the reducer and matches transcripts with Phase 2A's `matchTranscript`.
Screens reuse the Phase 1 components; e2e tests inject a fake `SpeechRecognition` with `page.addInitScript`, so the real listener code runs.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript (strict), Tailwind CSS 4, Vitest 4 (node), Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-13-arabic-reading-sprint-design.md` (sections 5.4 to 5.6, 6, 7.3, 7.6, 8.3, 8.7, 10, 11, 12 Phase 2).

**Prerequisite:** Phase 2A (`docs/superpowers/plans/2026-09-14-phase-2a-content-and-matching.md`) Tasks 1 to 3 are merged: `normalizeArabic`, `matchTranscript`, `wordCount`, and `PACKS` with at least the starter packs exist.

## Global Constraints

- Package manager: pnpm only. Never run npm or yarn.
- Never use the em dash character in code, comments, copy or docs.
- Svelte 5 runes only. Every internal `href` and `goto()` uses `resolve()` from `$app/paths`.
- All Arabic text is rendered with `lang="ar"` and `dir="rtl"`; player names use `dir="auto"`.
- Layout: mobile-first, max width 480px, at least 16px side padding, tap targets at least 48px, visible focus rings, `prefers-reduced-motion` disables animations, no emoji icons, no dark mode, text meets WCAG AA contrast (use the existing `crimson-deep` and `text-ink/75` patterns).
- Per-item time limits (spec 5.2): words Relaxed 10 s, Normal 6 s, Fast 4 s; sentences Relaxed 20 s, Normal 12 s, Fast 8 s. Sprint 60 s, countdown 3 s.
- Words and sentences (spec 5.4): a match shows the next item immediately; Skip and the time limit count as a miss with no lockout. Scoring (spec 5.5): +1 per matched word; +1 per word in each matched sentence.
- Speech (spec 8.7): `lang = 'ar-SA'`, `continuous = true`, `interimResults = true`, `maxAlternatives = 5`; one session per sprint, started during the countdown, restarted on `end`; `no-speech` errors ignored; `not-allowed` and `network` stop the listener, and the sprint switches to self-report for its remaining time and is unranked. Interim results count.
- Unranked practice (spec 5.6): "Got it" and "Missed" buttons; the results screen is labeled "Practice - not ranked"; practice runs are never saved to runs or leaderboards.
- Mic check (spec 6): before the first speech sprint in a page session, `/modes` asks the player to say "بِسْمِ اللَّهِ", explains that Chrome sends audio to Google and needs internet; passing continues to the sprint; failure offers retry or unranked practice.
- Sound (spec 7.6): speech sprints play no sounds while listening.
- `/play` query parameters: `mode`, `level`, `variant`, and `practice=1` for practice. Reloads stay safe.
- Testing rules for this project: e2e tests seed localStorage with `page.addInitScript` (guarded so a later navigation does not overwrite saved data); the sprint clock is paused with the `pauseClock` helper and moved with `page.clock.fastForward`; flakiness is fixed at its cause, never with retries or longer timeouts. Run commands in the foreground.
- Arabic string literals in code must be copied exactly from this plan (programmatically, not retyped).
- Commit messages end with a blank line and `Claude-Session: https://claude.ai/code/session_01QWMbjMc8aiczKFP1fL5faM`. Never add a Co-Authored-By line.
- Quality gates, all passing with no warnings: `pnpm lint`, `pnpm check`, `pnpm test:unit --run`, `pnpm test:e2e`.

## File Map

```
src/lib/game/
  prompts.ts              LetterPrompt, TextPrompt, dealing helpers (Task 1)
  sprint.ts               text prompts, speech events, input and ranked (Task 1)
  review.ts               missed-item review rows for every mode (Task 3)
  sprint.svelte.ts        runner drives an optional SpeechListener (Task 4)
src/lib/speech/
  listener.ts             SpeechListener interface (Task 2)
  web-speech.ts           Web Speech API implementation (Task 2)
  session.ts              mic check passed in this page session (Task 5)
src/lib/ui/
  ResultsView.svelte      practice label, text review list (Task 3)
  ItemCard.svelte         word and sentence sizes (Task 4)
  MicIndicator.svelte     Listening indicator and latest heard text (Task 4)
  MicCheck.svelte         mic check panel (Task 5)
src/routes/
  play/+page.svelte       speech, skip, practice buttons (Tasks 1, 3, 4)
  modes/+page.svelte      Words and Sentences setup, mic check (Task 5)
  leaderboard/+page.svelte  words and sentences boards (Task 6)
tests/e2e/
  helpers.ts              + seedPlayer (Task 4)
  speech.ts               fake SpeechRecognition and helpers (Task 4)
  speech-sprint.e2e.ts    (Task 4)
  mic-check.e2e.ts        (Task 5)
  modes.e2e.ts, leaderboard.e2e.ts, screens.e2e.ts  updated (Tasks 5, 6)
```

---

### Task 1: Sprint engine for words and sentences

Spec 5.4 to 5.6, 8.3 and 8.4.
Letters behavior must not change: all existing tests keep passing, with the small type-narrowing edits in Step 5.

**Files:**

- Create: `src/lib/game/prompts.ts`, `src/lib/game/prompts.spec.ts`, `src/lib/game/sprint-text.spec.ts`
- Modify: `src/lib/game/sprint.ts` (full replacement), `src/lib/game/sprint.spec.ts` (narrowing edits), `src/routes/play/+page.svelte` (one wrap)

**Interfaces:**

- Consumes: `LETTER_CHARS`, `letterByChar` (`src/lib/content/letters.ts`); `PACKS` (`src/lib/content/packs/index.ts`); `Word`, `Sentence` (`src/lib/content/types.ts`); `wordCount`, `MatchKind` (`src/lib/speech/match.ts`); `buildChoices`, `formsFor`, `renderForm`, `pick`, `draw`, `newDeck`, levels and scoring exports as used by the current `sprint.ts`
- Produces (`prompts.ts`):
  - `type TextMode = 'words' | 'sentences'`
  - `type LetterPrompt = { kind: 'letter'; id: string; form: Form; display: string; choices: readonly string[] }`
  - `type TextPrompt = { kind: 'text'; id: string; display: string; matchKind: MatchKind; points: number }`
  - `type Prompt = LetterPrompt | TextPrompt`
  - `textItems(mode: TextMode, variant: PackVariant): readonly (Word | Sentence)[]`
  - `textItem(mode: TextMode, variant: PackVariant, id: string): Word | Sentence` (throws on unknown id)
  - `letterPrompt(char: string, variant: LetterVariant, rng: Rng): LetterPrompt`
  - `textPrompt(mode: TextMode, variant: PackVariant, id: string): TextPrompt`
- Produces (`sprint.ts`):
  - `type SprintConfig = { mode: 'letters'; level; variant: LetterVariant; rng } | { mode: TextMode; level; variant: PackVariant; rng; practice: boolean }`
  - `type SprintInput = 'choices' | 'speech' | 'selfReport'`
  - `SprintState` gains `input: SprintInput` and `ranked: boolean`; `prompt` becomes `Prompt`
  - `SprintEvent` gains `{ type: 'matched'; now }`, `{ type: 'skip'; now }`, `{ type: 'selfReport'; correct: boolean; now }`, `{ type: 'speechLost'; now }`
  - `Outcome` gains `'skip'`
  - Re-exports `LetterPrompt`, `TextPrompt`, `Prompt` types; `createSprint`, `reduce`, `itemLimit`, `outcomeBetween` keep their signatures

- [ ] **Step 1: Write the failing prompt tests**

Create `src/lib/game/prompts.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PACKS } from '$lib/content/packs';
import { wordCount } from '$lib/speech/match';
import { letterPrompt, textItem, textItems, textPrompt } from './prompts';
import { mulberry32 } from './rng';

describe('letterPrompt', () => {
	it('builds an isolated letter with 4 choices including the letter', () => {
		const prompt = letterPrompt('ب', 'isolated', mulberry32(1));
		expect(prompt).toMatchObject({ kind: 'letter', id: 'ب', form: 'isolated', display: 'ب' });
		expect(prompt.choices).toHaveLength(4);
		expect(prompt.choices).toContain('ب');
	});
});

describe('text prompts', () => {
	it('lists the words or sentences of a pack', () => {
		expect(textItems('words', 'quran')).toBe(PACKS.quran.words);
		expect(textItems('sentences', 'msa')).toBe(PACKS.msa.sentences);
	});

	it('builds a word prompt worth 1 point', () => {
		const item = PACKS.quran.words[0];
		expect(textPrompt('words', 'quran', item.id)).toEqual({
			kind: 'text',
			id: item.id,
			display: item.text,
			matchKind: 'word',
			points: 1
		});
	});

	it('builds a sentence prompt worth 1 point per word', () => {
		const item = PACKS.msa.sentences[0];
		expect(textPrompt('sentences', 'msa', item.id)).toEqual({
			kind: 'text',
			id: item.id,
			display: item.text,
			matchKind: 'sentence',
			points: wordCount(item.text)
		});
	});

	it('rejects unknown ids', () => {
		expect(() => textItem('words', 'quran', 'nope')).toThrow();
	});
});
```

- [ ] **Step 2: Write the failing text sprint tests**

Create `src/lib/game/sprint-text.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PACKS } from '$lib/content/packs';
import { wordCount } from '$lib/speech/match';
import { COUNTDOWN_MS } from './levels';
import { mulberry32 } from './rng';
import { attempts } from './scoring';
import {
	createSprint,
	outcomeBetween,
	reduce,
	type SprintConfig,
	type SprintState
} from './sprint';

type TextConfig = Extract<SprintConfig, { mode: 'words' | 'sentences' }>;

const textConfig = (overrides: Partial<TextConfig> = {}): TextConfig => ({
	mode: 'words',
	level: 'normal',
	variant: 'quran',
	rng: mulberry32(1),
	practice: false,
	...overrides
});

/** A text sprint that just left the countdown at now = 3000 (normal words: 6000 ms per item). */
const activeText = (overrides: Partial<TextConfig> = {}) =>
	reduce(createSprint(textConfig(overrides), 0), { type: 'tick', now: COUNTDOWN_MS });

const textOf = (s: SprintState) => {
	if (s.prompt.kind !== 'text') throw new Error('Expected a text prompt');
	return s.prompt;
};

describe('text sprint setup', () => {
	it('deals pack words for speech and ranks the run', () => {
		const s = createSprint(textConfig(), 0);
		expect(s).toMatchObject({ phase: 'countdown', input: 'speech', ranked: true, itemLeft: 6_000 });
		const prompt = textOf(s);
		expect(PACKS.quran.words.find((word) => word.id === prompt.id)?.text).toBe(prompt.display);
		expect(prompt).toMatchObject({ matchKind: 'word', points: 1 });
	});

	it('scores sentences by word count with the sentence time limit', () => {
		const s = createSprint(textConfig({ mode: 'sentences', variant: 'msa' }), 0);
		const prompt = textOf(s);
		const item = PACKS.msa.sentences.find((sentence) => sentence.id === prompt.id);
		expect(item).toBeDefined();
		expect(prompt).toMatchObject({ matchKind: 'sentence', points: wordCount(item!.text) });
		expect(s.itemLeft).toBe(12_000);
	});

	it('starts practice on self-report, unranked', () => {
		expect(createSprint(textConfig({ practice: true }), 0)).toMatchObject({
			input: 'selfReport',
			ranked: false
		});
	});

	it('keeps letters sprints on choices, ranked', () => {
		const s = createSprint(
			{ mode: 'letters', level: 'normal', variant: 'isolated', rng: mulberry32(1) },
			0
		);
		expect(s).toMatchObject({ input: 'choices', ranked: true });
	});
});

describe('speech answers', () => {
	it('ignores a match during the countdown', () => {
		const s = createSprint(textConfig(), 0);
		expect(reduce(s, { type: 'matched', now: 1_000 })).toMatchObject({
			phase: 'countdown',
			score: 0
		});
	});

	it('scores a match with the prompt points and deals the next item without a lockout', () => {
		const s = activeText({ mode: 'sentences' });
		const points = textOf(s).points;
		const next = reduce(s, { type: 'matched', now: 4_000 });
		expect(next).toMatchObject({
			phase: 'active',
			score: points,
			itemLeft: 12_000,
			sprintLeft: 59_000
		});
		expect(next.counters).toMatchObject({ correct: 1, streak: 1 });
		expect(next.prompt.id).not.toBe(s.prompt.id);
	});

	it('ignores letter answers and self-reports in a speech sprint', () => {
		const s = activeText();
		expect(reduce(s, { type: 'answer', choice: s.prompt.id, now: 3_100 }).score).toBe(0);
		expect(reduce(s, { type: 'selfReport', correct: true, now: 3_100 }).score).toBe(0);
	});

	it('skips to the next item as a miss without a lockout', () => {
		const s = activeText();
		const next = reduce(s, { type: 'skip', now: 3_500 });
		expect(next).toMatchObject({
			phase: 'active',
			score: 0,
			missed: [s.prompt.id],
			itemLeft: 6_000
		});
		expect(next.counters).toMatchObject({ skips: 1, streak: 0 });
		expect(next.prompt.id).not.toBe(s.prompt.id);
	});

	it('moves on after a timeout without a lockout', () => {
		const s = activeText();
		const next = reduce(s, { type: 'tick', now: 9_000 });
		expect(next).toMatchObject({
			phase: 'active',
			missed: [s.prompt.id],
			itemLeft: 6_000,
			sprintLeft: 54_000
		});
		expect(next.counters.timeouts).toBe(1);
	});

	it('does not count the item in progress when time runs out', () => {
		const s = reduce(activeText(), { type: 'tick', now: 63_000 });
		expect(s.phase).toBe('finished');
		expect(s.counters.timeouts).toBe(9);
		expect(attempts(s.counters)).toBe(9);
	});
});

describe('speech loss', () => {
	it('switches to self-report and unranked for the rest of the sprint', () => {
		const s = reduce(activeText(), { type: 'speechLost', now: 3_500 });
		expect(s).toMatchObject({ phase: 'active', input: 'selfReport', ranked: false });
		expect(reduce(s, { type: 'matched', now: 3_600 }).score).toBe(0);
		expect(reduce(s, { type: 'selfReport', correct: true, now: 3_600 }).score).toBe(1);
	});

	it('keeps a sprint ranked when speech stops as it ends', () => {
		expect(reduce(activeText(), { type: 'speechLost', now: 70_000 })).toMatchObject({
			phase: 'finished',
			input: 'speech',
			ranked: true
		});
	});

	it('changes nothing in practice or letters sprints', () => {
		const practice = activeText({ practice: true });
		expect(reduce(practice, { type: 'speechLost', now: 3_500 })).toMatchObject({
			input: 'selfReport',
			ranked: false
		});
		const letters = reduce(
			createSprint(
				{ mode: 'letters', level: 'normal', variant: 'isolated', rng: mulberry32(1) },
				0
			),
			{ type: 'speechLost', now: 1_000 }
		);
		expect(letters).toMatchObject({ input: 'choices', ranked: true });
	});
});

describe('practice self-report', () => {
	it('scores Got it and counts Missed as a miss without a lockout', () => {
		const s = activeText({ practice: true });
		const got = reduce(s, { type: 'selfReport', correct: true, now: 3_500 });
		expect(got).toMatchObject({ phase: 'active', score: 1 });
		const missed = reduce(got, { type: 'selfReport', correct: false, now: 3_600 });
		expect(missed).toMatchObject({ phase: 'active', score: 1, missed: [got.prompt.id] });
		expect(missed.counters).toMatchObject({ correct: 1, wrong: 1 });
		expect(attempts(missed.counters)).toBe(2);
		expect(reduce(s, { type: 'matched', now: 3_500 }).score).toBe(0);
	});
});

describe('text deck', () => {
	it('never shows the same item twice in a row', () => {
		let s = activeText({ rng: mulberry32(4) });
		let previous = s.prompt.id;
		for (let i = 1; i <= 40; i++) {
			s = reduce(s, { type: 'skip', now: COUNTDOWN_MS + i * 10 });
			expect(s.prompt.id).not.toBe(previous);
			previous = s.prompt.id;
		}
	});
});

describe('outcomeBetween for text sprints', () => {
	it('reports skips and matches', () => {
		const s = activeText();
		expect(outcomeBetween(s, reduce(s, { type: 'skip', now: 3_100 }))).toBe('skip');
		expect(outcomeBetween(s, reduce(s, { type: 'matched', now: 3_100 }))).toBe('correct');
	});
});
```

- [ ] **Step 3: Run to verify both fail**

Run: `pnpm test:unit --run src/lib/game/prompts.spec.ts src/lib/game/sprint-text.spec.ts`
Expected: FAIL, cannot resolve `./prompts`, and type or assertion failures for the new sprint events.

- [ ] **Step 4: Implement `src/lib/game/prompts.ts` and replace `src/lib/game/sprint.ts`**

Create `src/lib/game/prompts.ts`:

```ts
import { LETTER_CHARS, letterByChar } from '$lib/content/letters';
import { PACKS } from '$lib/content/packs';
import type { Sentence, Word } from '$lib/content/types';
import { wordCount, type MatchKind } from '$lib/speech/match';
import { buildChoices } from './distractors';
import { formsFor, renderForm, type Form } from './forms';
import type { LetterVariant, PackVariant } from './levels';
import { pick, type Rng } from './rng';

export type TextMode = 'words' | 'sentences';

export type LetterPrompt = {
	kind: 'letter';
	/** The letter character; also the correct choice. */
	id: string;
	form: Form;
	/** Text to render, including zero-width joiners for positional forms. */
	display: string;
	choices: readonly string[];
};

export type TextPrompt = {
	kind: 'text';
	/** The pack item id. */
	id: string;
	/** Fully vowelled Arabic to read aloud. */
	display: string;
	matchKind: MatchKind;
	/** Words score 1; sentences score 1 per word (spec 5.5). */
	points: number;
};

export type Prompt = LetterPrompt | TextPrompt;

export function textItems(mode: TextMode, variant: PackVariant): readonly (Word | Sentence)[] {
	return mode === 'words' ? PACKS[variant].words : PACKS[variant].sentences;
}

export function textItem(mode: TextMode, variant: PackVariant, id: string): Word | Sentence {
	const item = textItems(mode, variant).find((candidate) => candidate.id === id);
	if (!item) throw new Error(`Unknown ${mode} item: ${id}`);
	return item;
}

export function letterPrompt(char: string, variant: LetterVariant, rng: Rng): LetterPrompt {
	const letter = letterByChar(char);
	const form = variant === 'forms' ? pick(formsFor(letter), rng) : 'isolated';
	return {
		kind: 'letter',
		id: letter.char,
		form,
		display: renderForm(letter.char, form),
		choices: buildChoices(letter.char, LETTER_CHARS, rng)
	};
}

export function textPrompt(mode: TextMode, variant: PackVariant, id: string): TextPrompt {
	const item = textItem(mode, variant, id);
	return {
		kind: 'text',
		id: item.id,
		display: item.text,
		matchKind: mode === 'words' ? 'word' : 'sentence',
		points: mode === 'words' ? 1 : wordCount(item.text)
	};
}
```

Replace `src/lib/game/sprint.ts` with:

```ts
import { LETTER_CHARS } from '$lib/content/letters';
import { draw, newDeck, type Deck } from './deck';
import {
	COUNTDOWN_MS,
	ITEM_LIMIT_MS,
	LOCKOUT_MS,
	SPRINT_MS,
	type Level,
	type LetterVariant,
	type PackVariant
} from './levels';
import { letterPrompt, textItems, textPrompt, type Prompt, type TextMode } from './prompts';
import type { Rng } from './rng';
import { ZERO_COUNTERS, recordCorrect, recordMiss, type Counters } from './scoring';

export type { LetterPrompt, Prompt, TextPrompt } from './prompts';

export type SprintConfig =
	| { mode: 'letters'; level: Level; variant: LetterVariant; rng: Rng }
	| {
			mode: TextMode;
			level: Level;
			variant: PackVariant;
			rng: Rng;
			/** Unranked practice: the player reports each item with buttons instead of speaking (spec 5.6). */
			practice: boolean;
	  };

/** How the player answers: letter choices, speech, or the Got it and Missed buttons. */
export type SprintInput = 'choices' | 'speech' | 'selfReport';

export type SprintPhase = 'countdown' | 'active' | 'lockout' | 'paused' | 'finished';
type RunningPhase = 'countdown' | 'active' | 'lockout';

export type Reveal = { chosen: string | null; correct: string };

export type SprintState = {
	readonly config: SprintConfig;
	readonly phase: SprintPhase;
	readonly resumeTo: RunningPhase | null;
	readonly lastEventAt: number;
	readonly countdownLeft: number;
	readonly sprintLeft: number;
	readonly itemLeft: number;
	readonly lockoutLeft: number;
	readonly input: SprintInput;
	/** False for practice and after speech stops mid-sprint; unranked runs are never saved. */
	readonly ranked: boolean;
	readonly deck: Deck<string>;
	readonly prompt: Prompt;
	readonly reveal: Reveal | null;
	readonly counters: Counters;
	readonly score: number;
	readonly missed: readonly string[];
};

export type SprintEvent =
	| { type: 'tick'; now: number }
	| { type: 'answer'; choice: string; now: number }
	| { type: 'matched'; now: number }
	| { type: 'skip'; now: number }
	| { type: 'selfReport'; correct: boolean; now: number }
	| { type: 'speechLost'; now: number }
	| { type: 'pause'; now: number }
	| { type: 'resume'; now: number };

export type Outcome = 'correct' | 'wrong' | 'timeout' | 'skip' | 'finished';

export function itemLimit(config: SprintConfig): number {
	return ITEM_LIMIT_MS[config.mode][config.level];
}

function deckItems(config: SprintConfig): readonly string[] {
	return config.mode === 'letters'
		? LETTER_CHARS
		: textItems(config.mode, config.variant).map((item) => item.id);
}

function deal(deck: Deck<string>, config: SprintConfig): { deck: Deck<string>; prompt: Prompt } {
	const drawn = draw(deck, config.rng);
	const prompt =
		config.mode === 'letters'
			? letterPrompt(drawn.item, config.variant, config.rng)
			: textPrompt(config.mode, config.variant, drawn.item);
	return { deck: drawn.deck, prompt };
}

export function createSprint(config: SprintConfig, now: number): SprintState {
	const { deck, prompt } = deal(newDeck(deckItems(config), config.rng), config);
	const practice = config.mode !== 'letters' && config.practice;
	return {
		config,
		phase: 'countdown',
		resumeTo: null,
		lastEventAt: now,
		countdownLeft: COUNTDOWN_MS,
		sprintLeft: SPRINT_MS,
		itemLeft: itemLimit(config),
		lockoutLeft: 0,
		input: config.mode === 'letters' ? 'choices' : practice ? 'selfReport' : 'speech',
		ranked: !practice,
		deck,
		prompt,
		reveal: null,
		counters: ZERO_COUNTERS,
		score: 0,
		missed: []
	};
}

function nextItem(state: SprintState): SprintState {
	const { deck, prompt } = deal(state.deck, state.config);
	return {
		...state,
		phase: 'active',
		deck,
		prompt,
		reveal: null,
		itemLeft: itemLimit(state.config),
		lockoutLeft: 0
	};
}

function withMissed(missed: readonly string[], id: string): readonly string[] {
	return missed.includes(id) ? missed : [...missed, id];
}

function scoreAndNext(state: SprintState): SprintState {
	const points = state.prompt.kind === 'text' ? state.prompt.points : 1;
	return nextItem({
		...state,
		score: state.score + points,
		counters: recordCorrect(state.counters)
	});
}

/** Letters reveal the answer and lock out for 1.5 s (spec 5.3). */
function lockoutMiss(
	state: SprintState,
	kind: 'wrong' | 'timeouts',
	chosen: string | null
): SprintState {
	return {
		...state,
		phase: 'lockout',
		lockoutLeft: LOCKOUT_MS,
		reveal: { chosen, correct: state.prompt.id },
		counters: recordMiss(state.counters, kind),
		missed: withMissed(state.missed, state.prompt.id)
	};
}

/** Words and sentences never lock out: a miss moves straight to the next item (spec 5.4). */
function moveOnMiss(state: SprintState, kind: 'wrong' | 'timeouts' | 'skips'): SprintState {
	return nextItem({
		...state,
		counters: recordMiss(state.counters, kind),
		missed: withMissed(state.missed, state.prompt.id)
	});
}

function timeout(state: SprintState): SprintState {
	return state.prompt.kind === 'letter'
		? lockoutMiss(state, 'timeouts', null)
		: moveOnMiss(state, 'timeouts');
}

/** Moves the clocks forward to `now`, applying every transition that happens on the way. */
function advance(state: SprintState, now: number): SprintState {
	let dt = Math.max(0, now - state.lastEventAt);
	let s: SprintState = { ...state, lastEventAt: now };
	while (dt > 0) {
		if (s.phase === 'countdown') {
			const step = Math.min(dt, s.countdownLeft);
			dt -= step;
			s = { ...s, countdownLeft: s.countdownLeft - step };
			if (s.countdownLeft === 0) s = { ...s, phase: 'active' };
		} else if (s.phase === 'active') {
			const step = Math.min(dt, s.sprintLeft, s.itemLeft);
			dt -= step;
			s = { ...s, sprintLeft: s.sprintLeft - step, itemLeft: s.itemLeft - step };
			if (s.sprintLeft === 0) s = { ...s, phase: 'finished' };
			else if (s.itemLeft === 0) s = timeout(s);
		} else if (s.phase === 'lockout') {
			const step = Math.min(dt, s.sprintLeft, s.lockoutLeft);
			dt -= step;
			s = { ...s, sprintLeft: s.sprintLeft - step, lockoutLeft: s.lockoutLeft - step };
			if (s.sprintLeft === 0) s = { ...s, phase: 'finished', reveal: null };
			else if (s.lockoutLeft === 0) s = nextItem(s);
		} else {
			break;
		}
	}
	return s;
}

export function reduce(state: SprintState, event: SprintEvent): SprintState {
	if (state.phase === 'finished') return state;
	switch (event.type) {
		case 'tick':
			// Paused time never counts because resume resets lastEventAt, so the same object is kept and nothing re-renders.
			return state.phase === 'paused' ? state : advance(state, event.now);
		case 'answer': {
			const s = advance(state, event.now);
			if (s.phase !== 'active' || s.prompt.kind !== 'letter') return s;
			return event.choice === s.prompt.id ? scoreAndNext(s) : lockoutMiss(s, 'wrong', event.choice);
		}
		case 'matched': {
			const s = advance(state, event.now);
			return s.phase === 'active' && s.input === 'speech' ? scoreAndNext(s) : s;
		}
		case 'skip': {
			const s = advance(state, event.now);
			return s.phase === 'active' && s.prompt.kind === 'text' ? moveOnMiss(s, 'skips') : s;
		}
		case 'selfReport': {
			const s = advance(state, event.now);
			if (s.phase !== 'active' || s.input !== 'selfReport') return s;
			return event.correct ? scoreAndNext(s) : moveOnMiss(s, 'wrong');
		}
		case 'speechLost': {
			const s = advance(state, event.now);
			if (s.phase === 'finished' || s.input !== 'speech') return s;
			return { ...s, input: 'selfReport', ranked: false };
		}
		case 'pause': {
			const s = advance(state, event.now);
			if (s.phase === 'paused' || s.phase === 'finished') return s;
			return { ...s, phase: 'paused', resumeTo: s.phase };
		}
		case 'resume':
			if (state.phase !== 'paused' || state.resumeTo === null) return state;
			return { ...state, phase: state.resumeTo, resumeTo: null, lastEventAt: event.now };
	}
}

export function outcomeBetween(prev: SprintState, next: SprintState): Outcome | null {
	if (next.phase === 'finished' && prev.phase !== 'finished') return 'finished';
	if (next.counters.correct > prev.counters.correct) return 'correct';
	if (next.counters.wrong > prev.counters.wrong) return 'wrong';
	if (next.counters.timeouts > prev.counters.timeouts) return 'timeout';
	if (next.counters.skips > prev.counters.skips) return 'skip';
	return null;
}
```

The letter prompt consumes the RNG in the same order as before (deck draw, form pick, choices), so every seeded letters test keeps its expectations.

- [ ] **Step 5: Update the letters tests and the play page for the prompt union**

`SprintState.prompt` is now `LetterPrompt | TextPrompt`, so code that reads `choices` or `form` must narrow first. In `src/lib/game/sprint.spec.ts`:

1. Replace the `config` helper and add a narrowing helper, so the file's helper block reads:

```ts
type LettersConfig = Extract<SprintConfig, { mode: 'letters' }>;

const config = (overrides: Partial<LettersConfig> = {}): LettersConfig => ({
	mode: 'letters',
	level: 'normal',
	variant: 'isolated',
	rng: mulberry32(1),
	...overrides
});

const tick = (s: SprintState, now: number) => reduce(s, { type: 'tick', now });
const answer = (s: SprintState, choice: string, now: number) =>
	reduce(s, { type: 'answer', choice, now });

/** The current prompt as a letter prompt; these tests only run letters sprints. */
const letterOf = (s: SprintState) => {
	if (s.prompt.kind !== 'letter') throw new Error('Expected a letter prompt');
	return s.prompt;
};
const wrongChoice = (s: SprintState) => letterOf(s).choices.find((c) => c !== s.prompt.id)!;

/** A sprint that just left the countdown at now = 3000 (normal level: 3000 ms per letter). */
const activeSprint = (overrides: Partial<LettersConfig> = {}) =>
	tick(createSprint(config(overrides), 0), COUNTDOWN_MS);
```

2. In the "starts with a 3 s countdown and a ready prompt" test, change both `s.prompt.choices` to `letterOf(s).choices`.
3. In the "letter forms" test, change `s.prompt.form` (both uses) to `letterOf(s).form`, and `iso.prompt.form` to `letterOf(iso).form`.

In `src/routes/play/+page.svelte`, wrap the answer grid so it only renders for letter prompts:

```svelte
{#if s.prompt.kind === 'letter'}
	<AnswerGrid
		choices={s.prompt.choices}
		reveal={s.reveal}
		disabled={s.phase !== 'active'}
		onanswer={(choice) => runner?.answer(choice)}
	/>
{/if}
```

- [ ] **Step 6: Run the unit tests**

Run: `pnpm test:unit --run`
Expected: PASS, including all existing letters tests unchanged apart from Step 5.
If a text sprint timing assertion fails, recompute it from the rules (a text miss moves on immediately; the item in progress at the sprint end is not counted) before changing code.

- [ ] **Step 7: Run all gates and commit**

Run: `pnpm lint && pnpm check && pnpm test:e2e`
Expected: all pass (the letters e2e tests are unaffected).

```bash
git add src/lib/game src/routes/play/+page.svelte
git commit -m "feat: extend the sprint engine to words and sentences

Claude-Session: https://claude.ai/code/session_01QWMbjMc8aiczKFP1fL5faM"
```

---

### Task 2: Speech listener over the Web Speech API

Spec 8.7 (speech module) and the spike's learnings.
The listener hides the browser API behind a small interface, so the runner and the mic check can be driven by a fake in tests.

**Files:**

- Create: `src/lib/speech/listener.ts`, `src/lib/speech/web-speech.ts`
- Test: `src/lib/speech/web-speech.spec.ts`

**Interfaces:**

- Produces (`listener.ts`):
  - `type SpeechError = 'not-allowed' | 'network' | 'unsupported' | 'other'`
  - `type Transcript = { text: string; isFinal: boolean }`
  - `type ListenerHandlers = { onTranscript: (transcript: Transcript) => void; onError: (error: SpeechError) => void; onListeningChange: (listening: boolean) => void }`
  - `interface SpeechListener { readonly supported: boolean; start(handlers: ListenerHandlers): void; markItemBoundary(): void; stop(): void }`
- Produces (`web-speech.ts`):
  - `SPEECH_LANG = 'ar-SA'`
  - `type RecognitionConstructor`, `type SpeechScope = { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }`
  - `createWebSpeechListener(scope?: SpeechScope): SpeechListener` (defaults to `globalThis`)
- Behavior contract:
  - `start` stops any previous session; with no constructor it calls `onError('unsupported')`.
  - One continuous session: `lang = 'ar-SA'`, `continuous = true`, `interimResults = true`, `maxAlternatives = 5`; restarted on `end` until `stop` or a fatal error.
  - Every non-empty, trimmed alternative of interim and final results is reported.
  - `markItemBoundary()` remembers the current result count; later events report results from index `boundary - 1` onward (Chrome can append a new answer to the previous item's still-open result). A restarted session counts from 0 again.
  - `no-speech` and `aborted` are ignored. `not-allowed`, `service-not-allowed` and `audio-capture` stop with `'not-allowed'`; `network` stops with `'network'`; any other error, or `start()` throwing, stops with `'other'`.
  - `stop()` aborts the session, reports `onListeningChange(false)`, and ignores any later events from that session.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/speech/web-speech.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { SpeechError, Transcript } from './listener';
import { createWebSpeechListener, type RecognitionConstructor } from './web-speech';

type FakeResult = { transcript: string }[] & { isFinal: boolean };

class FakeRecognition {
	static instances: FakeRecognition[] = [];
	lang = '';
	continuous = false;
	interimResults = false;
	maxAlternatives = 1;
	onstart: (() => void) | null = null;
	onaudiostart: (() => void) | null = null;
	onresult: ((event: unknown) => void) | null = null;
	onerror: ((event: { error: string }) => void) | null = null;
	onend: (() => void) | null = null;
	starts = 0;
	aborted = false;
	private results: FakeResult[] = [];

	constructor() {
		FakeRecognition.instances.push(this);
	}

	start() {
		this.starts++;
		this.results = [];
		this.onstart?.();
		this.onaudiostart?.();
	}

	abort() {
		this.aborted = true;
	}

	/** Sets result `index` (appending or replacing it) and fires a result event from `resultIndex`. */
	emit(index: number, alternatives: string[], isFinal = false, resultIndex = index) {
		this.results[index] = Object.assign(
			alternatives.map((transcript) => ({ transcript })),
			{ isFinal }
		);
		this.onresult?.({ resultIndex, results: this.results });
	}

	end() {
		this.onend?.();
	}

	fail(error: string) {
		this.onerror?.({ error });
	}
}

class FailingRecognition extends FakeRecognition {
	start() {
		throw new Error('InvalidStateError');
	}
}

function setup(Recognition: typeof FakeRecognition = FakeRecognition) {
	FakeRecognition.instances = [];
	const listener = createWebSpeechListener({
		SpeechRecognition: Recognition as unknown as RecognitionConstructor
	});
	const heard: Transcript[] = [];
	const errors: SpeechError[] = [];
	const listening: boolean[] = [];
	listener.start({
		onTranscript: (transcript) => heard.push(transcript),
		onError: (error) => errors.push(error),
		onListeningChange: (value) => listening.push(value)
	});
	const recognition = FakeRecognition.instances[FakeRecognition.instances.length - 1];
	return { listener, heard, errors, listening, recognition };
}

describe('createWebSpeechListener', () => {
	it('reports unsupported when the browser has no speech recognition', () => {
		const listener = createWebSpeechListener({});
		const errors: SpeechError[] = [];
		listener.start({
			onTranscript: () => {},
			onError: (e) => errors.push(e),
			onListeningChange: () => {}
		});
		expect(listener.supported).toBe(false);
		expect(errors).toEqual(['unsupported']);
	});

	it('uses the prefixed constructor too', () => {
		const listener = createWebSpeechListener({
			webkitSpeechRecognition: FakeRecognition as unknown as RecognitionConstructor
		});
		expect(listener.supported).toBe(true);
	});

	it('starts one continuous Arabic session with interim results', () => {
		const { listener, recognition, listening } = setup();
		expect(listener.supported).toBe(true);
		expect(recognition).toMatchObject({
			lang: 'ar-SA',
			continuous: true,
			interimResults: true,
			maxAlternatives: 5,
			starts: 1
		});
		expect(listening).toEqual([true]);
	});

	it('reports every non-empty alternative of interim and final results, trimmed', () => {
		const { recognition, heard } = setup();
		recognition.emit(0, [' نور ', '', 'نون']);
		recognition.emit(0, ['نور'], true);
		expect(heard).toEqual([
			{ text: 'نور', isFinal: false },
			{ text: 'نون', isFinal: false },
			{ text: 'نور', isFinal: true }
		]);
	});

	it('after an item boundary reports the last older result and newer ones only', () => {
		const { listener, recognition, heard } = setup();
		recognition.emit(0, ['نور'], true);
		recognition.emit(1, ['كتاب'], true);
		listener.markItemBoundary();
		heard.length = 0;
		recognition.emit(2, ['سلام'], false, 0);
		expect(heard.map((t) => t.text)).toEqual(['كتاب', 'سلام']);
	});

	it('restarts when the session ends and counts results from the start again', () => {
		const { listener, recognition, heard, listening } = setup();
		recognition.emit(0, ['نور'], true);
		recognition.emit(1, ['كتاب'], true);
		listener.markItemBoundary();
		recognition.end();
		expect(recognition.starts).toBe(2);
		expect(listening).toEqual([true, false, true]);
		heard.length = 0;
		recognition.emit(0, ['سلام'], false, 0);
		expect(heard.map((t) => t.text)).toEqual(['سلام']);
	});

	it('ignores silence and abort errors', () => {
		const { recognition, errors } = setup();
		recognition.fail('no-speech');
		recognition.fail('aborted');
		expect(errors).toEqual([]);
		expect(recognition.aborted).toBe(false);
	});

	it.each([
		['not-allowed', 'not-allowed'],
		['service-not-allowed', 'not-allowed'],
		['audio-capture', 'not-allowed'],
		['network', 'network'],
		['language-not-supported', 'other']
	] as const)('stops on %s and reports %s', (code, expected) => {
		const { recognition, errors, heard } = setup();
		recognition.fail(code);
		expect(errors).toEqual([expected]);
		expect(recognition.aborted).toBe(true);
		recognition.end();
		expect(recognition.starts).toBe(1);
		recognition.emit(0, ['نور']);
		expect(heard).toEqual([]);
	});

	it('stops on request and ignores the session afterwards', () => {
		const { listener, recognition, heard, listening } = setup();
		listener.stop();
		expect(recognition.aborted).toBe(true);
		expect(listening).toEqual([true, false]);
		recognition.end();
		recognition.emit(0, ['نور']);
		expect(recognition.starts).toBe(1);
		expect(heard).toEqual([]);
	});

	it('replaces the previous session when started again', () => {
		const { listener, recognition: first, heard } = setup();
		const later: Transcript[] = [];
		listener.start({
			onTranscript: (t) => later.push(t),
			onError: () => {},
			onListeningChange: () => {}
		});
		const second = FakeRecognition.instances[FakeRecognition.instances.length - 1];
		expect(first.aborted).toBe(true);
		expect(second).not.toBe(first);
		first.emit(0, ['نور']);
		second.emit(0, ['سلام']);
		expect(heard).toEqual([]);
		expect(later.map((t) => t.text)).toEqual(['سلام']);
	});

	it('reports other when the browser refuses to start', () => {
		const { errors } = setup(FailingRecognition);
		expect(errors).toEqual(['other']);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit --run src/lib/speech/web-speech.spec.ts`
Expected: FAIL, cannot resolve `./listener` and `./web-speech`.

- [ ] **Step 3: Implement the interface and the listener**

Create `src/lib/speech/listener.ts`:

```ts
export type SpeechError = 'not-allowed' | 'network' | 'unsupported' | 'other';

export type Transcript = { text: string; isFinal: boolean };

export type ListenerHandlers = {
	onTranscript: (transcript: Transcript) => void;
	/** The listener has already stopped when this is called. */
	onError: (error: SpeechError) => void;
	onListeningChange: (listening: boolean) => void;
};

export interface SpeechListener {
	readonly supported: boolean;
	start(handlers: ListenerHandlers): void;
	/** Call when a new item appears, so results that belong to the previous item are not reported again. */
	markItemBoundary(): void;
	stop(): void;
}
```

Create `src/lib/speech/web-speech.ts`:

```ts
import type { ListenerHandlers, SpeechError, SpeechListener } from './listener';

type Alternative = { readonly transcript: string };

type RecognitionResult = {
	readonly isFinal: boolean;
	readonly length: number;
	readonly [index: number]: Alternative;
};

type RecognitionEvent = {
	readonly resultIndex: number;
	readonly results: { readonly length: number; readonly [index: number]: RecognitionResult };
};

/** The part of the Web Speech API's SpeechRecognition this app uses. */
type Recognition = {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	maxAlternatives: number;
	onstart: (() => void) | null;
	onaudiostart: (() => void) | null;
	onresult: ((event: RecognitionEvent) => void) | null;
	onerror: ((event: { readonly error: string }) => void) | null;
	onend: (() => void) | null;
	start(): void;
	abort(): void;
};

export type RecognitionConstructor = new () => Recognition;

/** Where the constructor lives: `window` in the browser, a fake in tests. */
export type SpeechScope = {
	SpeechRecognition?: RecognitionConstructor;
	webkitSpeechRecognition?: RecognitionConstructor;
};

export const SPEECH_LANG = 'ar-SA';

const BLOCKED = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

/** Silence and the session's own aborts are normal; recognition simply continues or restarts. */
const IGNORED = new Set(['no-speech', 'aborted']);

function toSpeechError(code: string): SpeechError {
	if (BLOCKED.has(code)) return 'not-allowed';
	return code === 'network' ? 'network' : 'other';
}

export function createWebSpeechListener(
	scope: SpeechScope = globalThis as SpeechScope
): SpeechListener {
	const Recognition = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
	let recognition: Recognition | null = null;
	let handlers: ListenerHandlers | null = null;
	/** Results in the current recognition session, and how many existed when the current item appeared. */
	let resultCount = 0;
	let boundary = 0;

	function stop() {
		const active = handlers;
		const current = recognition;
		recognition = null;
		handlers = null;
		current?.abort();
		active?.onListeningChange(false);
	}

	function fail(error: SpeechError) {
		const active = handlers;
		stop();
		active?.onError(error);
	}

	function startSession(r: Recognition) {
		try {
			r.start();
		} catch {
			fail('other');
		}
	}

	function begin(Ctor: RecognitionConstructor) {
		const r = new Ctor();
		r.lang = SPEECH_LANG;
		r.continuous = true;
		r.interimResults = true;
		r.maxAlternatives = 5;
		r.onstart = () => {
			resultCount = 0;
			boundary = 0;
		};
		r.onaudiostart = () => {
			if (recognition === r) handlers?.onListeningChange(true);
		};
		r.onresult = (event) => {
			if (recognition !== r) return;
			resultCount = event.results.length;
			// Chrome can append a new answer to the previous item's still-open result, so the last older result is kept.
			for (let i = Math.max(event.resultIndex, boundary - 1, 0); i < event.results.length; i++) {
				const result = event.results[i];
				for (let a = 0; a < result.length; a++) {
					// A handler may stop the listener mid-loop, for example when the mic check passes.
					if (recognition !== r || !handlers) return;
					const text = result[a].transcript.trim();
					if (text) handlers.onTranscript({ text, isFinal: result.isFinal });
				}
			}
		};
		r.onerror = (event) => {
			if (recognition !== r || IGNORED.has(event.error)) return;
			fail(toSpeechError(event.error));
		};
		r.onend = () => {
			if (recognition !== r) return;
			handlers?.onListeningChange(false);
			startSession(r);
		};
		recognition = r;
		startSession(r);
	}

	return {
		supported: Recognition !== undefined,
		start(next) {
			stop();
			if (!Recognition) {
				next.onError('unsupported');
				return;
			}
			handlers = next;
			begin(Recognition);
		},
		markItemBoundary() {
			boundary = resultCount;
		},
		stop
	};
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:unit --run src/lib/speech`
Expected: PASS.

- [ ] **Step 5: Run all gates and commit**

Run: `pnpm test:unit --run && pnpm lint && pnpm check`
Expected: all pass, no warnings.

```bash
git add src/lib/speech/listener.ts src/lib/speech/web-speech.ts src/lib/speech/web-speech.spec.ts
git commit -m "feat: add a Web Speech listener for Arabic reading checks

Claude-Session: https://claude.ai/code/session_01QWMbjMc8aiczKFP1fL5faM"
```

---

### Task 3: Results for every mode and unranked runs

Spec 5.6 (practice results) and 6 (results view: "Review what you missed" with Arabic, transliteration and meaning).
This comes before the words and sentences sprint screen, so a finished text sprint never reaches the letters-only review list.

**Files:**

- Create: `src/lib/game/review.ts`, `src/lib/game/review.spec.ts`
- Modify: `src/lib/ui/ResultsView.svelte` (full replacement), `src/routes/play/+page.svelte` (save only ranked runs)

**Interfaces:**

- Consumes: `SprintConfig`, `SprintState` (Task 1); `textItem` (Task 1); `letterByChar`
- Produces:
  - `type ReviewItem = { id: string; arabic: string; label: string; detail: string }` - letters: `arabic` is the letter, `label` its transliterated name, `detail` its Arabic name; words and sentences: `arabic` is the item text, `label` its transliteration, `detail` its English meaning
  - `reviewItems(config: SprintConfig, missed: readonly string[]): ReviewItem[]` (throws on unknown ids, keeps miss order)
  - `ResultsView` props unchanged; it shows "Practice - not ranked" and hides saving messages and the Top 3 when `state.ranked` is false

- [ ] **Step 1: Write the failing test**

Create `src/lib/game/review.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PACKS } from '$lib/content/packs';
import { reviewItems } from './review';
import { mulberry32 } from './rng';

describe('reviewItems', () => {
	it('describes missed letters by transliterated and Arabic name', () => {
		expect(
			reviewItems({ mode: 'letters', level: 'normal', variant: 'isolated', rng: mulberry32(1) }, [
				'ب'
			])
		).toEqual([{ id: 'ب', arabic: 'ب', label: 'baa', detail: 'باء' }]);
	});

	it('describes missed words and sentences by transliteration and meaning, in miss order', () => {
		const [first, second] = PACKS.quran.words;
		const words = {
			mode: 'words',
			level: 'fast',
			variant: 'quran',
			rng: mulberry32(1),
			practice: false
		} as const;
		expect(reviewItems(words, [second.id, first.id])).toEqual([
			{ id: second.id, arabic: second.text, label: second.translit, detail: second.meaning },
			{ id: first.id, arabic: first.text, label: first.translit, detail: first.meaning }
		]);

		const sentence = PACKS.msa.sentences[0];
		const sentences = {
			mode: 'sentences',
			level: 'normal',
			variant: 'msa',
			rng: mulberry32(1),
			practice: true
		} as const;
		expect(reviewItems(sentences, [sentence.id])).toEqual([
			{ id: sentence.id, arabic: sentence.text, label: sentence.translit, detail: sentence.meaning }
		]);
	});

	it('rejects unknown ids', () => {
		const words = {
			mode: 'words',
			level: 'fast',
			variant: 'quran',
			rng: mulberry32(1),
			practice: false
		} as const;
		expect(() => reviewItems(words, ['nope'])).toThrow();
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit --run src/lib/game/review.spec.ts`
Expected: FAIL, cannot resolve `./review`.

- [ ] **Step 3: Implement `src/lib/game/review.ts`**

```ts
import { letterByChar } from '$lib/content/letters';
import { textItem } from './prompts';
import type { SprintConfig } from './sprint';

export type ReviewItem = {
	id: string;
	/** The Arabic that was shown. */
	arabic: string;
	/** The letter's transliterated name, or the item's transliteration. */
	label: string;
	/** The letter's Arabic name, or the item's English meaning. */
	detail: string;
};

export function reviewItems(config: SprintConfig, missed: readonly string[]): ReviewItem[] {
	return missed.map((id) => {
		if (config.mode === 'letters') {
			const letter = letterByChar(id);
			return { id, arabic: letter.char, label: letter.name, detail: letter.arabicName };
		}
		const item = textItem(config.mode, config.variant, id);
		return { id, arabic: item.text, label: item.translit, detail: item.meaning };
	});
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:unit --run src/lib/game/review.spec.ts`
Expected: PASS.

- [ ] **Step 5: Replace `src/lib/ui/ResultsView.svelte`**

```svelte
<script lang="ts">
	import { resolve } from '$app/paths';
	import { reviewItems } from '$lib/game/review';
	import { accuracy, attempts } from '$lib/game/scoring';
	import type { SprintState } from '$lib/game/sprint';
	import type { BoardRow } from '$lib/storage/boards';
	import type { SaveResult } from '$lib/storage/store.svelte';
	import Button from './Button.svelte';
	import Chip from './Chip.svelte';
	import LeaderboardTable from './LeaderboardTable.svelte';
	import { buttonClass } from './styles';

	type Props = {
		state: SprintState;
		save: SaveResult | null;
		rows: BoardRow[];
		currentPlayerId: string;
		onagain: () => void;
	};

	let { state, save, rows, currentPlayerId, onagain }: Props = $props();

	const percent = $derived(
		Math.round(accuracy(state.counters.correct, attempts(state.counters)) * 100)
	);
	const review = $derived(reviewItems(state.config, state.missed));
	const letters = $derived(state.config.mode === 'letters');
</script>

<main class="flex flex-1 flex-col gap-6">
	<section class="rounded-item bg-white p-6 text-center shadow-item">
		<h1 class="text-lg font-bold text-ink/70">Time's up!</h1>
		<p data-testid="result-score" class="text-7xl font-bold text-crimson tabular-nums">
			{state.score}
		</p>
		<p class="text-sm text-ink/75">{state.score === 1 ? 'point' : 'points'}</p>
		{#if !state.ranked}
			<div class="mt-3"><Chip>Practice - not ranked</Chip></div>
		{:else if save?.saved && save.personalBest}
			<div class="mt-3"><Chip tone="purple">New personal best</Chip></div>
		{:else if save && !save.saved}
			<p class="mt-3 text-sm font-bold text-crimson-deep">This run could not be saved.</p>
		{/if}
		<dl class="mt-5 grid grid-cols-2 gap-3">
			<div class="rounded-card bg-ink/5 p-3">
				<dt class="text-xs text-ink/75">Accuracy</dt>
				<dd class="text-2xl font-bold tabular-nums">{percent}%</dd>
			</div>
			<div class="rounded-card bg-ink/5 p-3">
				<dt class="text-xs text-ink/75">Best streak</dt>
				<dd class="text-2xl font-bold tabular-nums">{state.counters.bestStreak}</dd>
			</div>
		</dl>
	</section>

	{#if state.ranked}
		<section class="flex flex-col gap-2">
			<h2 class="font-bold">Top 3</h2>
			<LeaderboardTable {rows} {currentPlayerId} limit={3} />
		</section>
	{/if}

	{#if review.length > 0}
		<section class="flex flex-col gap-2">
			<h2 class="font-bold">Review what you missed</h2>
			<ul class={['grid gap-2', letters ? 'grid-cols-2' : 'grid-cols-1']}>
				{#each review as item (item.id)}
					{#if letters}
						<li class="flex items-center gap-3 rounded-card bg-white px-4 py-2 shadow-soft">
							<span
								lang="ar"
								dir="rtl"
								class="w-9 shrink-0 text-center font-arabic text-3xl leading-normal font-bold"
								>{item.arabic}</span
							>
							<span class="flex min-w-0 flex-col items-start leading-tight">
								<span class="font-bold">{item.label}</span>
								<span lang="ar" dir="rtl" class="font-arabic text-ink/70">{item.detail}</span>
							</span>
						</li>
					{:else}
						<li class="flex flex-col gap-1 rounded-card bg-white px-4 py-3 shadow-soft">
							<span
								lang="ar"
								dir="rtl"
								class="text-right font-arabic text-2xl leading-loose font-bold">{item.arabic}</span
							>
							<span class="font-bold">{item.label}</span>
							<span class="text-sm text-ink/75">{item.detail}</span>
						</li>
					{/if}
				{/each}
			</ul>
		</section>
	{/if}

	<div class="mt-auto grid grid-cols-2 gap-3">
		<a href={resolve('/')} class={buttonClass('secondary')}>Home</a>
		<Button onclick={onagain}>Again</Button>
	</div>
</main>
```

- [ ] **Step 6: Save only ranked runs**

In `src/routes/play/+page.svelte`, in `handleOutcome`, change the save in the `finished` branch from `save = store.saveRun(playerId, {` to:

```ts
// Practice and sprints where speech stopped are never saved (spec 5.6).
save = !state.ranked
	? null
	: store.saveRun(playerId, {
			board: boardKey(state.config),
			score: state.score,
			correct: state.counters.correct,
			attempts: attempts(state.counters),
			bestStreak: state.counters.bestStreak,
			missed: [...state.missed]
		});
```

and remove the old `store.saveRun(...)` call it replaces.

- [ ] **Step 7: Run all gates and commit**

Run: `pnpm test:unit --run && pnpm lint && pnpm check && pnpm test:e2e`
Expected: all pass; the letters results e2e test is unchanged.

```bash
git add src/lib/game/review.ts src/lib/game/review.spec.ts src/lib/ui/ResultsView.svelte src/routes/play/+page.svelte
git commit -m "feat: show results for every mode and never save unranked runs

Claude-Session: https://claude.ai/code/session_01QWMbjMc8aiczKFP1fL5faM"
```

---

### Task 4: Words and sentences sprint screen with speech

Spec 5.1, 5.4, 5.6, 7.3 (mic indicator), 7.6, 8.7 and 10 (speech errors).
The runner owns the microphone: it listens from the countdown on, stops while paused or finished, and falls back to self-report on any speech error, including a browser without speech recognition.

**Files:**

- Modify: `src/lib/game/sprint.svelte.ts` (full replacement), `src/lib/ui/ItemCard.svelte` (full replacement), `src/routes/layout.css` (mic pulse), `src/routes/play/+page.svelte` (full replacement), `tests/e2e/helpers.ts` (add helpers)
- Create: `src/lib/ui/MicIndicator.svelte`, `tests/e2e/speech.ts`, `tests/e2e/speech-sprint.e2e.ts`

**Interfaces:**

- Consumes: `SprintConfig`, `SprintState`, `SprintEvent`, `Outcome`, `createSprint`, `reduce`, `outcomeBetween`, `itemLimit` (Task 1); `SpeechListener`, `ListenerHandlers`, `Transcript`, `createWebSpeechListener` (Task 2); `ResultsView` (Task 3); `matchTranscript`, `wordCount` (Phase 2A)
- Produces:
  - `createSprintRunner(config: SprintConfig, onOutcome: (outcome: Outcome, state: SprintState) => void, listener?: SpeechListener)` returning `{ state, listening, heard, start(), answer(choice), skip(), selfReport(correct), resume(), stop() }`
  - `<ItemCard text flash? size?: 'letter' | 'word' | 'sentence'>` (the prompt keeps `data-testid="prompt"`)
  - `<MicIndicator listening heard>` (`data-testid="mic"`)
  - Play page: Skip button (speech), Missed and Got it buttons (self-report), status text "Speech recognition is not available, so this sprint is now practice and will not be ranked."
  - e2e helpers: `seedPlayer(page, name?)`, `savedRuns(page)` in `helpers.ts`; `installFakeSpeech(page, options?)`, `say(page, text)`, `failSpeech(page, error)`, `speechState(page)`, `promptText(page)` in `speech.ts`

- [ ] **Step 1: Add the e2e helpers**

Append to `tests/e2e/helpers.ts`:

```ts
/** Seeds one current player before each page load, without overwriting data saved by earlier navigations. */
export async function seedPlayer(page: Page, name = 'Sara') {
	await page.addInitScript((playerName) => {
		if (localStorage.getItem('harf-sprint:v1') !== null) return;
		const player = { id: 'p1', name: playerName, createdAt: '2026-09-14T08:00:00.000Z' };
		localStorage.setItem(
			'harf-sprint:v1',
			JSON.stringify({
				version: 1,
				players: [player],
				lastPlayerId: player.id,
				runs: [],
				bests: {},
				settings: { sound: false }
			})
		);
	}, name);
}

/** Number of runs saved in localStorage. */
export async function savedRuns(page: Page) {
	return page.evaluate(() => {
		const raw = localStorage.getItem('harf-sprint:v1');
		return raw === null ? 0 : (JSON.parse(raw) as { runs: unknown[] }).runs.length;
	});
}
```

Create `tests/e2e/speech.ts`:

```ts
import type { Page } from '@playwright/test';

type FakeSpeechOptions = {
	/** No SpeechRecognition in the browser at all. */
	unsupported?: boolean;
	/** Every recognition session fails at once with `not-allowed`. */
	denied?: boolean;
};

type SpeechTestApi = {
	say(text: string): void;
	fail(error: string): void;
	readonly active: boolean;
	readonly starts: number;
};

type SpeechTestWindow = { __speech: SpeechTestApi };

/**
 * Replaces the browser's SpeechRecognition with a fake before the app loads, so the app's real
 * listener runs and tests decide what is heard.
 */
export async function installFakeSpeech(page: Page, options: FakeSpeechOptions = {}) {
	await page.addInitScript((opts: FakeSpeechOptions) => {
		const scope = window as unknown as Record<string, unknown>;
		if (opts.unsupported) {
			scope.SpeechRecognition = undefined;
			scope.webkitSpeechRecognition = undefined;
			return;
		}

		type Result = { transcript: string }[] & { isFinal: boolean };
		let current: FakeRecognition | null = null;
		let starts = 0;

		class FakeRecognition {
			lang = '';
			continuous = false;
			interimResults = false;
			maxAlternatives = 1;
			onstart: (() => void) | null = null;
			onaudiostart: (() => void) | null = null;
			onresult: ((event: unknown) => void) | null = null;
			onerror: ((event: { error: string }) => void) | null = null;
			onend: (() => void) | null = null;
			results: Result[] = [];

			start() {
				starts++;
				current = this;
				this.results = [];
				if (opts.denied) {
					queueMicrotask(() => {
						this.onerror?.({ error: 'not-allowed' });
						this.onend?.();
					});
					return;
				}
				this.onstart?.();
				this.onaudiostart?.();
			}

			abort() {
				if (current === this) current = null;
			}
		}

		const api: SpeechTestApi = {
			say(text) {
				const recognition = current;
				if (!recognition) throw new Error('Speech recognition is not listening');
				const index = recognition.results.length;
				recognition.results.push(Object.assign([{ transcript: text }], { isFinal: true }));
				recognition.onresult?.({ resultIndex: index, results: recognition.results });
			},
			fail(error) {
				const recognition = current;
				recognition?.onerror?.({ error });
				recognition?.onend?.();
			},
			get active() {
				return current !== null;
			},
			get starts() {
				return starts;
			}
		};

		scope.__speech = api;
		scope.SpeechRecognition = FakeRecognition;
		scope.webkitSpeechRecognition = FakeRecognition;
	}, options);
}

export async function say(page: Page, text: string) {
	await page.evaluate(
		(spoken) => (window as unknown as SpeechTestWindow).__speech.say(spoken),
		text
	);
}

export async function failSpeech(page: Page, error: string) {
	await page.evaluate((code) => (window as unknown as SpeechTestWindow).__speech.fail(code), error);
}

export async function speechState(page: Page) {
	return page.evaluate(() => {
		const speech = (window as unknown as SpeechTestWindow).__speech;
		return { active: speech.active, starts: speech.starts };
	});
}

/** The vowelled Arabic currently on the item card. */
export async function promptText(page: Page) {
	return ((await page.getByTestId('prompt').textContent()) ?? '').trim();
}
```

- [ ] **Step 2: Write the failing e2e tests**

Create `tests/e2e/speech-sprint.e2e.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';
import { wordCount } from '../../src/lib/speech/match';
import { pauseClock, savedRuns, seedPlayer, setHidden } from './helpers';
import { failSpeech, installFakeSpeech, promptText, say, speechState } from './speech';

const FALLBACK =
	'Speech recognition is not available, so this sprint is now practice and will not be ranked.';

test.beforeEach(async ({ page }) => {
	await pauseClock(page);
	await seedPlayer(page);
});

async function startSprint(page: Page, url: string) {
	await page.goto(url);
	// The sprint starts once the page mounts; jumping the paused clock before that skips nothing.
	await expect(page.getByText('3', { exact: true })).toBeVisible();
	await page.clock.fastForward(3_000);
	await expect(page.getByTestId('prompt')).toBeVisible();
}

test('scores words read aloud, ignores other speech and skips on request', async ({ page }) => {
	await installFakeSpeech(page);
	await startSprint(page, '/play?mode=words&level=normal&variant=quran');
	const score = page.getByTestId('sprint-score');
	const mic = page.getByTestId('mic');
	await expect(mic).toContainText('Listening');

	const first = await promptText(page);
	await say(page, first);
	await expect(score).toHaveText('Score 1');
	await expect(page.getByTestId('prompt')).not.toHaveText(first);

	const second = await promptText(page);
	await say(page, 'hello');
	await expect(mic).toContainText('hello');
	await expect(score).toHaveText('Score 1');

	await page.getByRole('button', { name: 'Skip' }).click();
	await expect(page.getByTestId('prompt')).not.toHaveText(second);
	await expect(score).toHaveText('Score 1');

	await page.clock.fastForward(60_000);
	await expect(page.getByRole('heading', { name: "Time's up!" })).toBeVisible();
	await expect(page.getByText('New personal best')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Review what you missed' })).toBeVisible();
	expect((await speechState(page)).active).toBe(false);
	expect(await savedRuns(page)).toBe(1);
});

test('scores a sentence at one point per word', async ({ page }) => {
	await installFakeSpeech(page);
	await startSprint(page, '/play?mode=sentences&level=relaxed&variant=quran');
	const sentence = await promptText(page);
	await say(page, sentence);
	await expect(page.getByTestId('sprint-score')).toHaveText(`Score ${wordCount(sentence)}`);
});

test('turns the sprint into unranked practice when speech fails', async ({ page }) => {
	await installFakeSpeech(page);
	await startSprint(page, '/play?mode=words&level=normal&variant=msa');
	const score = page.getByTestId('sprint-score');

	await failSpeech(page, 'network');
	await expect(page.getByText(FALLBACK)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Skip' })).toBeHidden();
	await page.getByRole('button', { name: 'Got it' }).click();
	await expect(score).toHaveText('Score 1');
	await page.getByRole('button', { name: 'Missed' }).click();
	await expect(score).toHaveText('Score 1');

	await page.clock.fastForward(60_000);
	await expect(page.getByText('Practice - not ranked')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Top 3' })).toBeHidden();
	expect(await savedRuns(page)).toBe(0);
});

test('practice links use Got it and Missed and never start the microphone', async ({ page }) => {
	await installFakeSpeech(page);
	await startSprint(page, '/play?mode=words&level=fast&variant=quran&practice=1');
	await expect(page.getByTestId('mic')).toBeHidden();
	await expect(page.getByText(FALLBACK)).toBeHidden();
	await page.getByRole('button', { name: 'Got it' }).click();
	await expect(page.getByTestId('sprint-score')).toHaveText('Score 1');
	expect((await speechState(page)).starts).toBe(0);

	await page.clock.fastForward(60_000);
	await expect(page.getByText('Practice - not ranked')).toBeVisible();
	expect(await savedRuns(page)).toBe(0);
});

test('stops listening while paused and listens again after Continue', async ({ page }) => {
	await installFakeSpeech(page);
	await startSprint(page, '/play?mode=words&level=normal&variant=quran');
	expect((await speechState(page)).active).toBe(true);

	await setHidden(page, true);
	await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
	expect((await speechState(page)).active).toBe(false);

	await setHidden(page, false);
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.getByTestId('mic')).toContainText('Listening');
	expect((await speechState(page)).active).toBe(true);
	await say(page, await promptText(page));
	await expect(page.getByTestId('sprint-score')).toHaveText('Score 1');
});

test('falls back to practice when the browser has no speech recognition', async ({ page }) => {
	await installFakeSpeech(page, { unsupported: true });
	await startSprint(page, '/play?mode=words&level=normal&variant=quran');
	await expect(page.getByText(FALLBACK)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Got it' })).toBeVisible();
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `pnpm exec playwright test tests/e2e/speech-sprint.e2e.ts`
Expected: FAIL (the play page does not show the mic, Skip, or Got it controls yet).

- [ ] **Step 4: Replace the runner**

Replace `src/lib/game/sprint.svelte.ts` with:

```ts
import type { ListenerHandlers, SpeechListener, Transcript } from '$lib/speech/listener';
import { matchTranscript } from '$lib/speech/match';
import {
	createSprint,
	outcomeBetween,
	reduce,
	type Outcome,
	type SprintConfig,
	type SprintEvent,
	type SprintState
} from './sprint';

/**
 * Drives a sprint with requestAnimationFrame and pauses it when the page is hidden.
 * For speech sprints it listens while the sprint runs and turns matching transcripts into answers.
 * The countdown starts when the runner is created, so call `start()` straight away.
 */
export function createSprintRunner(
	config: SprintConfig,
	onOutcome: (outcome: Outcome, state: SprintState) => void,
	listener?: SpeechListener
) {
	let state = $state.raw<SprintState>(createSprint(config, performance.now()));
	let listening = $state(false);
	let heard = $state('');
	let frame = 0;
	let started = false;
	let hearing = false;

	const handlers: ListenerHandlers = {
		onTranscript,
		onError: () => {
			// The listener has already stopped; the sprint carries on with the Got it and Missed buttons.
			hearing = false;
			dispatch({ type: 'speechLost', now: performance.now() });
		},
		onListeningChange: (value) => {
			listening = value;
		}
	};

	/** Listens from the countdown on so the microphone is warm, and not while paused or finished (spec 8.7). */
	function syncListening() {
		const wanted =
			started && state.input === 'speech' && state.phase !== 'paused' && state.phase !== 'finished';
		if (listener && wanted && !hearing) {
			hearing = true;
			heard = '';
			listener.start(handlers);
		} else if (!wanted && hearing) {
			hearing = false;
			listener?.stop();
		}
	}

	function dispatch(event: SprintEvent) {
		const previous = state;
		state = reduce(previous, event);
		if (
			state.prompt !== previous.prompt ||
			(previous.phase === 'countdown' && state.phase === 'active')
		) {
			// Anything heard so far belongs to the previous item or the countdown.
			listener?.markItemBoundary();
			heard = '';
		}
		syncListening();
		const outcome = outcomeBetween(previous, state);
		if (outcome) onOutcome(outcome, state);
	}

	function onTranscript(transcript: Transcript) {
		const { prompt, phase, input } = state;
		if (input !== 'speech' || prompt.kind !== 'text') return;
		heard = transcript.text;
		if (
			phase === 'active' &&
			matchTranscript(prompt.display, transcript.text, prompt.matchKind).matched
		) {
			dispatch({ type: 'matched', now: performance.now() });
		}
	}

	function loop() {
		dispatch({ type: 'tick', now: performance.now() });
		frame = state.phase === 'finished' ? 0 : requestAnimationFrame(loop);
	}

	function onVisibilityChange() {
		if (document.hidden) dispatch({ type: 'pause', now: performance.now() });
	}

	return {
		get state() {
			return state;
		},
		get listening() {
			return listening;
		},
		/** The latest transcript for the current item, shown under the mic indicator. */
		get heard() {
			return heard;
		},
		start() {
			started = true;
			document.addEventListener('visibilitychange', onVisibilityChange);
			frame = requestAnimationFrame(loop);
			syncListening();
		},
		answer(choice: string) {
			dispatch({ type: 'answer', choice, now: performance.now() });
		},
		skip() {
			dispatch({ type: 'skip', now: performance.now() });
		},
		selfReport(correct: boolean) {
			dispatch({ type: 'selfReport', correct, now: performance.now() });
		},
		resume() {
			dispatch({ type: 'resume', now: performance.now() });
		},
		stop() {
			started = false;
			cancelAnimationFrame(frame);
			document.removeEventListener('visibilitychange', onVisibilityChange);
			syncListening();
		}
	};
}

export type SprintRunner = ReturnType<typeof createSprintRunner>;
```

- [ ] **Step 5: Add the card sizes and the mic indicator**

Replace `src/lib/ui/ItemCard.svelte` with:

```svelte
<script lang="ts">
	type Size = 'letter' | 'word' | 'sentence';

	let {
		text,
		flash = false,
		size = 'letter'
	}: { text: string; flash?: boolean; size?: Size } = $props();

	const FONT_SIZE: Record<Size, string> = {
		letter: 'clamp(6rem, 40vw, 11rem)',
		word: 'clamp(3.5rem, 16vw, 5rem)',
		sentence: 'clamp(1.75rem, 8vw, 2.5rem)'
	};
</script>

<div
	class={[
		// The ring stays green and grows in; fading in from transparent passes through grey.
		// flex-1 fills the free height, so the answers below sit low on phones, in thumb reach.
		'grid min-h-56 flex-1 place-items-center rounded-item bg-white p-6 shadow-item ring-success transition-shadow duration-150',
		flash ? 'ring-4' : 'ring-0'
	]}
>
	{#key text}
		<p
			data-testid="prompt"
			lang="ar"
			dir="rtl"
			class={[
				'item-pop font-arabic font-bold text-ink',
				// Sentences wrap, and loose lines keep harakat on neighboring lines apart.
				size === 'sentence' ? 'text-center leading-loose' : 'leading-normal'
			]}
			style:font-size={FONT_SIZE[size]}
		>
			{text}
		</p>
	{/key}
</div>
```

Create `src/lib/ui/MicIndicator.svelte`:

```svelte
<script lang="ts">
	let { listening, heard }: { listening: boolean; heard: string } = $props();
</script>

<div
	data-testid="mic"
	class="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-full bg-white/70 px-4 shadow-soft"
>
	<span
		aria-hidden="true"
		class={['size-3 shrink-0 rounded-full', listening ? 'mic-pulse bg-crimson-deep' : 'bg-ink/30']}
	></span>
	<span class="shrink-0 text-sm font-bold">{listening ? 'Listening' : 'Starting mic'}</span>
	{#if heard}
		<span
			lang="ar"
			dir="rtl"
			class="min-w-0 flex-1 truncate text-right font-arabic text-lg text-ink/75">{heard}</span
		>
	{/if}
</div>
```

In `src/routes/layout.css`, add after the `shake` keyframes:

```css
@keyframes mic-pulse {
	0%,
	100% {
		opacity: 1;
		transform: scale(1);
	}
	50% {
		opacity: 0.45;
		transform: scale(0.8);
	}
}

.mic-pulse {
	animation: mic-pulse 1.2s ease-in-out infinite;
}
```

and add `.mic-pulse` to the selector list inside the existing `@media (prefers-reduced-motion: reduce)` rule, next to `.item-pop` and `.shake`.

- [ ] **Step 6: Replace the play page**

Replace `src/routes/play/+page.svelte` with:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { playSfx } from '$lib/audio/sfx';
	import { letterByChar } from '$lib/content/letters';
	import { boardKey, parseBoardKey } from '$lib/game/levels';
	import { attempts } from '$lib/game/scoring';
	import { itemLimit, type Outcome, type SprintConfig, type SprintState } from '$lib/game/sprint';
	import { createSprintRunner, type SprintRunner } from '$lib/game/sprint.svelte';
	import { createWebSpeechListener } from '$lib/speech/web-speech';
	import { getStore } from '$lib/storage/app-store';
	import { boardRows } from '$lib/storage/boards';
	import type { SaveResult } from '$lib/storage/store.svelte';
	import AnswerGrid from '$lib/ui/AnswerGrid.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import ItemCard from '$lib/ui/ItemCard.svelte';
	import MicIndicator from '$lib/ui/MicIndicator.svelte';
	import ResultsView from '$lib/ui/ResultsView.svelte';
	import TimerBar from '$lib/ui/TimerBar.svelte';
	import { buttonClass } from '$lib/ui/styles';

	const store = getStore();
	const player = $derived(store.currentPlayer);
	const setup = $derived(
		parseBoardKey(
			['mode', 'level', 'variant'].map((key) => page.url.searchParams.get(key)).join(':')
		)
	);
	const practice = $derived(page.url.searchParams.get('practice') === '1');

	/** What one item is called, and the card size it uses. */
	const ITEM = { letters: 'letter', words: 'word', sentences: 'sentence' } as const;

	let runner = $state.raw<SprintRunner | null>(null);
	let save = $state.raw<SaveResult | null>(null);
	let announcement = $state('');
	let flash = $state(false);
	let flashTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		if (!player) goto(resolve('/'), { replaceState: true });
		else if (!setup) goto(resolve('/modes'), { replaceState: true });
	});

	function sprintConfig(): SprintConfig | null {
		if (!setup) return null;
		return setup.mode === 'letters'
			? { ...setup, rng: Math.random }
			: { ...setup, rng: Math.random, practice };
	}

	function startRound() {
		const config = sprintConfig();
		if (!player || !config) return;
		runner?.stop();
		save = null;
		announcement = '';
		// Captured now, so another tab switching player mid-sprint cannot move the run to someone else.
		const playerId = player.id;
		const listener =
			config.mode !== 'letters' && !config.practice ? createWebSpeechListener() : undefined;
		runner = createSprintRunner(
			config,
			(outcome, state) => handleOutcome(outcome, state, playerId),
			listener
		);
		runner.start();
	}

	function handleOutcome(outcome: Outcome, state: SprintState, playerId: string) {
		// Speech sprints stay silent while listening, so the microphone never hears the game (spec 7.6).
		if (store.data.settings.sound && state.input !== 'speech') {
			playSfx(outcome === 'correct' ? 'correct' : outcome === 'wrong' ? 'wrong' : 'timeup');
		}
		if (outcome === 'correct') {
			announcement = `Correct. ${state.score} points.`;
			flash = true;
			clearTimeout(flashTimer);
			flashTimer = setTimeout(() => (flash = false), 200);
		} else if (outcome === 'finished') {
			// Practice and sprints where speech stopped are never saved (spec 5.6).
			save = !state.ranked
				? null
				: store.saveRun(playerId, {
						board: boardKey(state.config),
						score: state.score,
						correct: state.counters.correct,
						attempts: attempts(state.counters),
						bestStreak: state.counters.bestStreak,
						missed: [...state.missed]
					});
			announcement = `Time is up. You scored ${state.score}.`;
		} else if (outcome === 'skip') {
			announcement = 'Skipped.';
		} else if (state.config.mode !== 'letters') {
			announcement = outcome === 'wrong' ? 'Missed.' : 'Out of time.';
		} else if (state.reveal) {
			const correct = letterByChar(state.reveal.correct);
			announcement = `${outcome === 'wrong' ? 'Not quite' : 'Out of time'}. It was ${correct.name}.`;
		}
	}

	onMount(() => {
		if (player) startRound();
		return () => {
			runner?.stop();
			clearTimeout(flashTimer);
		};
	});
</script>

<svelte:head><title>Sprint · Harf Sprint</title></svelte:head>

{#if player && runner}
	{@const s = runner.state}
	{#if s.phase === 'finished'}
		<ResultsView
			state={s}
			{save}
			rows={boardRows(store.data, boardKey(s.config))}
			currentPlayerId={player.id}
			onagain={startRound}
		/>
	{:else}
		<!-- inert keeps keyboard focus inside the modal pause dialog. -->
		<header inert={s.phase === 'paused'} class="mb-4 flex items-center gap-3">
			<a href={resolve('/modes')} class={buttonClass('ghost', { size: 'sm', class: '-ml-2' })}
				>Quit</a
			>
			<span class="flex-1"></span>
			<Chip data-testid="sprint-score">Score {s.score}</Chip>
			<Chip tone="crimson" data-testid="sprint-time">{Math.ceil(s.sprintLeft / 1000)}s</Chip>
		</header>

		<main inert={s.phase === 'paused'} class="flex flex-1 flex-col gap-4">
			{#if s.phase === 'countdown' || s.resumeTo === 'countdown'}
				<div class="grid flex-1 place-items-center">
					<p class="text-9xl font-bold text-crimson-deep tabular-nums">
						{Math.ceil(s.countdownLeft / 1000)}
					</p>
				</div>
			{:else}
				<TimerBar
					fraction={s.itemLeft / itemLimit(s.config)}
					label="Time left for this {ITEM[s.config.mode]}"
				/>
				<ItemCard text={s.prompt.display} size={ITEM[s.config.mode]} {flash} />
				{#if s.prompt.kind === 'letter'}
					<AnswerGrid
						choices={s.prompt.choices}
						reveal={s.reveal}
						disabled={s.phase !== 'active'}
						onanswer={(choice) => runner?.answer(choice)}
					/>
				{:else if s.input === 'speech'}
					<div class="flex items-center gap-3">
						<MicIndicator listening={runner.listening} heard={runner.heard} />
						<Button
							variant="secondary"
							disabled={s.phase !== 'active'}
							onclick={() => runner?.skip()}
						>
							Skip
						</Button>
					</div>
				{:else}
					{#if !s.ranked && !practice}
						<p role="status" class="rounded-card bg-white/70 px-4 py-2 text-sm">
							Speech recognition is not available, so this sprint is now practice and will not be
							ranked.
						</p>
					{/if}
					<div class="grid grid-cols-2 gap-3">
						<Button
							variant="secondary"
							class="py-3 text-lg"
							disabled={s.phase !== 'active'}
							onclick={() => runner?.selfReport(false)}
						>
							Missed
						</Button>
						<Button
							class="py-3 text-lg"
							disabled={s.phase !== 'active'}
							onclick={() => runner?.selfReport(true)}
						>
							Got it
						</Button>
					</div>
				{/if}
			{/if}
		</main>
	{/if}

	{#if s.phase === 'paused'}
		<div class="fixed inset-0 z-10 grid place-items-center bg-ink/40 px-4 backdrop-blur-sm">
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="paused-title"
				class="w-full max-w-sm rounded-item bg-white p-6 text-center shadow-item"
			>
				<h2 id="paused-title" class="text-2xl font-bold">Paused</h2>
				<p class="mt-1 text-ink/70">The clock stops while you are away.</p>
				<Button
					class="mt-4 w-full"
					onclick={() => runner?.resume()}
					{@attach (node) => node.focus()}
				>
					Continue
				</Button>
			</div>
		</div>
	{/if}

	<p class="sr-only" aria-live="polite">{announcement}</p>
{/if}
```

- [ ] **Step 7: Run the e2e tests and all gates**

Run: `pnpm exec playwright test tests/e2e/speech-sprint.e2e.ts --repeat-each=3`
Expected: PASS, no flaky failures.
Then run: `pnpm test:unit --run && pnpm lint && pnpm check && pnpm test:e2e`
Expected: all pass, including every letters e2e test.

- [ ] **Step 8: Commit**

```bash
git add src tests
git commit -m "feat: play words and sentences by reading aloud

Claude-Session: https://claude.ai/code/session_01QWMbjMc8aiczKFP1fL5faM"
```

---

### Task 5: Setup screen for words and sentences, with the mic check

Spec 6 (`/modes`, mic check), 10 (unsupported and denied microphone) and 5.6.

**Files:**

- Create: `src/lib/speech/session.ts`, `src/lib/ui/MicCheck.svelte`, `tests/e2e/mic-check.e2e.ts`
- Modify: `src/routes/modes/+page.svelte` (full replacement), `tests/e2e/modes.e2e.ts`, `tests/e2e/screens.e2e.ts` (focus targets)

**Interfaces:**

- Consumes: `createWebSpeechListener`, `SpeechError` (Task 2); `MicIndicator` (Task 4); `matchTranscript` (Phase 2A); `installFakeSpeech`, `say` (Task 4); `PACK_VARIANTS`, `Setup`, `boardKey`, `ITEM_LIMIT_MS` (`src/lib/game/levels.ts`)
- Produces:
  - `micSession: { readonly checked: boolean; pass(): void }` - in memory only, so a reload asks again
  - `<MicCheck onpass onpractice oncancel>`: a region named "Microphone check" with states intro, listening, and failure (`not-allowed`, `network`, `unsupported`, `other`, `timeout` after 8 s)
  - `/modes` navigates to `/play?mode=<mode>&level=<level>&variant=<variant>` and adds `&practice=1` for practice

- [ ] **Step 1: Write the failing e2e tests**

Create `tests/e2e/mic-check.e2e.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';
import { createPlayer, pauseClock } from './helpers';
import { installFakeSpeech, say } from './speech';

const micCheck = (page: Page) => page.getByRole('region', { name: 'Microphone check' });

test('a passed mic check starts the speech sprint and is not asked again this session', async ({
	page
}) => {
	await installFakeSpeech(page);
	await createPlayer(page, 'Sara');
	await page.getByRole('button', { name: /Words/ }).click();
	await expect(page.getByRole('group', { name: 'Content' })).toBeVisible();
	await expect(page.getByText('6 seconds per word')).toBeVisible();
	await page.getByRole('button', { name: 'Modern Standard' }).click();
	await page.getByRole('button', { name: 'Start' }).click();

	await expect(micCheck(page)).toContainText('Chrome sends your voice to Google');
	await micCheck(page).getByRole('button', { name: 'Start check' }).click();
	await expect(micCheck(page).getByTestId('mic')).toContainText('Listening');
	await say(page, 'بسم الله');
	await expect(page).toHaveURL('/play?mode=words&level=normal&variant=msa');

	await page.getByRole('link', { name: 'Quit' }).click();
	await expect(page).toHaveURL('/modes');
	await page.getByRole('button', { name: /Sentences/ }).click();
	await page.getByRole('button', { name: 'Start' }).click();
	await expect(page).toHaveURL('/play?mode=sentences&level=normal&variant=quran');
});

test('a blocked microphone explains how to allow it and offers practice', async ({ page }) => {
	await installFakeSpeech(page, { denied: true });
	await createPlayer(page, 'Sara');
	await page.getByRole('button', { name: /Words/ }).click();
	await page.getByRole('button', { name: 'Start' }).click();
	await micCheck(page).getByRole('button', { name: 'Start check' }).click();
	await expect(micCheck(page).getByRole('alert')).toContainText('The microphone is blocked');
	await micCheck(page).getByRole('button', { name: 'Practice' }).click();
	await expect(page).toHaveURL('/play?mode=words&level=normal&variant=quran&practice=1');
});

test('a check that hears nothing times out and can be retried', async ({ page }) => {
	await pauseClock(page);
	await installFakeSpeech(page);
	await createPlayer(page, 'Sara');
	await page.getByRole('button', { name: /Sentences/ }).click();
	await page.getByRole('button', { name: 'Start' }).click();
	await micCheck(page).getByRole('button', { name: 'Start check' }).click();
	await expect(micCheck(page).getByTestId('mic')).toContainText('Listening');
	await page.clock.fastForward(8_000);
	await expect(micCheck(page).getByRole('alert')).toContainText('We did not hear it');
	await micCheck(page).getByRole('button', { name: 'Try again' }).click();
	await say(page, 'بسم الله');
	await expect(page).toHaveURL('/play?mode=sentences&level=normal&variant=quran');
});

test('a browser without speech recognition offers practice only', async ({ page }) => {
	await installFakeSpeech(page, { unsupported: true });
	await createPlayer(page, 'Sara');
	await page.getByRole('button', { name: /Words/ }).click();
	await page.getByRole('button', { name: 'Start' }).click();
	await expect(micCheck(page).getByRole('alert')).toContainText(
		'This browser cannot recognize speech'
	);
	await expect(micCheck(page).getByRole('button', { name: 'Try again' })).toBeHidden();
	await micCheck(page).getByRole('button', { name: 'Practice' }).click();
	await expect(page).toHaveURL('/play?mode=words&level=normal&variant=quran&practice=1');
});

test('Cancel closes the mic check', async ({ page }) => {
	await installFakeSpeech(page);
	await createPlayer(page, 'Sara');
	await page.getByRole('button', { name: /Words/ }).click();
	await page.getByRole('button', { name: 'Start' }).click();
	await micCheck(page).getByRole('button', { name: 'Cancel' }).click();
	await expect(micCheck(page)).toBeHidden();
	await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
});
```

In `tests/e2e/modes.e2e.ts`, in "sets up a letters sprint", replace the two `toBeDisabled()` assertions with:

```ts
await expect(page.getByRole('button', { name: /Words/ })).toBeEnabled();
await expect(page.getByRole('button', { name: /Sentences/ })).toBeEnabled();
```

In `tests/e2e/screens.e2e.ts`, in the keyboard focus test, the Words and Sentences tiles are now focusable. Replace the `targets` array with:

```ts
const targets = [
	page.getByRole('link', { name: 'Switch player' }),
	page.getByRole('button', { name: /Letters/ }),
	page.getByRole('button', { name: /Words/ }),
	page.getByRole('button', { name: /Sentences/ }),
	page.getByRole('button', { name: 'Relaxed' }),
	page.getByRole('button', { name: 'Normal' }),
	page.getByRole('button', { name: 'Fast' }),
	page.getByRole('button', { name: 'Isolated' }),
	page.getByRole('button', { name: 'All forms' }),
	page.getByRole('button', { name: 'Start' })
];
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm exec playwright test tests/e2e/mic-check.e2e.ts tests/e2e/modes.e2e.ts`
Expected: FAIL (the Words tile is disabled and there is no mic check).

- [ ] **Step 3: Add the session flag and the mic check panel**

Create `src/lib/speech/session.ts`:

```ts
let checked = false;

/** Whether the mic check passed in this page session; kept in memory, so a reload asks again (spec 6). */
export const micSession = {
	get checked() {
		return checked;
	},
	pass() {
		checked = true;
	}
};
```

Create `src/lib/ui/MicCheck.svelte`:

```svelte
<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { SpeechError } from '$lib/speech/listener';
	import { matchTranscript } from '$lib/speech/match';
	import { micSession } from '$lib/speech/session';
	import { createWebSpeechListener } from '$lib/speech/web-speech';
	import Button from './Button.svelte';
	import MicIndicator from './MicIndicator.svelte';

	type Props = { onpass: () => void; onpractice: () => void; oncancel: () => void };

	let { onpass, onpractice, oncancel }: Props = $props();

	/** Said aloud to prove the microphone and the recognizer work (spec 6). */
	const PHRASE = 'بِسْمِ اللَّهِ';
	const TIMEOUT_MS = 8_000;

	type Failure = SpeechError | 'timeout';

	const MESSAGES: Record<Failure, string> = {
		'not-allowed':
			'The microphone is blocked. Allow microphone access for this site in your browser settings, then try again.',
		network:
			'Speech recognition needs an internet connection. Check your connection and try again.',
		unsupported:
			'This browser cannot recognize speech. Use Chrome, Edge or Safari to be ranked, or practice without the microphone.',
		other: 'Speech recognition stopped unexpectedly. Try again.',
		timeout: 'We did not hear it. Check that your microphone is on and try again.'
	};

	const id = $props.id();
	const listener = createWebSpeechListener();
	let status = $state<'intro' | 'listening' | Failure>(
		listener.supported ? 'intro' : 'unsupported'
	);
	let listening = $state(false);
	let heard = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;

	function end() {
		clearTimeout(timer);
		listener.stop();
	}

	function begin() {
		heard = '';
		status = 'listening';
		timer = setTimeout(() => {
			listener.stop();
			status = 'timeout';
		}, TIMEOUT_MS);
		listener.start({
			onTranscript: ({ text }) => {
				heard = text;
				if (!matchTranscript(PHRASE, text, 'sentence').matched) return;
				end();
				micSession.pass();
				onpass();
			},
			onError: (error) => {
				clearTimeout(timer);
				status = error;
			},
			onListeningChange: (value) => {
				listening = value;
			}
		});
	}

	function cancel() {
		end();
		oncancel();
	}

	onDestroy(end);
</script>

<section
	aria-labelledby="{id}-title"
	class="flex flex-col gap-3 rounded-card bg-white p-4 shadow-soft"
>
	<h2 id="{id}-title" class="font-bold">Microphone check</h2>

	{#if status === 'intro'}
		<p>
			Say <span lang="ar" dir="rtl" class="font-arabic text-xl font-bold">{PHRASE}</span> to check your
			microphone.
		</p>
		<p class="text-sm text-ink/75">
			Chrome sends your voice to Google to recognize it, so you need an internet connection.
		</p>
		<div class="grid grid-cols-2 gap-3">
			<Button variant="secondary" onclick={cancel}>Cancel</Button>
			<Button onclick={begin}>Start check</Button>
		</div>
	{:else if status === 'listening'}
		<p class="text-center text-sm text-ink/75">Say</p>
		<p lang="ar" dir="rtl" class="text-center font-arabic text-4xl leading-loose font-bold">
			{PHRASE}
		</p>
		<MicIndicator {listening} {heard} />
		<Button variant="secondary" onclick={cancel}>Cancel</Button>
	{:else}
		<p role="alert">{MESSAGES[status]}</p>
		<p class="text-sm text-ink/75">Practice uses Got it and Missed buttons and is not ranked.</p>
		<div class="grid grid-cols-2 gap-3">
			{#if status === 'unsupported'}
				<Button variant="secondary" onclick={cancel}>Cancel</Button>
			{:else}
				<Button variant="secondary" onclick={begin}>Try again</Button>
			{/if}
			<Button onclick={onpractice}>Practice</Button>
		</div>
	{/if}
</section>
```

- [ ] **Step 4: Replace the setup screen**

Replace `src/routes/modes/+page.svelte` with:

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		ITEM_LIMIT_MS,
		LETTER_VARIANTS,
		LEVELS,
		LEVEL_LABELS,
		PACK_VARIANTS,
		VARIANT_LABELS,
		boardKey,
		type LetterVariant,
		type Level,
		type Mode,
		type PackVariant,
		type Setup
	} from '$lib/game/levels';
	import { accuracy } from '$lib/game/scoring';
	import { micSession } from '$lib/speech/session';
	import { getStore } from '$lib/storage/app-store';
	import { playerBest } from '$lib/storage/boards';
	import Avatar from '$lib/ui/Avatar.svelte';
	import Button from '$lib/ui/Button.svelte';
	import MicCheck from '$lib/ui/MicCheck.svelte';
	import ModeTile from '$lib/ui/ModeTile.svelte';
	import SegmentedControl from '$lib/ui/SegmentedControl.svelte';
	import { buttonClass } from '$lib/ui/styles';

	const store = getStore();
	const player = $derived(store.currentPlayer);

	let mode = $state<Mode>('letters');
	let level = $state<Level>('normal');
	let letterVariant = $state<LetterVariant>('isolated');
	let packVariant = $state<PackVariant>('quran');
	let checking = $state(false);

	const setup = $derived<Setup>(
		mode === 'letters'
			? { mode, level, variant: letterVariant }
			: { mode, level, variant: packVariant }
	);
	const best = $derived(player ? playerBest(store.data, boardKey(setup), player.id) : undefined);

	const ITEM = { letters: 'letter', words: 'word', sentences: 'sentence' } as const;
	const levelOptions = LEVELS.map((value) => ({ value, label: LEVEL_LABELS[value] }));
	const letterOptions = LETTER_VARIANTS.map((value) => ({ value, label: VARIANT_LABELS[value] }));
	const packOptions = PACK_VARIANTS.map((value) => ({ value, label: VARIANT_LABELS[value] }));
	const VARIANT_HINTS: Record<LetterVariant | PackVariant, string> = {
		isolated: 'Each letter on its own',
		forms: 'Letters as they look at the start, middle or end of a word',
		quran: 'Words and short ayat from the Quran',
		msa: 'Everyday words and sentences'
	};

	$effect(() => {
		if (!player) goto(resolve('/'), { replaceState: true });
	});

	function selectMode(next: Mode) {
		mode = next;
		checking = false;
	}

	function play(practice: boolean) {
		const query = new URLSearchParams({
			mode: setup.mode,
			level: setup.level,
			variant: setup.variant
		});
		if (practice) query.set('practice', '1');
		// resolve() cannot add a query string, so the resolved path is extended here.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`${resolve('/play')}?${query}`);
	}

	function start() {
		if (setup.mode === 'letters' || micSession.checked) play(false);
		else checking = true;
	}
</script>

<svelte:head><title>Pick a sprint · Harf Sprint</title></svelte:head>

{#if player}
	<header class="mb-6 flex items-center gap-3">
		<Avatar name={player.name} seed={player.id} />
		<div class="min-w-0 flex-1">
			<p class="text-xs text-ink/75">Playing as</p>
			<p dir="auto" class="truncate text-left font-bold">{player.name}</p>
		</div>
		<a href={resolve('/')} class={buttonClass('ghost', { size: 'sm', class: '-mr-2 text-sm' })}
			>Switch player</a
		>
	</header>

	<main class="flex flex-1 flex-col gap-6">
		<h1 class="text-2xl font-bold">Pick a sprint</h1>

		<div class="grid grid-cols-3 gap-3">
			<ModeTile
				arabic="ب"
				title="Letters"
				subtitle="Pick the name"
				selected={mode === 'letters'}
				onclick={() => selectMode('letters')}
			/>
			<ModeTile
				arabic="كَلِمَة"
				title="Words"
				subtitle="Read aloud"
				selected={mode === 'words'}
				onclick={() => selectMode('words')}
			/>
			<ModeTile
				arabic="جُمْلَة"
				title="Sentences"
				subtitle="Read aloud"
				selected={mode === 'sentences'}
				onclick={() => selectMode('sentences')}
			/>
		</div>

		<section class="flex flex-col gap-2">
			<h2 class="font-bold">Speed</h2>
			<SegmentedControl label="Speed" options={levelOptions} bind:value={level} />
			<p class="text-sm text-ink/75">
				{ITEM_LIMIT_MS[mode][level] / 1000} seconds per {ITEM[mode]}
			</p>
		</section>

		<section class="flex flex-col gap-2">
			{#if mode === 'letters'}
				<h2 class="font-bold">Letter shapes</h2>
				<SegmentedControl
					label="Letter shapes"
					options={letterOptions}
					bind:value={letterVariant}
				/>
			{:else}
				<h2 class="font-bold">Content</h2>
				<SegmentedControl label="Content" options={packOptions} bind:value={packVariant} />
			{/if}
			<p class="text-sm text-ink/75">{VARIANT_HINTS[setup.variant]}</p>
		</section>

		<dl class="grid grid-cols-3 gap-3 rounded-card bg-white p-4 text-center shadow-soft">
			<div>
				<dt class="text-xs text-ink/75">Best</dt>
				<dd class="text-2xl font-bold tabular-nums">{best ? best.run.score : '-'}</dd>
			</div>
			<div>
				<dt class="text-xs text-ink/75">Rank</dt>
				<dd class="text-2xl font-bold tabular-nums">{best ? `#${best.rank}` : '-'}</dd>
			</div>
			<div>
				<dt class="text-xs text-ink/75">Accuracy</dt>
				<dd class="text-2xl font-bold tabular-nums">
					{best ? `${Math.round(accuracy(best.run.correct, best.run.attempts) * 100)}%` : '-'}
				</dd>
			</div>
		</dl>

		{#if checking}
			<MicCheck
				onpass={() => play(false)}
				onpractice={() => play(true)}
				oncancel={() => (checking = false)}
			/>
		{:else}
			<Button class="mt-auto w-full text-lg" onclick={start}>Start</Button>
		{/if}
	</main>
{/if}
```

- [ ] **Step 5: Run the e2e tests and all gates**

Run: `pnpm exec playwright test tests/e2e/mic-check.e2e.ts tests/e2e/modes.e2e.ts --repeat-each=3`
Expected: PASS, no flaky failures.
Then run: `pnpm test:unit --run && pnpm lint && pnpm check && pnpm test:e2e`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat: set up word and sentence sprints with a microphone check

Claude-Session: https://claude.ai/code/session_01QWMbjMc8aiczKFP1fL5faM"
```

---

### Task 6: Leaderboards for every mode, screen review and quality gates

Spec 6 (`/leaderboard`), 8.9, 11.2 (screens at phone and desktop sizes) and 11.4.

**Files:**

- Modify: `src/routes/leaderboard/+page.svelte` (full replacement), `tests/e2e/leaderboard.e2e.ts`, `tests/e2e/screens.e2e.ts`
- Modify: any UI file the screen review shows needs fixing

**Interfaces:**

- Consumes: everything from Tasks 1 to 5; `installFakeSpeech`, `say` (Task 4)

- [ ] **Step 1: Update the leaderboard test**

In `tests/e2e/leaderboard.e2e.ts`:

1. In `seedData()`, add a words board to `bests`:

```ts
'words:normal:quran': { p0: run('p0', 12, 'words:normal:quran') },
```

2. Delete the line `await expect(page.getByRole('button', { name: 'Words' })).toBeDisabled();`.
3. Append to the end of the test:

```ts
await page.getByRole('button', { name: 'Words' }).click();
await page.getByRole('button', { name: 'Normal' }).click();
await expect(page.getByRole('group', { name: 'Content' })).toBeVisible();
await expect(rows).toHaveCount(1);
await expect(rows.first()).toContainText('Player 1');
await expect(rows.first()).toContainText('12');
await page.getByRole('button', { name: 'Modern Standard' }).click();
await expect(page.getByText('No scores yet. Be the first!')).toBeVisible();
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec playwright test tests/e2e/leaderboard.e2e.ts`
Expected: FAIL (the Words tab is disabled).

- [ ] **Step 3: Replace the leaderboard page**

Replace `src/routes/leaderboard/+page.svelte` with:

```svelte
<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		LETTER_VARIANTS,
		LEVELS,
		LEVEL_LABELS,
		MODES,
		MODE_LABELS,
		PACK_VARIANTS,
		VARIANT_LABELS,
		boardKey,
		type LetterVariant,
		type Level,
		type Mode,
		type PackVariant,
		type Setup
	} from '$lib/game/levels';
	import { getStore } from '$lib/storage/app-store';
	import { boardRows } from '$lib/storage/boards';
	import LeaderboardTable from '$lib/ui/LeaderboardTable.svelte';
	import SegmentedControl from '$lib/ui/SegmentedControl.svelte';
	import { buttonClass } from '$lib/ui/styles';

	const store = getStore();

	let mode = $state<Mode>('letters');
	let level = $state<Level>('normal');
	let letterVariant = $state<LetterVariant>('isolated');
	let packVariant = $state<PackVariant>('quran');

	const modeOptions = MODES.map((value) => ({ value, label: MODE_LABELS[value] }));
	const levelOptions = LEVELS.map((value) => ({ value, label: LEVEL_LABELS[value] }));
	const letterOptions = LETTER_VARIANTS.map((value) => ({ value, label: VARIANT_LABELS[value] }));
	const packOptions = PACK_VARIANTS.map((value) => ({ value, label: VARIANT_LABELS[value] }));

	const setup = $derived<Setup>(
		mode === 'letters'
			? { mode, level, variant: letterVariant }
			: { mode, level, variant: packVariant }
	);
	const rows = $derived(boardRows(store.data, boardKey(setup)));
</script>

<svelte:head><title>Leaderboard · Harf Sprint</title></svelte:head>

<header class="mb-6 flex items-center gap-3">
	<a href={resolve('/')} class={buttonClass('ghost', { size: 'sm', class: '-ml-2' })}>Back</a>
	<h1 class="text-2xl font-bold">Leaderboard</h1>
</header>

<main class="flex flex-1 flex-col gap-3">
	<SegmentedControl label="Mode" options={modeOptions} bind:value={mode} />
	<SegmentedControl label="Speed" options={levelOptions} bind:value={level} />
	{#if mode === 'letters'}
		<SegmentedControl label="Letter shapes" options={letterOptions} bind:value={letterVariant} />
	{:else}
		<SegmentedControl label="Content" options={packOptions} bind:value={packVariant} />
	{/if}
	<div class="mt-3">
		<LeaderboardTable {rows} currentPlayerId={store.data.lastPlayerId} />
	</div>
</main>
```

- [ ] **Step 4: Capture the speech screens**

In `tests/e2e/screens.e2e.ts`, add `import { installFakeSpeech, say } from './speech';` to the imports, and add this test inside the `test.describe(viewport.name, ...)` block, after the "every screen fits and is captured" test:

```ts
test('speech screens fit and are captured', async ({ page }) => {
	await installFakeSpeech(page);
	await createPlayer(page, 'Sara');
	await page.getByRole('button', { name: /Sentences/ }).click();
	await capture(page, viewport.name, '10-modes-sentences');

	await page.getByRole('button', { name: 'Start' }).click();
	const check = page.getByRole('region', { name: 'Microphone check' });
	await check.getByRole('button', { name: 'Start check' }).click();
	await expect(check.getByTestId('mic')).toContainText('Listening');
	await capture(page, viewport.name, '11-mic-check');

	await say(page, 'بسم الله');
	await expect(page.getByText('3', { exact: true })).toBeVisible();
	await page.clock.fastForward(3_000);
	await expect(page.getByTestId('prompt')).toBeVisible();
	await say(page, 'hello');
	await expect(page.getByTestId('mic')).toContainText('hello');
	await capture(page, viewport.name, '12-sentence-sprint');

	await page.getByRole('button', { name: 'Skip' }).click();
	await page.clock.fastForward(61_000);
	await expect(page.getByRole('heading', { name: "Time's up!" })).toBeVisible();
	await capture(page, viewport.name, '13-sentence-results');

	await page.goto('/play?mode=words&level=normal&variant=msa&practice=1');
	await expect(page.getByText('3', { exact: true })).toBeVisible();
	await page.clock.fastForward(3_000);
	await expect(page.getByRole('button', { name: 'Got it' })).toBeVisible();
	await capture(page, viewport.name, '14-word-practice');

	await page.getByRole('button', { name: 'Missed' }).click();
	await page.clock.fastForward(61_000);
	await expect(page.getByText('Practice - not ranked')).toBeVisible();
	await capture(page, viewport.name, '15-practice-results');

	await page.goto('/leaderboard');
	await page.getByRole('button', { name: 'Sentences' }).click();
	await expect(page.getByRole('list', { name: 'Leaderboard' })).toContainText('Sara');
	await capture(page, viewport.name, '16-leaderboard-sentences');
});
```

- [ ] **Step 5: Run the screens and leaderboard tests**

Run: `pnpm exec playwright test tests/e2e/screens.e2e.ts tests/e2e/leaderboard.e2e.ts`
Expected: PASS. If an overflow or tap-target assertion fails, fix the named screen first.

- [ ] **Step 6: Review every new screenshot**

Copy `test-results/screens/*.png` somewhere safe (Playwright clears `test-results` on every run), then open screens 10 to 16 at both sizes with the Read tool and check:

- Sentences wrap cleanly on the card at 390px; harakat are not clipped on any line, including the top and bottom lines.
- The mic indicator's heard text truncates on one line and never pushes the Skip button off screen.
- The mic check panel reads well: the phrase is large and legible, the explanation is short, and both buttons are the same height.
- The results review list for sentences is readable: Arabic on its own line, transliteration and meaning below, no overlap.
- "Practice - not ranked" is clearly visible, and no personal best or Top 3 appears on practice results.
- Text on every new surface meets the contrast rules (hint text `text-ink/75` or darker; crimson text only on white or light pills).
- Word practice buttons (Missed, Got it) sit in thumb reach and have equal size.

Fix anything that looks off in the relevant component, re-run Step 5, and re-review.

- [ ] **Step 7: Run all quality gates and check for flakiness**

```bash
pnpm lint
pnpm check
pnpm test:unit --run
pnpm test:e2e
pnpm exec playwright test --repeat-each=3
```

Expected: everything passes with no warnings and no flaky failures. Fix flakiness at its cause.

- [ ] **Step 8: Commit**

```bash
git add src tests
git commit -m "feat: add word and sentence leaderboards and speech screen checks

Claude-Session: https://claude.ai/code/session_01QWMbjMc8aiczKFP1fL5faM"
```

---

## Phase 2 release gates

These are not code tasks; Phase 2 is not released to players until both are done.

1. **Content review:** the full Quranic and MSA packs from Phase 2A Task 4 are approved by the user or a fluent reader (spec 9.2).
2. **Manual device checks (spec 11.3):** on an HTTPS deployment, run speech sprints on Chrome desktop, Edge, Android Chrome and iOS Safari, and have at least one child read a words sprint. Deploying needs the user's go-ahead (deployment was deferred after Phase 1). Note any Safari-specific behavior (spec 14 open item) as a follow-up.
