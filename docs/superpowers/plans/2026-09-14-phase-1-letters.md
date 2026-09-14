# Harf Sprint Phase 1 (Letters) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a playable, deployed Letters mode: player profiles, 60-second multiple-choice letter sprints, results, local leaderboards and settings.

**Architecture:** Static client-only SvelteKit app (`adapter-static`, `ssr = false`, `prerender = true`).
Game rules live in pure TypeScript modules under `src/lib/game` driven by an injected clock (`now`) and RNG, so they are unit-tested without timers or a DOM.
Persistence is one localStorage key behind a repository (`src/lib/storage`) that takes a `Storage`-like backend, so it is unit-tested with an in-memory backend.
Svelte 5 runes wrappers connect these modules to the screens.

**Tech Stack:** SvelteKit 2.70, Svelte 5 runes, TypeScript (strict), Tailwind CSS 4, Vitest 4 (node environment), Playwright 1.60, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-13-arabic-reading-sprint-design.md` (read it before starting; section numbers below refer to it).

## Global Constraints

- Package manager: pnpm only. Never run npm or yarn.
- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`); no legacy `export let` or stores.
- Every internal `href` and `goto()` uses `resolve()` from `$app/paths` (lint rule `svelte/no-navigation-without-resolve` is on).
- UI copy is English; never use the em dash character in code, copy or docs.
- All Arabic text is rendered with `lang="ar"` and `dir="rtl"`; player names use `dir="auto"`.
- localStorage key: `harf-sprint:v1`. Corrupt backups: `harf-sprint:corrupt:<timestamp>`.
- Sprint 60 s of active time, 3 s countdown, 1.5 s lockout. Letters per-item limits: Relaxed 6 s, Normal 3 s, Fast 1.5 s.
- Theme tokens (spec 7.1): ink `#3b1235`, crimson `#e8175d` / `#ff4d8a`, purple `#7b3fb2` / `#9656d6`, success `#1fb574`, background `linear-gradient(170deg, #ffe0cf 0%, #ffc2d4 55%, #f6a3c6 100%)`.
- Layout: mobile-first, max width 480px, at least 16px side padding, tap targets at least 48px, visible focus rings, `prefers-reduced-motion` disables pop and shake.
- No emoji as icons. No dark mode.
- Quality gates, all passing with no warnings: `pnpm lint`, `pnpm check`, `pnpm test:unit --run`, `pnpm test:e2e`.
- Phase 1 only builds Letters. Words and Sentences appear in the UI as disabled "Coming soon" options; their engine, speech and content are Phase 2 (separate plan).

## File Map

```
src/lib/
  assets/favicon.svg        app icon (Task 1)
  content/types.ts          Letter type (Task 3)
  content/letters.ts        28 letters + lookup (Task 3)
  content/confusables.ts    shape/sound groups (Task 4)
  game/rng.ts               seeded RNG, shuffle, pick (Task 2)
  game/deck.ts              no-immediate-repeat deck (Task 2)
  game/forms.ts             positional forms via ZWJ (Task 3)
  game/distractors.ts       answer choices (Task 4)
  game/levels.ts            modes, levels, variants, limits, board keys (Task 5)
  game/scoring.ts           counters, accuracy, ranking comparator (Task 5)
  game/sprint.ts            pure sprint reducer (Task 6)
  game/sprint.svelte.ts     rAF + visibility runner (Task 12)
  storage/schema.ts         data types, validation, migration, name rules (Task 7)
  storage/store.svelte.ts   reactive repository (Task 8)
  storage/boards.ts         leaderboard queries (Task 8)
  storage/app-store.ts      lazy singleton over localStorage (Task 8)
  audio/sfx.ts              synthesized tones (Task 12)
  ui/styles.ts              shared button classes (Task 9)
  ui/Button.svelte, Chip.svelte, SegmentedControl.svelte, Avatar.svelte,
  ui/ModeTile.svelte, NoticeBanner.svelte, ConfirmPanel.svelte (Task 9)
  ui/NameForm.svelte (Task 10)
  ui/TimerBar.svelte, ItemCard.svelte, AnswerGrid.svelte (Task 12)
  ui/LeaderboardTable.svelte, ResultsView.svelte (Task 13)
src/routes/
  +layout.ts, +layout.svelte, layout.css (Tasks 1, 9)
  +page.svelte              pick player (Task 10)
  modes/+page.svelte        sprint setup (Task 11)
  play/+page.svelte         sprint + results (Tasks 12, 13)
  leaderboard/+page.svelte  (Task 14)
  settings/+page.svelte     (Task 15)
tests/e2e/                  Playwright specs (*.e2e.ts)
```

---

### Task 1: Housekeeping

Spec section 13. Removes scaffold leftovers, switches to `adapter-static`, and makes all scripts use pnpm.

**Files:**

- Move: `src/routes/spike/speech/*` to `.superpowers/spike-speech/` (gitignored reference for Phase 2)
- Delete: `src/routes/demo/`, `src/lib/vitest-examples/`, `src/lib/index.ts`
- Modify: `README.md`, `package.json`, `vite.config.ts`, `playwright.config.ts`, `src/routes/layout.css`, `src/routes/+layout.svelte`, `src/routes/+page.svelte`, `src/lib/assets/favicon.svg`, `src/app.html`
- Create: `src/routes/+layout.ts`, `tests/e2e/smoke.e2e.ts`

**Interfaces:**

- Produces: `pnpm test:unit`, `pnpm test:e2e` scripts; Playwright `testDir: 'tests/e2e'`; Vitest runs `src/**/*.spec.ts` in node.

- [ ] **Step 1: Move the spike out of the app and delete scaffold demos**

The spike has a `+server.ts` POST endpoint, which cannot exist in a static build.

```bash
mkdir -p .superpowers/spike-speech
mv src/routes/spike/speech/+page.svelte src/routes/spike/speech/+server.ts .superpowers/spike-speech/
rm -r src/routes/spike src/routes/demo src/lib/vitest-examples src/lib/index.ts
```

- [ ] **Step 2: Swap dependencies**

```bash
pnpm remove @sveltejs/adapter-auto @vitest/browser-playwright vitest-browser-svelte @tailwindcss/typography
pnpm add -D @sveltejs/adapter-static @fontsource/rubik @fontsource/noto-naskh-arabic
```

- [ ] **Step 3: Update `package.json` scripts**

Replace the `scripts` block with:

```json
"scripts": {
	"dev": "vite dev",
	"build": "vite build",
	"preview": "vite preview",
	"prepare": "svelte-kit sync || echo ''",
	"check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
	"check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch",
	"lint": "prettier --check . && eslint .",
	"format": "prettier --write .",
	"test:unit": "vitest",
	"test": "pnpm test:unit --run && pnpm test:e2e",
	"test:e2e": "playwright install chromium && playwright test"
}
```

- [ ] **Step 4: Replace `vite.config.ts`**

```ts
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	test: {
		expect: { requireAssertions: true },
		environment: 'node',
		include: ['src/**/*.spec.ts']
	}
});
```

- [ ] **Step 5: Replace `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '**/*.e2e.ts',
	webServer: { command: 'pnpm build && pnpm preview', port: 4173 },
	use: { baseURL: 'http://localhost:4173' },
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
```

- [ ] **Step 6: Make the app static and client-only**

Create `src/routes/+layout.ts`:

```ts
export const prerender = true;
export const ssr = false;
```

Replace `src/routes/layout.css`:

```css
@import 'tailwindcss';
```

Replace `src/routes/+layout.svelte`:

```svelte
<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{@render children()}
```

Replace `src/routes/+page.svelte` (temporary, rebuilt in Task 10):

```svelte
<svelte:head><title>Harf Sprint</title></svelte:head>

<h1>Harf Sprint</h1>
```

In `src/app.html`, add below the viewport meta tag:

```html
<meta name="theme-color" content="#ffc2d4" />
```

- [ ] **Step 7: Replace the favicon**

Replace `src/lib/assets/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
	<defs>
		<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="#ff4d8a" />
			<stop offset="1" stop-color="#e8175d" />
		</linearGradient>
	</defs>
	<rect width="64" height="64" rx="16" fill="url(#g)" />
	<text x="32" y="45" text-anchor="middle" font-family="serif" font-size="38" font-weight="700" fill="#fff">ح</text>
</svg>
```

Replace `README.md` (the scaffold README tells people to use npm):

````markdown
# Harf Sprint

A 60-second Arabic reading sprint for the whole family.
Letters mode is multiple choice; words and sentences with speech recognition arrive in Phase 2.
Players and scores are stored only in the browser (localStorage).

## Develop

```bash
pnpm install
pnpm dev
```

## Quality gates

```bash
pnpm lint
pnpm check
pnpm test:unit --run
pnpm test:e2e
```

## Build

`pnpm build` writes the static site to `build/`.
````

- [ ] **Step 8: Add a smoke e2e test**

Create `tests/e2e/smoke.e2e.ts`:

```ts
import { expect, test } from '@playwright/test';

test('home page renders', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveTitle('Harf Sprint');
});
```

- [ ] **Step 9: Run the gates that apply so far**

```bash
pnpm format
pnpm lint
pnpm check
pnpm build
pnpm test:e2e
```

Expected: all pass, `build/` contains `index.html`. There are no unit tests yet, so `pnpm test:unit` is not run in this task.
If `pnpm lint` reports formatting in `docs/`, `pnpm format` already fixed it; re-run `pnpm lint`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: switch to adapter-static, pnpm scripts, remove scaffold demos"
```

---

### Task 2: Seeded RNG and deck

Spec 8.3 (injected RNG) and 8.4 (deck).

**Files:**

- Create: `src/lib/game/rng.ts`, `src/lib/game/deck.ts`
- Test: `src/lib/game/rng.spec.ts`, `src/lib/game/deck.spec.ts`

**Interfaces:**

- Produces:
  - `type Rng = () => number` (float in `[0, 1)`)
  - `mulberry32(seed: number): Rng`
  - `randomInt(max: number, rng: Rng): number`
  - `pick<T>(items: readonly T[], rng: Rng): T`
  - `shuffle<T>(items: readonly T[], rng: Rng): T[]`
  - `type Deck<T> = { readonly order: readonly T[]; readonly index: number }`
  - `newDeck<T>(items: readonly T[], rng: Rng, avoidFirst?: T): Deck<T>`
  - `draw<T>(deck: Deck<T>, rng: Rng): { item: T; deck: Deck<T> }`

- [ ] **Step 1: Write the failing RNG tests**

Create `src/lib/game/rng.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mulberry32, pick, shuffle } from './rng';

describe('mulberry32', () => {
	it('is deterministic per seed and returns values in [0, 1)', () => {
		const a = mulberry32(42);
		const b = mulberry32(42);
		const values = Array.from({ length: 100 }, () => a());
		expect(values).toEqual(Array.from({ length: 100 }, () => b()));
		expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
		expect(mulberry32(43)()).not.toBe(mulberry32(42)());
	});
});

describe('shuffle', () => {
	it('returns a permutation without mutating the input', () => {
		const input = ['a', 'b', 'c', 'd', 'e'];
		const out = shuffle(input, mulberry32(1));
		expect(input).toEqual(['a', 'b', 'c', 'd', 'e']);
		expect([...out].sort()).toEqual(input);
	});
});

describe('pick', () => {
	it('picks an element and throws on an empty list', () => {
		expect(['x', 'y']).toContain(pick(['x', 'y'], mulberry32(7)));
		expect(() => pick([], mulberry32(7))).toThrow();
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit --run src/lib/game/rng.spec.ts`
Expected: FAIL, cannot resolve `./rng`.

- [ ] **Step 3: Implement `src/lib/game/rng.ts`**

```ts
/** Returns a float in [0, 1). Math.random satisfies this type. */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function randomInt(max: number, rng: Rng): number {
	return Math.floor(rng() * max);
}

export function pick<T>(items: readonly T[], rng: Rng): T {
	if (items.length === 0) throw new Error('Cannot pick from an empty list');
	return items[randomInt(items.length, rng)];
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = randomInt(i + 1, rng);
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:unit --run src/lib/game/rng.spec.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing deck tests**

Create `src/lib/game/deck.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { draw, newDeck, type Deck } from './deck';
import { mulberry32 } from './rng';

function drawMany<T>(deck: Deck<T>, count: number, seed: number): T[] {
	const rng = mulberry32(seed);
	const items: T[] = [];
	let current = deck;
	for (let i = 0; i < count; i++) {
		const result = draw(current, rng);
		items.push(result.item);
		current = result.deck;
	}
	return items;
}

describe('deck', () => {
	it('deals every item once before repeating', () => {
		const items = ['a', 'b', 'c', 'd', 'e'];
		const dealt = drawMany(newDeck(items, mulberry32(3)), 5, 3);
		expect([...dealt].sort()).toEqual(items);
	});

	it('never repeats an item immediately across reshuffles', () => {
		for (let seed = 1; seed <= 300; seed++) {
			const dealt = drawMany(newDeck(['a', 'b', 'c'], mulberry32(seed)), 30, seed);
			for (let i = 1; i < dealt.length; i++) expect(dealt[i]).not.toBe(dealt[i - 1]);
		}
	});

	it('keeps dealing a single-item deck', () => {
		expect(drawMany(newDeck(['only'], mulberry32(1)), 3, 1)).toEqual(['only', 'only', 'only']);
	});

	it('rejects an empty deck', () => {
		expect(() => newDeck([], mulberry32(1))).toThrow();
	});
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm test:unit --run src/lib/game/deck.spec.ts`
Expected: FAIL, cannot resolve `./deck`.

- [ ] **Step 7: Implement `src/lib/game/deck.ts`**

```ts
import { shuffle, type Rng } from './rng';

export type Deck<T> = { readonly order: readonly T[]; readonly index: number };

export function newDeck<T>(items: readonly T[], rng: Rng, avoidFirst?: T): Deck<T> {
	if (items.length === 0) throw new Error('A deck needs at least one item');
	const order = shuffle(items, rng);
	if (order.length > 1 && order[0] === avoidFirst) [order[0], order[1]] = [order[1], order[0]];
	return { order, index: 0 };
}

/** Deals the next item, reshuffling when exhausted so the last item is not dealt twice in a row. */
export function draw<T>(deck: Deck<T>, rng: Rng): { item: T; deck: Deck<T> } {
	const current =
		deck.index < deck.order.length
			? deck
			: newDeck(deck.order, rng, deck.order[deck.order.length - 1]);
	return {
		item: current.order[current.index],
		deck: { order: current.order, index: current.index + 1 }
	};
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `pnpm test:unit --run src/lib/game`
Expected: PASS (rng and deck).

- [ ] **Step 9: Commit**

```bash
git add src/lib/game
git commit -m "feat: add seeded rng and no-repeat deck"
```

---

### Task 3: Letters content and positional forms

Spec 9.1 and 8.6.

**Files:**

- Create: `src/lib/content/types.ts`, `src/lib/content/letters.ts`, `src/lib/game/forms.ts`
- Test: `src/lib/content/letters.spec.ts`, `src/lib/game/forms.spec.ts`

**Interfaces:**

- Produces:
  - `type Letter = { char: string; name: string; arabicName: string; joins: boolean }` (the letter's id is `char`)
  - `LETTERS: readonly Letter[]` (28, alphabetical order), `LETTER_CHARS: readonly string[]`
  - `letterByChar(char: string): Letter` (throws on unknown)
  - `type Form = 'isolated' | 'initial' | 'medial' | 'final'`, `ZWJ = '‍'`
  - `formsFor(letter: Letter): readonly Form[]`, `renderForm(char: string, form: Form): string`

- [ ] **Step 1: Write the failing letters test**

Create `src/lib/content/letters.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LETTERS, LETTER_CHARS, letterByChar } from './letters';

describe('letters', () => {
	it('has the 28 base letters, each a single Arabic code point', () => {
		expect(LETTERS).toHaveLength(28);
		expect(new Set(LETTER_CHARS).size).toBe(28);
		for (const char of LETTER_CHARS) {
			expect([...char]).toHaveLength(1);
			expect(char.codePointAt(0)).toBeGreaterThanOrEqual(0x0627);
			expect(char.codePointAt(0)).toBeLessThanOrEqual(0x064a);
		}
	});

	it('has unique transliterated and Arabic names', () => {
		expect(new Set(LETTERS.map((l) => l.name)).size).toBe(28);
		expect(new Set(LETTERS.map((l) => l.arabicName)).size).toBe(28);
	});

	it('marks exactly the six non-joining letters', () => {
		expect(LETTERS.filter((l) => !l.joins).map((l) => l.char)).toEqual([
			'ا',
			'د',
			'ذ',
			'ر',
			'ز',
			'و'
		]);
	});

	it('looks letters up by character', () => {
		expect(letterByChar('ب').name).toBe('baa');
		expect(() => letterByChar('x')).toThrow();
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit --run src/lib/content/letters.spec.ts`
Expected: FAIL, cannot resolve `./letters`.

- [ ] **Step 3: Implement types and letters**

Create `src/lib/content/types.ts`:

```ts
export type Letter = {
	/** The isolated letter, also used as the letter's id. */
	char: string;
	/** Transliterated name shown on answer buttons. Emphatic letters are capitalized (Haa, Saad). */
	name: string;
	arabicName: string;
	/** Whether the letter connects to the following letter. */
	joins: boolean;
};
```

Create `src/lib/content/letters.ts`. Type the characters exactly as shown; `ي` must be U+064A (not `ى` U+0649 or Persian `ی` U+06CC), which the test's code point range enforces.

```ts
import type { Letter } from './types';

export const LETTERS: readonly Letter[] = [
	{ char: 'ا', name: 'alif', arabicName: 'ألف', joins: false },
	{ char: 'ب', name: 'baa', arabicName: 'باء', joins: true },
	{ char: 'ت', name: 'taa', arabicName: 'تاء', joins: true },
	{ char: 'ث', name: 'thaa', arabicName: 'ثاء', joins: true },
	{ char: 'ج', name: 'jeem', arabicName: 'جيم', joins: true },
	{ char: 'ح', name: 'Haa', arabicName: 'حاء', joins: true },
	{ char: 'خ', name: 'khaa', arabicName: 'خاء', joins: true },
	{ char: 'د', name: 'daal', arabicName: 'دال', joins: false },
	{ char: 'ذ', name: 'dhaal', arabicName: 'ذال', joins: false },
	{ char: 'ر', name: 'raa', arabicName: 'راء', joins: false },
	{ char: 'ز', name: 'zaay', arabicName: 'زاي', joins: false },
	{ char: 'س', name: 'seen', arabicName: 'سين', joins: true },
	{ char: 'ش', name: 'sheen', arabicName: 'شين', joins: true },
	{ char: 'ص', name: 'Saad', arabicName: 'صاد', joins: true },
	{ char: 'ض', name: 'Daad', arabicName: 'ضاد', joins: true },
	{ char: 'ط', name: 'Taa', arabicName: 'طاء', joins: true },
	{ char: 'ظ', name: 'Zaa', arabicName: 'ظاء', joins: true },
	{ char: 'ع', name: 'ayn', arabicName: 'عين', joins: true },
	{ char: 'غ', name: 'ghayn', arabicName: 'غين', joins: true },
	{ char: 'ف', name: 'faa', arabicName: 'فاء', joins: true },
	{ char: 'ق', name: 'qaaf', arabicName: 'قاف', joins: true },
	{ char: 'ك', name: 'kaaf', arabicName: 'كاف', joins: true },
	{ char: 'ل', name: 'laam', arabicName: 'لام', joins: true },
	{ char: 'م', name: 'meem', arabicName: 'ميم', joins: true },
	{ char: 'ن', name: 'noon', arabicName: 'نون', joins: true },
	{ char: 'ه', name: 'haa', arabicName: 'هاء', joins: true },
	{ char: 'و', name: 'waaw', arabicName: 'واو', joins: false },
	{ char: 'ي', name: 'yaa', arabicName: 'ياء', joins: true }
];

export const LETTER_CHARS: readonly string[] = LETTERS.map((letter) => letter.char);

export function letterByChar(char: string): Letter {
	const letter = LETTERS.find((l) => l.char === char);
	if (!letter) throw new Error(`Unknown letter: ${char}`);
	return letter;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:unit --run src/lib/content/letters.spec.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing forms test**

Create `src/lib/game/forms.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LETTERS, letterByChar } from '$lib/content/letters';
import { ZWJ, formsFor, renderForm } from './forms';

describe('forms', () => {
	it('places the zero-width joiner by form', () => {
		expect(renderForm('ب', 'isolated')).toBe('ب');
		expect(renderForm('ب', 'initial')).toBe(`ب${ZWJ}`);
		expect(renderForm('ب', 'medial')).toBe(`${ZWJ}ب${ZWJ}`);
		expect(renderForm('ب', 'final')).toBe(`${ZWJ}ب`);
	});

	it('limits non-joining letters to isolated and final', () => {
		expect(formsFor(letterByChar('د'))).toEqual(['isolated', 'final']);
		expect(formsFor(letterByChar('ب'))).toEqual(['isolated', 'initial', 'medial', 'final']);
		for (const letter of LETTERS.filter((l) => !l.joins)) {
			expect(formsFor(letter)).not.toContain('initial');
			expect(formsFor(letter)).not.toContain('medial');
		}
	});
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm test:unit --run src/lib/game/forms.spec.ts`
Expected: FAIL, cannot resolve `./forms`.

- [ ] **Step 7: Implement `src/lib/game/forms.ts`**

```ts
import type { Letter } from '$lib/content/types';

export type Form = 'isolated' | 'initial' | 'medial' | 'final';

export const ZWJ = '‍';

const JOINING_FORMS: readonly Form[] = ['isolated', 'initial', 'medial', 'final'];
const NON_JOINING_FORMS: readonly Form[] = ['isolated', 'final'];

export function formsFor(letter: Letter): readonly Form[] {
	return letter.joins ? JOINING_FORMS : NON_JOINING_FORMS;
}

export function renderForm(char: string, form: Form): string {
	switch (form) {
		case 'isolated':
			return char;
		case 'initial':
			return char + ZWJ;
		case 'medial':
			return ZWJ + char + ZWJ;
		case 'final':
			return ZWJ + char;
	}
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `pnpm test:unit --run src/lib/content src/lib/game/forms.spec.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/content src/lib/game/forms.ts src/lib/game/forms.spec.ts
git commit -m "feat: add letters content and positional forms"
```

---

### Task 4: Confusables and answer choices

Spec 8.5.

**Files:**

- Create: `src/lib/content/confusables.ts`, `src/lib/game/distractors.ts`
- Test: `src/lib/content/confusables.spec.ts`, `src/lib/game/distractors.spec.ts`

**Interfaces:**

- Consumes: `Rng`, `shuffle` (Task 2); `LETTER_CHARS` (Task 3)
- Produces:
  - `CONFUSION_GROUPS: readonly (readonly string[])[]`
  - `confusablesOf(char: string): string[]` (unique, never includes `char`)
  - `pickDistractors(target: string, all: readonly string[], rng: Rng): string[]` (exactly 3)
  - `buildChoices(target: string, all: readonly string[], rng: Rng): string[]` (4 shuffled, includes target)

- [ ] **Step 1: Write the failing confusables test**

Create `src/lib/content/confusables.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CONFUSION_GROUPS, confusablesOf } from './confusables';
import { LETTER_CHARS } from './letters';

describe('confusables', () => {
	it('only references known letters', () => {
		for (const group of CONFUSION_GROUPS) {
			for (const char of group) expect(LETTER_CHARS).toContain(char);
		}
	});

	it('merges shape and sound groups without the letter itself', () => {
		expect(confusablesOf('ب').sort()).toEqual(['ت', 'ث', 'ن', 'ي'].sort());
		expect(confusablesOf('س').sort()).toEqual(['ث', 'ش', 'ص'].sort());
		expect(confusablesOf('ت').sort()).toEqual(['ب', 'ث', 'ط', 'ن', 'ي'].sort());
	});

	it('returns nothing for letters in no group', () => {
		expect(confusablesOf('ل')).toEqual([]);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit --run src/lib/content/confusables.spec.ts`
Expected: FAIL, cannot resolve `./confusables`.

- [ ] **Step 3: Implement `src/lib/content/confusables.ts`**

```ts
/** Letters that look alike (same base shape, different dots). */
const SHAPE_GROUPS = ['بتثني', 'جحخ', 'دذ', 'رز', 'سش', 'صض', 'طظ', 'عغ', 'فق'];

/** Letters that sound alike to learners. */
const SOUND_GROUPS = ['تط', 'دض', 'سص', 'ثس', 'ذزظ', 'حه', 'كق', 'عا'];

export const CONFUSION_GROUPS: readonly (readonly string[])[] = [
	...SHAPE_GROUPS,
	...SOUND_GROUPS
].map((group) => [...group]);

export function confusablesOf(char: string): string[] {
	const found = new Set<string>();
	for (const group of CONFUSION_GROUPS) {
		if (!group.includes(char)) continue;
		for (const other of group) if (other !== char) found.add(other);
	}
	return [...found];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:unit --run src/lib/content/confusables.spec.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing distractors test**

Create `src/lib/game/distractors.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { confusablesOf } from '$lib/content/confusables';
import { LETTER_CHARS } from '$lib/content/letters';
import { buildChoices, pickDistractors } from './distractors';
import { mulberry32 } from './rng';

describe('pickDistractors', () => {
	it('returns 3 unique letters, never the target, for every letter', () => {
		for (const target of LETTER_CHARS) {
			for (let seed = 1; seed <= 30; seed++) {
				const distractors = pickDistractors(target, LETTER_CHARS, mulberry32(seed));
				expect(distractors).toHaveLength(3);
				expect(new Set(distractors).size).toBe(3);
				expect(distractors).not.toContain(target);
			}
		}
	});

	it('includes 2 confusables when the letter has at least 2', () => {
		for (const target of LETTER_CHARS.filter((c) => confusablesOf(c).length >= 2)) {
			for (let seed = 1; seed <= 30; seed++) {
				const close = confusablesOf(target);
				const distractors = pickDistractors(target, LETTER_CHARS, mulberry32(seed));
				expect(distractors.filter((d) => close.includes(d)).length).toBeGreaterThanOrEqual(2);
			}
		}
	});

	it('includes the only confusable when there is one', () => {
		expect(pickDistractors('ك', LETTER_CHARS, mulberry32(5))).toContain('ق');
	});
});

describe('buildChoices', () => {
	it('returns 4 unique options including the target in varying positions', () => {
		const positions = new Set<number>();
		for (let seed = 1; seed <= 100; seed++) {
			const choices = buildChoices('ب', LETTER_CHARS, mulberry32(seed));
			expect(choices).toHaveLength(4);
			expect(new Set(choices).size).toBe(4);
			positions.add(choices.indexOf('ب'));
		}
		expect([...positions].sort()).toEqual([0, 1, 2, 3]);
	});
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm test:unit --run src/lib/game/distractors.spec.ts`
Expected: FAIL, cannot resolve `./distractors`.

- [ ] **Step 7: Implement `src/lib/game/distractors.ts`**

```ts
import { confusablesOf } from '$lib/content/confusables';
import { shuffle, type Rng } from './rng';

const MAX_CONFUSABLES = 2;
const DISTRACTOR_COUNT = 3;

export function pickDistractors(target: string, all: readonly string[], rng: Rng): string[] {
	const pool = all.filter((char) => char !== target);
	if (pool.length < DISTRACTOR_COUNT) throw new Error('Need at least 4 letters to build choices');
	const close = shuffle(
		confusablesOf(target).filter((char) => pool.includes(char)),
		rng
	).slice(0, MAX_CONFUSABLES);
	const rest = shuffle(
		pool.filter((char) => !close.includes(char)),
		rng
	).slice(0, DISTRACTOR_COUNT - close.length);
	return [...close, ...rest];
}

export function buildChoices(target: string, all: readonly string[], rng: Rng): string[] {
	return shuffle([target, ...pickDistractors(target, all, rng)], rng);
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `pnpm test:unit --run src/lib/content src/lib/game`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/content/confusables.ts src/lib/content/confusables.spec.ts src/lib/game/distractors.ts src/lib/game/distractors.spec.ts
git commit -m "feat: add confusable letter groups and answer choices"
```

---

### Task 5: Levels, board keys and scoring

Spec 5.2, 5.5 and 8.9.

**Files:**

- Create: `src/lib/game/levels.ts`, `src/lib/game/scoring.ts`
- Test: `src/lib/game/levels.spec.ts`, `src/lib/game/scoring.spec.ts`

**Interfaces:**

- Produces (`levels.ts`):
  - `MODES`, `type Mode = 'letters' | 'words' | 'sentences'`
  - `LEVELS`, `type Level = 'relaxed' | 'normal' | 'fast'`
  - `LETTER_VARIANTS`, `type LetterVariant = 'isolated' | 'forms'`; `PACK_VARIANTS`, `type PackVariant = 'quran' | 'msa'`
  - `type Setup = { mode: 'letters'; level: Level; variant: LetterVariant } | { mode: 'words' | 'sentences'; level: Level; variant: PackVariant }`
  - `type BoardKey` (template literal of valid setups)
  - `SPRINT_MS = 60_000`, `COUNTDOWN_MS = 3_000`, `LOCKOUT_MS = 1_500`, `ITEM_LIMIT_MS: Record<Mode, Record<Level, number>>`
  - `MODE_LABELS`, `LEVEL_LABELS`, `VARIANT_LABELS`
  - `boardKey(setup: Setup): BoardKey`, `parseBoardKey(value: string): Setup | null`, `isBoardKey(value: unknown): value is BoardKey`, `ALL_BOARD_KEYS: readonly BoardKey[]`
- Produces (`scoring.ts`):
  - `type Counters = { correct; wrong; timeouts; skips; streak; bestStreak }` (all `number`)
  - `ZERO_COUNTERS: Counters`
  - `attempts(c: Counters): number`, `accuracy(correct: number, attempts: number): number` (0 to 1)
  - `recordCorrect(c: Counters): Counters`, `recordMiss(c: Counters, kind: 'wrong' | 'timeouts' | 'skips'): Counters`
  - `type RankFields = { score: number; correct: number; attempts: number; finishedAt: string }`
  - `compareRuns(a: RankFields, b: RankFields): number` (negative when `a` ranks higher)

- [ ] **Step 1: Write the failing levels test**

Create `src/lib/game/levels.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ALL_BOARD_KEYS, ITEM_LIMIT_MS, boardKey, isBoardKey, parseBoardKey } from './levels';

describe('board keys', () => {
	it('enumerates the 18 boards', () => {
		expect(ALL_BOARD_KEYS).toHaveLength(18);
		expect(new Set(ALL_BOARD_KEYS).size).toBe(18);
		expect(ALL_BOARD_KEYS).toContain('letters:fast:forms');
		expect(ALL_BOARD_KEYS).toContain('sentences:relaxed:msa');
	});

	it('round-trips setups', () => {
		for (const key of ALL_BOARD_KEYS) {
			const setup = parseBoardKey(key);
			expect(setup).not.toBeNull();
			expect(boardKey(setup!)).toBe(key);
		}
	});

	it('rejects invalid keys', () => {
		for (const bad of [
			'letters:normal:quran',
			'words:normal:forms',
			'letters:normal',
			'letters:turbo:forms',
			'x:normal:forms',
			'letters:normal:forms:extra',
			''
		]) {
			expect(parseBoardKey(bad)).toBeNull();
			expect(isBoardKey(bad)).toBe(false);
		}
		expect(isBoardKey(42)).toBe(false);
	});

	it('uses the spec per-item limits for letters', () => {
		expect(ITEM_LIMIT_MS.letters).toEqual({ relaxed: 6_000, normal: 3_000, fast: 1_500 });
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit --run src/lib/game/levels.spec.ts`
Expected: FAIL, cannot resolve `./levels`.

- [ ] **Step 3: Implement `src/lib/game/levels.ts`**

```ts
export const MODES = ['letters', 'words', 'sentences'] as const;
export type Mode = (typeof MODES)[number];

export const LEVELS = ['relaxed', 'normal', 'fast'] as const;
export type Level = (typeof LEVELS)[number];

export const LETTER_VARIANTS = ['isolated', 'forms'] as const;
export type LetterVariant = (typeof LETTER_VARIANTS)[number];

export const PACK_VARIANTS = ['quran', 'msa'] as const;
export type PackVariant = (typeof PACK_VARIANTS)[number];

export type Setup =
	| { mode: 'letters'; level: Level; variant: LetterVariant }
	| { mode: 'words' | 'sentences'; level: Level; variant: PackVariant };

export type BoardKey =
	`letters:${Level}:${LetterVariant}` | `${'words' | 'sentences'}:${Level}:${PackVariant}`;

export const SPRINT_MS = 60_000;
export const COUNTDOWN_MS = 3_000;
export const LOCKOUT_MS = 1_500;

export const ITEM_LIMIT_MS: Record<Mode, Record<Level, number>> = {
	letters: { relaxed: 6_000, normal: 3_000, fast: 1_500 },
	words: { relaxed: 10_000, normal: 6_000, fast: 4_000 },
	sentences: { relaxed: 20_000, normal: 12_000, fast: 8_000 }
};

export const MODE_LABELS: Record<Mode, string> = {
	letters: 'Letters',
	words: 'Words',
	sentences: 'Sentences'
};

export const LEVEL_LABELS: Record<Level, string> = {
	relaxed: 'Relaxed',
	normal: 'Normal',
	fast: 'Fast'
};

export const VARIANT_LABELS: Record<LetterVariant | PackVariant, string> = {
	isolated: 'Isolated',
	forms: 'All forms',
	quran: 'Quranic',
	msa: 'Modern Standard'
};

const includes = <T extends string>(list: readonly T[], value: string): value is T =>
	(list as readonly string[]).includes(value);

export function boardKey(setup: Setup): BoardKey {
	return `${setup.mode}:${setup.level}:${setup.variant}` as BoardKey;
}

export function parseBoardKey(value: string): Setup | null {
	const [mode, level, variant, ...rest] = value.split(':');
	if (rest.length > 0 || level === undefined || variant === undefined) return null;
	if (!includes(LEVELS, level)) return null;
	if (mode === 'letters' && includes(LETTER_VARIANTS, variant)) return { mode, level, variant };
	if ((mode === 'words' || mode === 'sentences') && includes(PACK_VARIANTS, variant)) {
		return { mode, level, variant };
	}
	return null;
}

export function isBoardKey(value: unknown): value is BoardKey {
	return typeof value === 'string' && parseBoardKey(value) !== null;
}

export const ALL_BOARD_KEYS: readonly BoardKey[] = MODES.flatMap((mode) =>
	LEVELS.flatMap((level) =>
		(mode === 'letters' ? LETTER_VARIANTS : PACK_VARIANTS).map(
			(variant) => `${mode}:${level}:${variant}` as BoardKey
		)
	)
);
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:unit --run src/lib/game/levels.spec.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing scoring test**

Create `src/lib/game/scoring.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
	ZERO_COUNTERS,
	accuracy,
	attempts,
	compareRuns,
	recordCorrect,
	recordMiss,
	type RankFields
} from './scoring';

describe('counters', () => {
	it('counts attempts as correct + wrong + timeouts + skips', () => {
		expect(attempts({ ...ZERO_COUNTERS, correct: 5, wrong: 2, timeouts: 1, skips: 3 })).toBe(11);
	});

	it('tracks streak and best streak', () => {
		let c = recordCorrect(recordCorrect(ZERO_COUNTERS));
		expect(c).toMatchObject({ correct: 2, streak: 2, bestStreak: 2 });
		c = recordMiss(c, 'wrong');
		expect(c).toMatchObject({ wrong: 1, streak: 0, bestStreak: 2 });
		c = recordMiss(recordCorrect(c), 'timeouts');
		expect(c).toMatchObject({ correct: 3, timeouts: 1, streak: 0, bestStreak: 2 });
	});

	it('reports 0 accuracy with no attempts', () => {
		expect(accuracy(0, 0)).toBe(0);
		expect(accuracy(3, 4)).toBe(0.75);
	});
});

describe('compareRuns', () => {
	const run = (score: number, correct: number, tries: number, finishedAt: string): RankFields => ({
		score,
		correct,
		attempts: tries,
		finishedAt
	});

	it('orders by score, then accuracy, then earlier finish', () => {
		const a = run(10, 10, 12, '2026-01-01T00:00:03.000Z');
		const b = run(12, 12, 20, '2026-01-01T00:00:01.000Z');
		const c = run(10, 10, 10, '2026-01-01T00:00:04.000Z');
		const d = run(10, 10, 10, '2026-01-01T00:00:02.000Z');
		expect([a, b, c, d].sort(compareRuns)).toEqual([b, d, c, a]);
	});
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm test:unit --run src/lib/game/scoring.spec.ts`
Expected: FAIL, cannot resolve `./scoring`.

- [ ] **Step 7: Implement `src/lib/game/scoring.ts`**

```ts
export type Counters = {
	correct: number;
	wrong: number;
	timeouts: number;
	skips: number;
	streak: number;
	bestStreak: number;
};

export const ZERO_COUNTERS: Counters = {
	correct: 0,
	wrong: 0,
	timeouts: 0,
	skips: 0,
	streak: 0,
	bestStreak: 0
};

export function attempts(c: Counters): number {
	return c.correct + c.wrong + c.timeouts + c.skips;
}

export function accuracy(correct: number, attempts: number): number {
	return attempts === 0 ? 0 : correct / attempts;
}

export function recordCorrect(c: Counters): Counters {
	const streak = c.streak + 1;
	return { ...c, correct: c.correct + 1, streak, bestStreak: Math.max(c.bestStreak, streak) };
}

export function recordMiss(c: Counters, kind: 'wrong' | 'timeouts' | 'skips'): Counters {
	return { ...c, [kind]: c[kind] + 1, streak: 0 };
}

export type RankFields = { score: number; correct: number; attempts: number; finishedAt: string };

/** Sort comparator: negative when `a` ranks above `b` (spec 5.5). */
export function compareRuns(a: RankFields, b: RankFields): number {
	if (a.score !== b.score) return b.score - a.score;
	const byAccuracy = accuracy(b.correct, b.attempts) - accuracy(a.correct, a.attempts);
	if (byAccuracy !== 0) return byAccuracy;
	return a.finishedAt < b.finishedAt ? -1 : a.finishedAt > b.finishedAt ? 1 : 0;
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `pnpm test:unit --run src/lib/game`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/game/levels.ts src/lib/game/levels.spec.ts src/lib/game/scoring.ts src/lib/game/scoring.spec.ts
git commit -m "feat: add levels, board keys and scoring"
```

---

### Task 6: Sprint engine (pure reducer)

Spec 5.1, 5.3, 5.5 and 8.3.
Phase 1 implements the letters events (`tick`, `answer`, `pause`, `resume`); Phase 2 adds `matched`, `skip` and `selfReport`.

Time is tracked as remaining amounts (`countdownLeft`, `sprintLeft`, `itemLeft`, `lockoutLeft`) that count down to exactly 0.
Subtracting `step` where `step` equals the remaining amount always yields exactly 0, so floating point `performance.now()` values can never cause an endless loop.

**Files:**

- Create: `src/lib/game/sprint.ts`
- Test: `src/lib/game/sprint.spec.ts`

**Interfaces:**

- Consumes: `Rng`, `pick` (Task 2); `newDeck`, `draw`, `Deck` (Task 2); `LETTER_CHARS`, `letterByChar` (Task 3); `Form`, `formsFor`, `renderForm` (Task 3); `buildChoices` (Task 4); `Level`, `LetterVariant`, `COUNTDOWN_MS`, `SPRINT_MS`, `LOCKOUT_MS`, `ITEM_LIMIT_MS` (Task 5); `Counters`, `ZERO_COUNTERS`, `recordCorrect`, `recordMiss` (Task 5)
- Produces:
  - `type SprintConfig = { mode: 'letters'; level: Level; variant: LetterVariant; rng: Rng }`
  - `type LetterPrompt = { id: string; form: Form; display: string; choices: readonly string[] }`
  - `type SprintPhase = 'countdown' | 'active' | 'lockout' | 'paused' | 'finished'`
  - `type Reveal = { chosen: string | null; correct: string }`
  - `type SprintState` (fields listed in Step 3)
  - `type SprintEvent`, `type Outcome = 'correct' | 'wrong' | 'timeout' | 'finished'`
  - `createSprint(config: SprintConfig, now: number): SprintState`
  - `reduce(state: SprintState, event: SprintEvent): SprintState`
  - `itemLimit(config: SprintConfig): number`
  - `outcomeBetween(prev: SprintState, next: SprintState): Outcome | null`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/game/sprint.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { letterByChar } from '$lib/content/letters';
import { formsFor, renderForm } from './forms';
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

const config = (overrides: Partial<SprintConfig> = {}): SprintConfig => ({
	mode: 'letters',
	level: 'normal',
	variant: 'isolated',
	rng: mulberry32(1),
	...overrides
});

const tick = (s: SprintState, now: number) => reduce(s, { type: 'tick', now });
const answer = (s: SprintState, choice: string, now: number) =>
	reduce(s, { type: 'answer', choice, now });
const wrongChoice = (s: SprintState) => s.prompt.choices.find((c) => c !== s.prompt.id)!;

/** A sprint that just left the countdown at now = 3000 (normal level: 3000 ms per letter). */
const activeSprint = (overrides: Partial<SprintConfig> = {}) =>
	tick(createSprint(config(overrides), 0), COUNTDOWN_MS);

describe('countdown', () => {
	it('starts with a 3 s countdown and a ready prompt', () => {
		const s = createSprint(config(), 0);
		expect(s.phase).toBe('countdown');
		expect(s.prompt.choices).toHaveLength(4);
		expect(s.prompt.choices).toContain(s.prompt.id);
		expect(tick(s, 2_999)).toMatchObject({ phase: 'countdown', countdownLeft: 1 });
		expect(tick(s, 3_000)).toMatchObject({ phase: 'active', sprintLeft: 60_000, itemLeft: 3_000 });
	});

	it('ignores answers during the countdown', () => {
		const s = createSprint(config(), 0);
		expect(answer(s, s.prompt.id, 1_000)).toMatchObject({ phase: 'countdown', score: 0 });
	});
});

describe('answering', () => {
	it('scores a correct answer and deals a different letter immediately', () => {
		const s = activeSprint();
		const next = answer(s, s.prompt.id, 3_500);
		expect(next).toMatchObject({ phase: 'active', score: 1, itemLeft: 3_000, sprintLeft: 59_500 });
		expect(next.counters).toMatchObject({ correct: 1, streak: 1, bestStreak: 1 });
		expect(next.prompt.id).not.toBe(s.prompt.id);
	});

	it('reveals a wrong answer, locks out for 1.5 s, then deals the next letter', () => {
		const s = activeSprint();
		const choice = wrongChoice(s);
		const locked = answer(s, choice, 3_500);
		expect(locked).toMatchObject({
			phase: 'lockout',
			score: 0,
			reveal: { chosen: choice, correct: s.prompt.id },
			missed: [s.prompt.id]
		});
		expect(locked.counters.wrong).toBe(1);

		const ignored = answer(locked, s.prompt.id, 4_000);
		expect(ignored).toMatchObject({ phase: 'lockout', score: 0 });

		const next = tick(ignored, 5_000);
		expect(next).toMatchObject({
			phase: 'active',
			reveal: null,
			itemLeft: 3_000,
			sprintLeft: 58_000
		});
		expect(next.prompt.id).not.toBe(s.prompt.id);
	});

	it('records a timeout when the per-item limit passes', () => {
		const s = activeSprint();
		const timedOut = tick(s, 6_000);
		expect(timedOut).toMatchObject({
			phase: 'lockout',
			reveal: { chosen: null, correct: s.prompt.id },
			missed: [s.prompt.id]
		});
		expect(timedOut.counters.timeouts).toBe(1);
	});

	it('handles several transitions in one tick', () => {
		const s = tick(activeSprint(), 8_500);
		expect(s).toMatchObject({ phase: 'active', itemLeft: 2_000 });
		expect(s.counters.timeouts).toBe(1);
	});

	it('tracks streaks across misses', () => {
		let s = activeSprint();
		s = answer(s, s.prompt.id, 3_100);
		s = answer(s, s.prompt.id, 3_200);
		s = answer(s, wrongChoice(s), 3_300);
		expect(s.counters).toMatchObject({ correct: 2, wrong: 1, streak: 0, bestStreak: 2 });
	});

	it('lists each missed letter once', () => {
		const s = activeSprint();
		const next = answer({ ...s, missed: [s.prompt.id] }, wrongChoice(s), 3_500);
		expect(next.missed).toEqual([s.prompt.id]);
	});
});

describe('sprint end', () => {
	it('does not count the item in progress when time runs out', () => {
		let s = activeSprint();
		s = answer(s, s.prompt.id, 4_000);
		s = tick(s, 63_000);
		expect(s.phase).toBe('finished');
		expect(s.score).toBe(1);
		expect(s.counters.timeouts).toBe(13);
		expect(attempts(s.counters)).toBe(14);
	});

	it('finishes cleanly when time runs out during a lockout', () => {
		const s = activeSprint({ level: 'fast' });
		const locked = tick(s, 62_000);
		expect(locked).toMatchObject({ phase: 'lockout' });
		expect(locked.counters.timeouts).toBe(20);
		expect(tick(locked, 63_000)).toMatchObject({ phase: 'finished', reveal: null, sprintLeft: 0 });
	});

	it('ignores events once finished', () => {
		const finished = tick(activeSprint(), 70_000);
		expect(finished.phase).toBe('finished');
		expect(answer(finished, finished.prompt.id, 70_100)).toBe(finished);
		expect(tick(finished, 80_000)).toBe(finished);
	});
});

describe('pause', () => {
	it('excludes paused time from the sprint and the item', () => {
		let s = reduce(activeSprint(), { type: 'pause', now: 4_000 });
		expect(s).toMatchObject({ phase: 'paused', resumeTo: 'active' });
		s = tick(s, 30_000);
		expect(s).toMatchObject({ phase: 'paused', sprintLeft: 59_000, itemLeft: 2_000 });
		expect(answer(s, s.prompt.id, 31_000).score).toBe(0);
		s = reduce(s, { type: 'resume', now: 50_000 });
		s = tick(s, 50_500);
		expect(s).toMatchObject({ phase: 'active', sprintLeft: 58_500, itemLeft: 1_500 });
	});

	it('resumes into the countdown or lockout it paused', () => {
		let c = reduce(createSprint(config(), 0), { type: 'pause', now: 1_000 });
		c = reduce(c, { type: 'resume', now: 9_000 });
		expect(c.phase).toBe('countdown');
		expect(tick(c, 11_000).phase).toBe('active');

		const s = activeSprint();
		let l = answer(s, wrongChoice(s), 3_500);
		l = reduce(l, { type: 'pause', now: 4_000 });
		l = reduce(l, { type: 'resume', now: 20_000 });
		expect(l).toMatchObject({ phase: 'lockout', lockoutLeft: 1_000 });
	});
});

describe('letter forms', () => {
	it('uses random valid forms in the forms variant and isolated otherwise', () => {
		const seen = new Set<string>();
		let s = activeSprint({ variant: 'forms', rng: mulberry32(9) });
		for (let i = 1; i <= 200; i++) {
			const letter = letterByChar(s.prompt.id);
			expect(formsFor(letter)).toContain(s.prompt.form);
			expect(s.prompt.display).toBe(renderForm(letter.char, s.prompt.form));
			seen.add(s.prompt.form);
			s = answer(s, s.prompt.id, COUNTDOWN_MS + i * 100);
		}
		expect(seen.size).toBe(4);

		let iso = activeSprint();
		for (let i = 1; i <= 50; i++) {
			expect(iso.prompt.form).toBe('isolated');
			iso = answer(iso, iso.prompt.id, COUNTDOWN_MS + i * 100);
		}
	});
});

describe('outcomeBetween', () => {
	it('reports what changed', () => {
		const s = activeSprint();
		expect(outcomeBetween(s, tick(s, 3_100))).toBeNull();
		expect(outcomeBetween(s, answer(s, s.prompt.id, 3_100))).toBe('correct');
		expect(outcomeBetween(s, answer(s, wrongChoice(s), 3_100))).toBe('wrong');
		expect(outcomeBetween(s, tick(s, 6_000))).toBe('timeout');
		expect(outcomeBetween(s, tick(s, 70_000))).toBe('finished');
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit --run src/lib/game/sprint.spec.ts`
Expected: FAIL, cannot resolve `./sprint`.

- [ ] **Step 3: Implement `src/lib/game/sprint.ts`**

```ts
import { LETTER_CHARS, letterByChar } from '$lib/content/letters';
import { draw, newDeck, type Deck } from './deck';
import { buildChoices } from './distractors';
import { formsFor, renderForm, type Form } from './forms';
import {
	COUNTDOWN_MS,
	ITEM_LIMIT_MS,
	LOCKOUT_MS,
	SPRINT_MS,
	type Level,
	type LetterVariant
} from './levels';
import { pick, type Rng } from './rng';
import { ZERO_COUNTERS, recordCorrect, recordMiss, type Counters } from './scoring';

export type SprintConfig = { mode: 'letters'; level: Level; variant: LetterVariant; rng: Rng };

export type LetterPrompt = {
	/** The letter character; also the correct choice. */
	id: string;
	form: Form;
	/** Text to render, including zero-width joiners for positional forms. */
	display: string;
	choices: readonly string[];
};

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
	readonly deck: Deck<string>;
	readonly prompt: LetterPrompt;
	readonly reveal: Reveal | null;
	readonly counters: Counters;
	readonly score: number;
	readonly missed: readonly string[];
};

export type SprintEvent =
	| { type: 'tick'; now: number }
	| { type: 'answer'; choice: string; now: number }
	| { type: 'pause'; now: number }
	| { type: 'resume'; now: number };

export type Outcome = 'correct' | 'wrong' | 'timeout' | 'finished';

export function itemLimit(config: SprintConfig): number {
	return ITEM_LIMIT_MS[config.mode][config.level];
}

function deal(
	deck: Deck<string>,
	config: SprintConfig
): { deck: Deck<string>; prompt: LetterPrompt } {
	const drawn = draw(deck, config.rng);
	const letter = letterByChar(drawn.item);
	const form = config.variant === 'forms' ? pick(formsFor(letter), config.rng) : 'isolated';
	return {
		deck: drawn.deck,
		prompt: {
			id: letter.char,
			form,
			display: renderForm(letter.char, form),
			choices: buildChoices(letter.char, LETTER_CHARS, config.rng)
		}
	};
}

export function createSprint(config: SprintConfig, now: number): SprintState {
	const { deck, prompt } = deal(newDeck(LETTER_CHARS, config.rng), config);
	return {
		config,
		phase: 'countdown',
		resumeTo: null,
		lastEventAt: now,
		countdownLeft: COUNTDOWN_MS,
		sprintLeft: SPRINT_MS,
		itemLeft: itemLimit(config),
		lockoutLeft: 0,
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

function miss(state: SprintState, kind: 'wrong' | 'timeouts', chosen: string | null): SprintState {
	const id = state.prompt.id;
	return {
		...state,
		phase: 'lockout',
		lockoutLeft: LOCKOUT_MS,
		reveal: { chosen, correct: id },
		counters: recordMiss(state.counters, kind),
		missed: state.missed.includes(id) ? state.missed : [...state.missed, id]
	};
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
			else if (s.itemLeft === 0) s = miss(s, 'timeouts', null);
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
			return advance(state, event.now);
		case 'answer': {
			const s = advance(state, event.now);
			if (s.phase !== 'active') return s;
			if (event.choice !== s.prompt.id) return miss(s, 'wrong', event.choice);
			return nextItem({ ...s, score: s.score + 1, counters: recordCorrect(s.counters) });
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
	return null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:unit --run src/lib/game`
Expected: PASS.
If a timing assertion fails, recompute it by hand from the rules above before changing code: the tests encode spec 5.1 (lockout time counts against the sprint, the item in progress at the end is not counted).

- [ ] **Step 5: Lint and type-check**

Run: `pnpm lint && pnpm check`
Expected: no errors or warnings. Run `pnpm format` first if Prettier reports formatting.

- [ ] **Step 6: Commit**

```bash
git add src/lib/game/sprint.ts src/lib/game/sprint.spec.ts
git commit -m "feat: add pure sprint reducer for letters"
```

---

### Task 7: Storage schema, validation and name rules

Spec 8.8.

**Files:**

- Create: `src/lib/storage/schema.ts`
- Test: `src/lib/storage/schema.spec.ts`

**Interfaces:**

- Consumes: `BoardKey`, `isBoardKey` (Task 5)
- Produces:
  - `STORAGE_KEY = 'harf-sprint:v1'`, `CORRUPT_KEY_PREFIX = 'harf-sprint:corrupt:'`, `RUN_CAP = 1000`, `NAME_MAX = 20`
  - `type Player = { id: string; name: string; createdAt: string }`
  - `type Run = { id; playerId; board: BoardKey; score; correct; attempts; bestStreak; missed: string[]; finishedAt }`
  - `type StoredData = { version: 1; players: Player[]; lastPlayerId: string | null; runs: Run[]; bests: Partial<Record<BoardKey, Record<string, Run>>>; settings: { sound: boolean } }`
  - `emptyData(): StoredData`, `migrate(value: unknown): unknown`, `isStoredData(value: unknown): value is StoredData`
  - `parseData(raw: string | null): { data: StoredData; corrupt: boolean }`
  - `type NameError = 'empty' | 'too-long' | 'taken'`
  - `normalizeName(name: string): string`, `validateName(name: string, players: readonly Player[], ignoreId?: string): NameError | null`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/storage/schema.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
	emptyData,
	isStoredData,
	normalizeName,
	parseData,
	validateName,
	type Player,
	type Run,
	type StoredData
} from './schema';

const run: Run = {
	id: 'r1',
	playerId: 'p1',
	board: 'letters:normal:isolated',
	score: 12,
	correct: 12,
	attempts: 15,
	bestStreak: 7,
	missed: ['ب'],
	finishedAt: '2026-09-14T10:00:00.000Z'
};

const valid: StoredData = {
	version: 1,
	players: [{ id: 'p1', name: 'Sara', createdAt: '2026-09-14T09:00:00.000Z' }],
	lastPlayerId: 'p1',
	runs: [run],
	bests: { 'letters:normal:isolated': { p1: run } },
	settings: { sound: true }
};

describe('parseData', () => {
	it('starts empty without a corruption flag when nothing is stored', () => {
		expect(parseData(null)).toEqual({ data: emptyData(), corrupt: false });
		expect(isStoredData(emptyData())).toBe(true);
	});

	it('accepts valid data', () => {
		expect(parseData(JSON.stringify(valid))).toEqual({ data: valid, corrupt: false });
	});

	it('flags unparseable or invalid data as corrupt', () => {
		const cases = [
			'{not json',
			'null',
			'[]',
			JSON.stringify({ ...valid, version: 2 }),
			JSON.stringify({ ...valid, players: [{ id: 'p1' }] }),
			JSON.stringify({ ...valid, lastPlayerId: 5 }),
			JSON.stringify({ ...valid, runs: [{ ...run, board: 'letters:turbo:isolated' }] }),
			JSON.stringify({ ...valid, runs: [{ ...run, score: -1 }] }),
			JSON.stringify({ ...valid, runs: [{ ...run, missed: [1] }] }),
			JSON.stringify({ ...valid, bests: { nope: { p1: run } } }),
			JSON.stringify({ ...valid, settings: {} })
		];
		for (const raw of cases) expect(parseData(raw)).toEqual({ data: emptyData(), corrupt: true });
	});
});

describe('names', () => {
	const players: Player[] = [{ id: 'p1', name: 'Sara', createdAt: '' }];

	it('trims and collapses whitespace', () => {
		expect(normalizeName('  Umm   Yusuf ')).toBe('Umm Yusuf');
	});

	it('validates length, emptiness and uniqueness ignoring case', () => {
		expect(validateName('   ', players)).toBe('empty');
		expect(validateName('a'.repeat(20), players)).toBeNull();
		expect(validateName('a'.repeat(21), players)).toBe('too-long');
		expect(validateName(' sara ', players)).toBe('taken');
		expect(validateName('SARA', players, 'p1')).toBeNull();
		expect(validateName('يوسف', players)).toBeNull();
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit --run src/lib/storage/schema.spec.ts`
Expected: FAIL, cannot resolve `./schema`.

- [ ] **Step 3: Implement `src/lib/storage/schema.ts`**

```ts
import { isBoardKey, type BoardKey } from '$lib/game/levels';

export const STORAGE_KEY = 'harf-sprint:v1';
export const CORRUPT_KEY_PREFIX = 'harf-sprint:corrupt:';
export const RUN_CAP = 1000;
export const NAME_MAX = 20;

export type Player = { id: string; name: string; createdAt: string };

export type Run = {
	id: string;
	playerId: string;
	board: BoardKey;
	score: number;
	correct: number;
	attempts: number;
	bestStreak: number;
	/** Item ids (letter characters in Letters mode). */
	missed: string[];
	finishedAt: string;
};

export type StoredData = {
	version: 1;
	players: Player[];
	lastPlayerId: string | null;
	/** Newest first, capped at RUN_CAP. */
	runs: Run[];
	/** Best run per board per player id. Kept separately so the run cap never loses bests. */
	bests: Partial<Record<BoardKey, Record<string, Run>>>;
	settings: { sound: boolean };
};

export function emptyData(): StoredData {
	return {
		version: 1,
		players: [],
		lastPlayerId: null,
		runs: [],
		bests: {},
		settings: { sound: true }
	};
}

const isObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

function isPlayer(v: unknown): v is Player {
	return isObject(v) && isString(v.id) && isString(v.name) && isString(v.createdAt);
}

function isRun(v: unknown): v is Run {
	if (!isObject(v)) return false;
	const { missed } = v;
	return (
		isString(v.id) &&
		isString(v.playerId) &&
		isBoardKey(v.board) &&
		isCount(v.score) &&
		isCount(v.correct) &&
		isCount(v.attempts) &&
		isCount(v.bestStreak) &&
		Array.isArray(missed) &&
		missed.every(isString) &&
		isString(v.finishedAt)
	);
}

export function isStoredData(value: unknown): value is StoredData {
	if (!isObject(value) || value.version !== 1) return false;
	const { players, lastPlayerId, runs, bests, settings } = value;
	return (
		Array.isArray(players) &&
		players.every(isPlayer) &&
		(lastPlayerId === null || isString(lastPlayerId)) &&
		Array.isArray(runs) &&
		runs.every(isRun) &&
		isObject(bests) &&
		Object.entries(bests).every(
			([key, byPlayer]) =>
				isBoardKey(key) && isObject(byPlayer) && Object.values(byPlayer).every(isRun)
		) &&
		isObject(settings) &&
		typeof settings.sound === 'boolean'
	);
}

/** Upgrades older stored shapes by `version`. Version 1 is the first, so this is the identity for now. */
export function migrate(value: unknown): unknown {
	return value;
}

export function parseData(raw: string | null): { data: StoredData; corrupt: boolean } {
	if (raw === null) return { data: emptyData(), corrupt: false };
	try {
		const value = migrate(JSON.parse(raw));
		if (isStoredData(value)) return { data: value, corrupt: false };
	} catch {
		// Unparseable JSON is handled as corrupt below.
	}
	return { data: emptyData(), corrupt: true };
}

export type NameError = 'empty' | 'too-long' | 'taken';

export function normalizeName(name: string): string {
	return name.trim().replace(/\s+/g, ' ');
}

export function validateName(
	name: string,
	players: readonly Player[],
	ignoreId?: string
): NameError | null {
	const normalized = normalizeName(name);
	if (normalized.length === 0) return 'empty';
	if ([...normalized].length > NAME_MAX) return 'too-long';
	const lower = normalized.toLocaleLowerCase();
	const taken = players.some((p) => p.id !== ignoreId && p.name.toLocaleLowerCase() === lower);
	return taken ? 'taken' : null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:unit --run src/lib/storage/schema.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/schema.ts src/lib/storage/schema.spec.ts
git commit -m "feat: add storage schema, validation and name rules"
```

---

### Task 8: Store, leaderboard queries and app singleton

Spec 8.8 and 8.9.
The store takes a `Storage`-like backend so tests use an in-memory map.
Every write reads the latest stored object, applies the change and writes the whole object back, so two tabs do not overwrite each other's players.

**Files:**

- Create: `src/lib/storage/store.svelte.ts`, `src/lib/storage/boards.ts`, `src/lib/storage/app-store.ts`
- Test: `src/lib/storage/store.spec.ts`, `src/lib/storage/boards.spec.ts`

**Interfaces:**

- Consumes: everything from Task 7; `compareRuns` (Task 5); `BoardKey` (Task 5)
- Produces (`store.svelte.ts`):
  - `type Backend = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>`
  - `type Notice = 'corrupt-reset' | 'write-failed'`
  - `type NewRun = Omit<Run, 'id' | 'playerId' | 'finishedAt'>`
  - `type SaveResult = { saved: false } | { saved: true; run: Run; personalBest: boolean }`
  - `createStore(backend: Backend, deps?: { now?: () => Date; uuid?: () => string })` returning `Store` with:
    - getters `data: StoredData`, `notice: Notice | null`, `currentPlayer: Player | null`
    - `reload(): void`, `dismissNotice(): void`
    - `addPlayer(name: string): { player: Player } | { error: NameError | 'write-failed' }` (also selects the new player)
    - `selectPlayer(id: string): boolean`
    - `renamePlayer(id: string, name: string): NameError | 'write-failed' | null`
    - `deletePlayer(id: string): boolean`
    - `saveRun(input: NewRun): SaveResult` (for the current player)
    - `setSound(sound: boolean): boolean`, `resetAll(): boolean`
  - `type Store = ReturnType<typeof createStore>`
- Produces (`boards.ts`):
  - `type BoardRow = { rank: number; player: Player; run: Run }`
  - `boardRows(data: StoredData, board: BoardKey): BoardRow[]` (ranked, all players with a best)
  - `playerBest(data: StoredData, board: BoardKey, playerId: string): BoardRow | undefined`
  - `bestScore(data: StoredData, playerId: string): number | null` (highest score on any board)
- Produces (`app-store.ts`): `getStore(): Store` (lazy, over `localStorage`)

- [ ] **Step 1: Write the failing store tests**

Create `src/lib/storage/store.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CORRUPT_KEY_PREFIX, RUN_CAP, STORAGE_KEY, type Run, type StoredData } from './schema';
import { createStore, type Backend, type NewRun } from './store.svelte';

class MemoryBackend implements Backend {
	items = new Map<string, string>();
	failWrites = false;
	getItem(key: string) {
		return this.items.get(key) ?? null;
	}
	setItem(key: string, value: string) {
		if (this.failWrites) throw new Error('QuotaExceededError');
		this.items.set(key, value);
	}
	removeItem(key: string) {
		this.items.delete(key);
	}
}

function setup(backend = new MemoryBackend()) {
	let clock = Date.parse('2026-09-14T10:00:00.000Z');
	let ids = 0;
	const deps = { now: () => new Date((clock += 1_000)), uuid: () => `id-${++ids}` };
	return { backend, store: createStore(backend, deps), reopen: () => createStore(backend, deps) };
}

const newRun = (score: number, correct = score, attempts = score): NewRun => ({
	board: 'letters:normal:isolated',
	score,
	correct,
	attempts,
	bestStreak: 1,
	missed: []
});

describe('players', () => {
	it('adds, selects and persists a normalized player', () => {
		const { store, reopen } = setup();
		const result = store.addPlayer('  Sara  ');
		expect(result).toEqual({
			player: { id: 'id-1', name: 'Sara', createdAt: '2026-09-14T10:00:01.000Z' }
		});
		expect(store.currentPlayer?.name).toBe('Sara');
		expect(reopen().data.players.map((p) => p.name)).toEqual(['Sara']);
		expect(reopen().notice).toBeNull();
	});

	it('rejects duplicate names ignoring case', () => {
		const { store } = setup();
		store.addPlayer('Sara');
		expect(store.addPlayer('SARA')).toEqual({ error: 'taken' });
		expect(store.data.players).toHaveLength(1);
	});

	it('renames while keeping the id', () => {
		const { store } = setup();
		store.addPlayer('Sara');
		store.addPlayer('Yusuf');
		expect(store.renamePlayer('id-1', 'Yusuf')).toBe('taken');
		expect(store.renamePlayer('id-1', 'sara')).toBeNull();
		expect(store.data.players[0]).toMatchObject({ id: 'id-1', name: 'sara' });
	});

	it('deletes a player with their runs and bests', () => {
		const { store } = setup();
		store.addPlayer('Sara');
		store.saveRun(newRun(5));
		store.addPlayer('Yusuf');
		store.saveRun(newRun(3));
		expect(store.deletePlayer('id-3')).toBe(true);
		expect(store.data.players.map((p) => p.name)).toEqual(['Sara']);
		expect(store.data.lastPlayerId).toBeNull();
		expect(store.data.runs.every((r) => r.playerId === 'id-1')).toBe(true);
		expect(Object.keys(store.data.bests['letters:normal:isolated'] ?? {})).toEqual(['id-1']);
	});

	it('merges writes from another tab instead of overwriting them', () => {
		const { store: tabA, reopen } = setup();
		const tabB = reopen();
		tabA.addPlayer('Sara');
		tabB.addPlayer('Yusuf');
		expect(tabB.data.players.map((p) => p.name)).toEqual(['Sara', 'Yusuf']);
		expect(tabA.data.players).toHaveLength(1);
		tabA.reload();
		expect(tabA.data.players).toHaveLength(2);
	});
});

describe('runs', () => {
	it('saves runs and tracks personal bests', () => {
		const { store } = setup();
		store.addPlayer('Sara');
		const first = store.saveRun(newRun(10));
		expect(first).toMatchObject({ saved: true, personalBest: true });
		expect(store.saveRun(newRun(8))).toMatchObject({ saved: true, personalBest: false });
		const better = store.saveRun(newRun(11));
		expect(better).toMatchObject({ saved: true, personalBest: true });
		expect(store.data.runs.map((r) => r.score)).toEqual([11, 8, 10]);
		expect(store.data.bests['letters:normal:isolated']?.['id-1']?.score).toBe(11);
	});

	it('does not save without a current player', () => {
		const { store } = setup();
		expect(store.saveRun(newRun(10))).toEqual({ saved: false });
	});

	it('caps runs without losing bests', () => {
		const backend = new MemoryBackend();
		const best: Run = {
			...newRun(99),
			id: 'old-best',
			playerId: 'p1',
			finishedAt: '2026-01-01T00:00:00.000Z'
		};
		const filler: Run[] = Array.from({ length: RUN_CAP }, (_, i) => ({
			...newRun(1),
			id: `run-${i}`,
			playerId: 'p1',
			finishedAt: '2026-02-01T00:00:00.000Z'
		}));
		const seeded: StoredData = {
			version: 1,
			players: [{ id: 'p1', name: 'Sara', createdAt: '2026-01-01T00:00:00.000Z' }],
			lastPlayerId: 'p1',
			runs: [...filler.slice(0, RUN_CAP - 1), best],
			bests: { 'letters:normal:isolated': { p1: best } },
			settings: { sound: true }
		};
		backend.setItem(STORAGE_KEY, JSON.stringify(seeded));
		const { store } = setup(backend);
		expect(store.saveRun(newRun(2))).toMatchObject({ saved: true, personalBest: false });
		expect(store.data.runs).toHaveLength(RUN_CAP);
		expect(store.data.runs[0].score).toBe(2);
		expect(store.data.runs.some((r) => r.id === 'old-best')).toBe(false);
		expect(store.data.bests['letters:normal:isolated']?.p1?.id).toBe('old-best');
	});
});

describe('failures', () => {
	it('backs up corrupt data, starts fresh and shows a notice', () => {
		const backend = new MemoryBackend();
		backend.setItem(STORAGE_KEY, '{broken');
		const { store } = setup(backend);
		expect(store.data.players).toEqual([]);
		expect(store.notice).toBe('corrupt-reset');
		expect(backend.getItem(STORAGE_KEY)).toBeNull();
		const backups = [...backend.items.entries()].filter(([k]) => k.startsWith(CORRUPT_KEY_PREFIX));
		expect(backups.map(([, v]) => v)).toEqual(['{broken']);
		store.dismissNotice();
		expect(store.notice).toBeNull();
	});

	it('keeps playing when a write fails', () => {
		const { store, backend } = setup();
		store.addPlayer('Sara');
		backend.failWrites = true;
		expect(store.saveRun(newRun(10))).toEqual({ saved: false });
		expect(store.notice).toBe('write-failed');
		expect(store.data.runs).toEqual([]);
		expect(store.addPlayer('Yusuf')).toEqual({ error: 'write-failed' });
	});
});

describe('settings', () => {
	it('toggles sound and resets all data', () => {
		const { store, reopen } = setup();
		store.addPlayer('Sara');
		store.setSound(false);
		expect(reopen().data.settings.sound).toBe(false);
		expect(store.resetAll()).toBe(true);
		expect(store.data.players).toEqual([]);
		expect(reopen().data.settings.sound).toBe(true);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit --run src/lib/storage/store.spec.ts`
Expected: FAIL, cannot resolve `./store.svelte`.

- [ ] **Step 3: Implement `src/lib/storage/store.svelte.ts`**

```ts
import { compareRuns } from '$lib/game/scoring';
import {
	CORRUPT_KEY_PREFIX,
	RUN_CAP,
	STORAGE_KEY,
	emptyData,
	normalizeName,
	parseData,
	validateName,
	type NameError,
	type Player,
	type Run,
	type StoredData
} from './schema';

export type Backend = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type Notice = 'corrupt-reset' | 'write-failed';
export type NewRun = Omit<Run, 'id' | 'playerId' | 'finishedAt'>;
export type SaveResult = { saved: false } | { saved: true; run: Run; personalBest: boolean };

type Deps = { now?: () => Date; uuid?: () => string };

export function createStore(
	backend: Backend,
	{ now = () => new Date(), uuid = () => crypto.randomUUID() }: Deps = {}
) {
	let data = $state.raw<StoredData>(emptyData());
	let notice = $state<Notice | null>(null);

	function readRaw(): string | null {
		try {
			return backend.getItem(STORAGE_KEY);
		} catch {
			return null;
		}
	}

	function load(): void {
		const raw = readRaw();
		const result = parseData(raw);
		if (result.corrupt && raw !== null) {
			try {
				backend.setItem(CORRUPT_KEY_PREFIX + now().getTime(), raw);
			} catch {
				// The backup is best effort; the reset still happens.
			}
			try {
				backend.removeItem(STORAGE_KEY);
			} catch {
				// Ignored: the next successful write replaces the corrupt value.
			}
			notice = 'corrupt-reset';
		}
		data = result.data;
	}

	/** Reads the latest stored object, applies `change`, and writes the whole object back. */
	function commit(change: (latest: StoredData) => StoredData): boolean {
		const latest = parseData(readRaw());
		const next = change(latest.corrupt ? data : latest.data);
		try {
			backend.setItem(STORAGE_KEY, JSON.stringify(next));
		} catch {
			notice = 'write-failed';
			return false;
		}
		data = next;
		return true;
	}

	function latestPlayers(): Player[] {
		const latest = parseData(readRaw());
		return latest.corrupt ? data.players : latest.data.players;
	}

	load();

	return {
		get data() {
			return data;
		},
		get notice() {
			return notice;
		},
		get currentPlayer(): Player | null {
			return data.players.find((p) => p.id === data.lastPlayerId) ?? null;
		},
		reload: load,
		dismissNotice() {
			notice = null;
		},
		addPlayer(name: string): { player: Player } | { error: NameError | 'write-failed' } {
			const error = validateName(name, latestPlayers());
			if (error) return { error };
			const player: Player = {
				id: uuid(),
				name: normalizeName(name),
				createdAt: now().toISOString()
			};
			const ok = commit((d) => ({
				...d,
				players: [...d.players, player],
				lastPlayerId: player.id
			}));
			return ok ? { player } : { error: 'write-failed' };
		},
		selectPlayer(id: string): boolean {
			return commit((d) => ({ ...d, lastPlayerId: id }));
		},
		renamePlayer(id: string, name: string): NameError | 'write-failed' | null {
			const error = validateName(name, latestPlayers(), id);
			if (error) return error;
			const players = (d: StoredData) =>
				d.players.map((p) => (p.id === id ? { ...p, name: normalizeName(name) } : p));
			return commit((d) => ({ ...d, players: players(d) })) ? null : 'write-failed';
		},
		deletePlayer(id: string): boolean {
			return commit((d) => ({
				...d,
				players: d.players.filter((p) => p.id !== id),
				lastPlayerId: d.lastPlayerId === id ? null : d.lastPlayerId,
				runs: d.runs.filter((r) => r.playerId !== id),
				bests: Object.fromEntries(
					Object.entries(d.bests).map(([board, byPlayer]) => [
						board,
						Object.fromEntries(
							Object.entries(byPlayer ?? {}).filter(([playerId]) => playerId !== id)
						)
					])
				)
			}));
		},
		saveRun(input: NewRun): SaveResult {
			const playerId = data.lastPlayerId;
			if (!playerId) return { saved: false };
			const run: Run = { ...input, id: uuid(), playerId, finishedAt: now().toISOString() };
			let personalBest = false;
			const ok = commit((d) => {
				const board = d.bests[run.board] ?? {};
				const previous = board[playerId];
				personalBest = !previous || compareRuns(run, previous) < 0;
				return {
					...d,
					runs: [run, ...d.runs].slice(0, RUN_CAP),
					bests: personalBest ? { ...d.bests, [run.board]: { ...board, [playerId]: run } } : d.bests
				};
			});
			return ok ? { saved: true, run, personalBest } : { saved: false };
		},
		setSound(sound: boolean): boolean {
			return commit((d) => ({ ...d, settings: { ...d.settings, sound } }));
		},
		resetAll(): boolean {
			try {
				backend.removeItem(STORAGE_KEY);
			} catch {
				notice = 'write-failed';
				return false;
			}
			data = emptyData();
			return true;
		}
	};
}

export type Store = ReturnType<typeof createStore>;
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:unit --run src/lib/storage/store.spec.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing boards tests**

Create `src/lib/storage/boards.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { bestScore, boardRows, playerBest } from './boards';
import { emptyData, type Run, type StoredData } from './schema';

const run = (
	playerId: string,
	score: number,
	correct: number,
	attempts: number,
	at: string
): Run => ({
	id: `${playerId}-${score}`,
	playerId,
	board: 'letters:normal:isolated',
	score,
	correct,
	attempts,
	bestStreak: 1,
	missed: [],
	finishedAt: at
});

const data: StoredData = {
	...emptyData(),
	players: [
		{ id: 'a', name: 'Amal', createdAt: '' },
		{ id: 'b', name: 'Badr', createdAt: '' },
		{ id: 'c', name: 'Dina', createdAt: '' }
	],
	bests: {
		'letters:normal:isolated': {
			a: run('a', 10, 10, 12, '2026-01-02T00:00:00.000Z'),
			b: run('b', 10, 10, 10, '2026-01-03T00:00:00.000Z'),
			c: run('c', 14, 14, 20, '2026-01-01T00:00:00.000Z'),
			ghost: run('ghost', 50, 50, 50, '2026-01-01T00:00:00.000Z')
		},
		'letters:fast:forms': { a: { ...run('a', 21, 21, 25, ''), board: 'letters:fast:forms' } }
	}
};

describe('boards', () => {
	it('ranks existing players by the spec ranking order', () => {
		const rows = boardRows(data, 'letters:normal:isolated');
		expect(rows.map((r) => [r.rank, r.player.name])).toEqual([
			[1, 'Dina'],
			[2, 'Badr'],
			[3, 'Amal']
		]);
		expect(boardRows(data, 'letters:relaxed:isolated')).toEqual([]);
	});

	it('finds a player row and their best score across boards', () => {
		expect(playerBest(data, 'letters:normal:isolated', 'a')?.rank).toBe(3);
		expect(playerBest(data, 'letters:relaxed:isolated', 'a')).toBeUndefined();
		expect(bestScore(data, 'a')).toBe(21);
		expect(bestScore(data, 'nobody')).toBeNull();
	});
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm test:unit --run src/lib/storage/boards.spec.ts`
Expected: FAIL, cannot resolve `./boards`.

- [ ] **Step 7: Implement `src/lib/storage/boards.ts` and `src/lib/storage/app-store.ts`**

`src/lib/storage/boards.ts`:

```ts
import type { BoardKey } from '$lib/game/levels';
import { compareRuns } from '$lib/game/scoring';
import type { Player, Run, StoredData } from './schema';

export type BoardRow = { rank: number; player: Player; run: Run };

export function boardRows(data: StoredData, board: BoardKey): BoardRow[] {
	const byPlayer = data.bests[board] ?? {};
	return data.players
		.flatMap((player) => {
			const run = byPlayer[player.id];
			return run ? [{ player, run }] : [];
		})
		.sort((a, b) => compareRuns(a.run, b.run))
		.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function playerBest(
	data: StoredData,
	board: BoardKey,
	playerId: string
): BoardRow | undefined {
	return boardRows(data, board).find((row) => row.player.id === playerId);
}

export function bestScore(data: StoredData, playerId: string): number | null {
	const scores = Object.values(data.bests).flatMap((byPlayer) => {
		const run = byPlayer?.[playerId];
		return run ? [run.score] : [];
	});
	return scores.length > 0 ? Math.max(...scores) : null;
}
```

`src/lib/storage/app-store.ts`:

```ts
import { createStore, type Store } from './store.svelte';

let store: Store | undefined;

/** The app-wide store over localStorage. Created on first use, which is always in the browser (ssr = false). */
export function getStore(): Store {
	store ??= createStore(localStorage);
	return store;
}
```

- [ ] **Step 8: Run all unit tests, lint and type-check**

Run: `pnpm test:unit --run && pnpm lint && pnpm check`
Expected: all pass with no warnings.

- [ ] **Step 9: Commit**

```bash
git add src/lib/storage
git commit -m "feat: add localStorage store and leaderboard queries"
```

---

### Task 9: Theme, fonts, UI primitives and layout shell

Spec 7.1 to 7.5 and the corrupt-data notice from 8.8.

**Files:**

- Modify: `src/routes/layout.css`, `src/routes/+layout.svelte`
- Create: `src/lib/ui/styles.ts`, `src/lib/ui/Button.svelte`, `src/lib/ui/Chip.svelte`, `src/lib/ui/SegmentedControl.svelte`, `src/lib/ui/Avatar.svelte`, `src/lib/ui/ModeTile.svelte`, `src/lib/ui/NoticeBanner.svelte`, `src/lib/ui/ConfirmPanel.svelte`
- Test: `tests/e2e/notice.e2e.ts`

**Interfaces:**

- Consumes: `getStore`, `Notice` (Task 8); `STORAGE_KEY` (Task 7)
- Produces:
  - Tailwind tokens: `text-ink`, `bg-crimson`, `from-crimson-light`, `bg-purple`, `from-purple-light`, `bg-success`, `font-arabic`, `shadow-soft`, `shadow-primary`, `shadow-purple`, `shadow-item`, `rounded-card`, `rounded-item`, `rounded-button`
  - CSS classes `item-pop` and `shake` (disabled under reduced motion)
  - `buttonClass(variant?: 'primary' | 'secondary' | 'ghost' | 'danger', options?: { size?: 'md' | 'sm'; class?: string }): string`
  - `<Button variant? size? class? ...buttonAttributes>`
  - `<Chip tone?: 'white' | 'crimson' | 'purple' ...spanAttributes>`
  - `<SegmentedControl label options={{ value, label, disabled? }[]} bind:value>`
  - `<Avatar name seed size?: 'sm' | 'md' | 'lg'>`
  - `<ModeTile arabic title subtitle? selected disabled? onclick?>`
  - `<NoticeBanner notice ondismiss>`
  - `<ConfirmPanel message confirmLabel onconfirm oncancel>`

- [ ] **Step 1: Write the failing notice e2e test**

Create `tests/e2e/notice.e2e.ts`:

```ts
import { expect, test } from '@playwright/test';

test('corrupt saved data shows a dismissible notice and keeps a backup', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(() => localStorage.setItem('harf-sprint:v1', '{broken'));
	await page.reload();

	const notice = page.getByRole('status').filter({ hasText: 'could not be read' });
	await expect(notice).toBeVisible();
	await notice.getByRole('button', { name: 'Dismiss' }).click();
	await expect(notice).toBeHidden();

	const hasBackup = await page.evaluate(() =>
		Object.keys(localStorage).some((key) => key.startsWith('harf-sprint:corrupt:'))
	);
	expect(hasBackup).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:e2e tests/e2e/notice.e2e.ts`
Expected: FAIL, the notice is never visible.

- [ ] **Step 3: Replace `src/routes/layout.css`**

```css
@import 'tailwindcss';

@theme {
	--color-ink: #3b1235;
	--color-crimson: #e8175d;
	--color-crimson-light: #ff4d8a;
	--color-purple: #7b3fb2;
	--color-purple-light: #9656d6;
	--color-success: #1fb574;

	--font-sans: 'Rubik', ui-sans-serif, system-ui, sans-serif;
	--font-arabic: 'Noto Naskh Arabic', serif;

	--shadow-soft: 0 6px 18px rgba(59, 18, 53, 0.1);
	--shadow-primary: 0 10px 22px rgba(232, 23, 93, 0.35);
	--shadow-purple: 0 8px 18px rgba(123, 63, 178, 0.35);
	--shadow-item: 0 18px 40px rgba(232, 23, 93, 0.18);

	--radius-card: 20px;
	--radius-item: 28px;
	--radius-button: 18px;
}

@layer base {
	html {
		background-color: #f6a3c6;
		color: var(--color-ink);
	}

	body {
		min-height: 100dvh;
		background-image: linear-gradient(170deg, #ffe0cf 0%, #ffc2d4 55%, #f6a3c6 100%);
		font-family: var(--font-sans);
		-webkit-tap-highlight-color: transparent;
	}

	:focus-visible {
		outline: 3px solid var(--color-purple);
		outline-offset: 2px;
	}
}

@keyframes item-pop {
	from {
		transform: scale(0.94);
	}
	to {
		transform: scale(1);
	}
}

@keyframes shake {
	0%,
	100% {
		transform: translateX(0);
	}
	20%,
	60% {
		transform: translateX(-6px);
	}
	40%,
	80% {
		transform: translateX(6px);
	}
}

.item-pop {
	animation: item-pop 150ms ease-out;
}

.shake {
	animation: shake 300ms ease-in-out;
}

@media (prefers-reduced-motion: reduce) {
	.item-pop,
	.shake {
		animation: none;
	}
}
```

- [ ] **Step 4: Create the shared button classes and primitives**

`src/lib/ui/styles.ts`:

```ts
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

const BASE =
	'inline-flex min-h-12 items-center justify-center gap-2 rounded-button font-bold transition active:translate-y-px disabled:pointer-events-none disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
	primary: 'bg-linear-to-br from-crimson-light to-crimson text-white shadow-primary',
	secondary: 'bg-white text-ink shadow-soft',
	ghost: 'text-ink hover:bg-white/60',
	danger: 'text-crimson hover:bg-white/60'
};

const SIZES: Record<ButtonSize, string> = { md: 'px-5', sm: 'px-3' };

/**
 * Classes for buttons and for links styled as buttons.
 * Padding and colors come from `size` and `variant`; `class` must only add layout or text size, never conflicting utilities.
 */
export function buttonClass(
	variant: ButtonVariant = 'primary',
	options: { size?: ButtonSize; class?: string } = {}
): string {
	return [BASE, VARIANTS[variant], SIZES[options.size ?? 'md'], options.class ?? '']
		.join(' ')
		.trim();
}
```

`src/lib/ui/Button.svelte`:

```svelte
<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { buttonClass, type ButtonSize, type ButtonVariant } from './styles';

	type Props = Omit<HTMLButtonAttributes, 'class'> & {
		variant?: ButtonVariant;
		size?: ButtonSize;
		class?: string;
	};

	let {
		variant = 'primary',
		size = 'md',
		type = 'button',
		class: extra = '',
		children,
		...rest
	}: Props = $props();
</script>

<button {type} class={buttonClass(variant, { size, class: extra })} {...rest}>
	{@render children?.()}
</button>
```

`src/lib/ui/Chip.svelte`:

```svelte
<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	type Props = Omit<HTMLAttributes<HTMLSpanElement>, 'class'> & {
		tone?: 'white' | 'crimson' | 'purple';
	};

	let { tone = 'white', children, ...rest }: Props = $props();
</script>

<span
	class={[
		'inline-flex min-h-8 items-center gap-1 rounded-full px-3 text-sm font-bold tabular-nums',
		tone === 'white' && 'bg-white text-ink shadow-soft',
		tone === 'crimson' && 'bg-crimson text-white shadow-primary',
		tone === 'purple' && 'bg-linear-to-br from-purple-light to-purple text-white shadow-purple'
	]}
	{...rest}
>
	{@render children?.()}
</span>
```

`src/lib/ui/SegmentedControl.svelte`:

```svelte
<script lang="ts" generics="T extends string">
	type Option = { value: T; label: string; disabled?: boolean };
	type Props = { label: string; options: readonly Option[]; value: T };

	let { label, options, value = $bindable() }: Props = $props();
</script>

<div role="group" aria-label={label} class="flex gap-1 rounded-full bg-white/50 p-1">
	{#each options as option (option.value)}
		<button
			type="button"
			aria-pressed={value === option.value}
			disabled={option.disabled}
			class={[
				'min-h-12 flex-1 rounded-full px-3 text-sm font-bold transition disabled:opacity-40',
				value === option.value ? 'bg-white text-crimson shadow-soft' : 'text-ink/70 hover:text-ink'
			]}
			onclick={() => (value = option.value)}
		>
			{option.label}
		</button>
	{/each}
</div>
```

`src/lib/ui/Avatar.svelte`:

```svelte
<script lang="ts">
	type Props = { name: string; seed: string; size?: 'sm' | 'md' | 'lg' };

	let { name, seed, size = 'md' }: Props = $props();

	// Dark enough for white text; chosen by player id so a rename keeps the color.
	const COLORS = ['#e8175d', '#7b3fb2', '#0f7a55', '#c2410c', '#1d4ed8', '#9d174d'];

	const color = $derived(
		COLORS[[...seed].reduce((sum, char) => sum + (char.codePointAt(0) ?? 0), 0) % COLORS.length]
	);
	const initial = $derived(([...name][0] ?? '?').toLocaleUpperCase());
</script>

<span
	aria-hidden="true"
	class={[
		'grid shrink-0 place-items-center rounded-full font-bold text-white ring-2 ring-white',
		size === 'sm' && 'size-8 text-sm',
		size === 'md' && 'size-10 text-base',
		size === 'lg' && 'size-14 text-2xl'
	]}
	style:background-color={color}
>
	{initial}
</span>
```

`src/lib/ui/ModeTile.svelte`:

```svelte
<script lang="ts">
	type Props = {
		arabic: string;
		title: string;
		subtitle?: string;
		selected: boolean;
		disabled?: boolean;
		onclick?: () => void;
	};

	let { arabic, title, subtitle, selected, disabled = false, onclick }: Props = $props();
</script>

<button
	type="button"
	aria-pressed={selected}
	{disabled}
	{onclick}
	class={[
		'flex min-h-28 flex-col items-center justify-center gap-1 rounded-card p-3 text-center transition active:translate-y-px disabled:opacity-50',
		selected
			? 'bg-linear-to-br from-purple-light to-purple text-white shadow-purple'
			: 'bg-white text-ink shadow-soft'
	]}
>
	<span lang="ar" dir="rtl" class="font-arabic text-3xl leading-snug font-bold">{arabic}</span>
	<span class="font-bold">{title}</span>
	{#if subtitle}<span class="text-xs opacity-80">{subtitle}</span>{/if}
</button>
```

`src/lib/ui/NoticeBanner.svelte`:

```svelte
<script lang="ts">
	import type { Notice } from '$lib/storage/store.svelte';
	import Button from './Button.svelte';

	let { notice, ondismiss }: { notice: Notice; ondismiss: () => void } = $props();

	const MESSAGES: Record<Notice, string> = {
		'corrupt-reset':
			'Saved data could not be read, so the game started fresh. A backup copy was kept in this browser.',
		'write-failed': 'This browser could not save your latest change. The game still works.'
	};
</script>

<div role="status" class="mb-4 flex items-center gap-3 rounded-card bg-white p-4 shadow-soft">
	<p class="flex-1 text-sm">{MESSAGES[notice]}</p>
	<Button variant="ghost" onclick={ondismiss}>Dismiss</Button>
</div>
```

`src/lib/ui/ConfirmPanel.svelte`:

```svelte
<script lang="ts">
	import Button from './Button.svelte';

	type Props = {
		message: string;
		confirmLabel: string;
		onconfirm: () => void;
		oncancel: () => void;
	};

	let { message, confirmLabel, onconfirm, oncancel }: Props = $props();
</script>

<div
	role="group"
	aria-label="Confirm"
	class="flex flex-col gap-3 rounded-card bg-white p-4 shadow-soft"
>
	<p class="font-bold">{message}</p>
	<div class="grid grid-cols-2 gap-3">
		<Button variant="secondary" onclick={oncancel} {@attach (node) => node.focus()}>Cancel</Button>
		<Button onclick={onconfirm}>{confirmLabel}</Button>
	</div>
</div>
```

- [ ] **Step 5: Replace `src/routes/+layout.svelte`**

```svelte
<script lang="ts">
	import '@fontsource/rubik/500.css';
	import '@fontsource/rubik/700.css';
	import '@fontsource/rubik/900.css';
	import '@fontsource/noto-naskh-arabic/600.css';
	import '@fontsource/noto-naskh-arabic/700.css';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { getStore } from '$lib/storage/app-store';
	import { STORAGE_KEY } from '$lib/storage/schema';
	import NoticeBanner from '$lib/ui/NoticeBanner.svelte';

	let { children } = $props();

	const store = getStore();

	function onstorage(event: StorageEvent) {
		if (event.key === null || event.key === STORAGE_KEY) store.reload();
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<svelte:window {onstorage} />

<div class="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pt-6 pb-10">
	{#if store.notice}
		<NoticeBanner notice={store.notice} ondismiss={() => store.dismissNotice()} />
	{/if}
	{@render children()}
</div>
```

- [ ] **Step 6: Run the e2e test and the gates**

Run: `pnpm test:e2e && pnpm lint && pnpm check`
Expected: PASS (smoke and notice), no lint or type warnings.
If `svelte-check` rejects `{@attach}` on the `Button` component, confirm `svelte` is at least 5.29 in `node_modules/svelte/package.json`; attachments on components are forwarded through `{...rest}`.

- [ ] **Step 7: Commit**

```bash
git add src/routes src/lib/ui tests/e2e/notice.e2e.ts
git commit -m "feat: add theme tokens, fonts, UI primitives and notice banner"
```

---

### Task 10: Pick player screen

Spec 6 (`/` route, new player with inline validation) and 8.8 name rules.

**Files:**

- Modify: `src/routes/+page.svelte`
- Create: `src/lib/ui/NameForm.svelte`, `tests/e2e/helpers.ts`, `tests/e2e/players.e2e.ts`
- Delete: `tests/e2e/smoke.e2e.ts` (covered by the players test)

**Interfaces:**

- Consumes: `getStore` (Task 8); `bestScore` (Task 8); `NameError`, `NAME_MAX` (Task 7); `Avatar`, `buttonClass`, `Button` (Task 9)
- Produces:
  - `<NameForm label submitLabel initial? onsubmit={(name) => NameError | 'write-failed' | null} oncancel?>`
  - `createPlayer(page: Page, name: string): Promise<void>` in `tests/e2e/helpers.ts` (ends on `/modes`)

- [ ] **Step 1: Write the failing e2e tests**

Create `tests/e2e/helpers.ts`:

```ts
import { expect, type Page } from '@playwright/test';

/** Creates a player from the pick player screen and waits for the setup screen. */
export async function createPlayer(page: Page, name: string) {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Harf Sprint' })).toBeVisible();
	const add = page.getByRole('button', { name: 'New player' });
	if (await add.isVisible()) await add.click();
	await page.getByLabel('Your name').fill(name);
	await page.getByRole('button', { name: "Let's go" }).click();
	await expect(page).toHaveURL('/modes');
}
```

Create `tests/e2e/players.e2e.ts`:

```ts
import { expect, test } from '@playwright/test';
import { createPlayer } from './helpers';

test('creates a player and remembers them after a reload', async ({ page }) => {
	await createPlayer(page, '  Sara  ');
	await page.goto('/');
	await page.reload();
	await expect(page).toHaveTitle('Harf Sprint');
	const card = page.getByRole('button', { name: /Sara/ });
	await expect(card).toContainText('No scores yet');
	await card.click();
	await expect(page).toHaveURL('/modes');
});

test('rejects a duplicate name ignoring case, and an empty name', async ({ page }) => {
	await createPlayer(page, 'Sara');
	await page.goto('/');
	await page.getByRole('button', { name: 'New player' }).click();
	const input = page.getByLabel('Your name');

	await input.fill('  sara ');
	await page.getByRole('button', { name: "Let's go" }).click();
	await expect(page.getByText('That name is already taken.')).toBeVisible();
	await expect(input).toHaveAttribute('aria-invalid', 'true');

	await input.fill('   ');
	await page.getByRole('button', { name: "Let's go" }).click();
	await expect(page.getByText('Enter a name.')).toBeVisible();
	await expect(page).toHaveURL('/');
});
```

Delete the smoke test:

```bash
rm tests/e2e/smoke.e2e.ts
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test:e2e tests/e2e/players.e2e.ts`
Expected: FAIL, no "Harf Sprint" heading.

- [ ] **Step 3: Create `src/lib/ui/NameForm.svelte`**

```svelte
<script lang="ts">
	import { untrack } from 'svelte';
	import { NAME_MAX, type NameError } from '$lib/storage/schema';
	import Button from './Button.svelte';

	type Props = {
		label: string;
		submitLabel: string;
		initial?: string;
		onsubmit: (name: string) => NameError | 'write-failed' | null;
		oncancel?: () => void;
	};

	let { label, submitLabel, initial = '', onsubmit, oncancel }: Props = $props();

	const MESSAGES: Record<NameError | 'write-failed', string> = {
		empty: 'Enter a name.',
		'too-long': `Use ${NAME_MAX} characters or fewer.`,
		taken: 'That name is already taken.',
		'write-failed': 'Could not save. Please try again.'
	};

	const id = $props.id();
	let name = $state(untrack(() => initial));
	let error = $state<NameError | 'write-failed' | null>(null);

	function submit(event: SubmitEvent) {
		event.preventDefault();
		error = onsubmit(name);
	}
</script>

<form
	onsubmit={submit}
	novalidate
	class="flex flex-col gap-3 rounded-card bg-white p-4 shadow-soft"
>
	<label for="{id}-name" class="font-bold">{label}</label>
	<input
		id="{id}-name"
		bind:value={name}
		oninput={() => (error = null)}
		autocomplete="off"
		autocapitalize="words"
		enterkeyhint="go"
		dir="auto"
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={error ? `${id}-error` : undefined}
		class="min-h-12 rounded-button border-2 border-ink/15 bg-white px-4 text-lg"
		{@attach (node) => node.focus()}
	/>
	{#if error}
		<p id="{id}-error" class="text-sm font-bold text-crimson">{MESSAGES[error]}</p>
	{/if}
	<div class="flex gap-3">
		{#if oncancel}
			<Button variant="secondary" onclick={oncancel}>Cancel</Button>
		{/if}
		<Button type="submit" class="flex-1">{submitLabel}</Button>
	</div>
</form>
```

- [ ] **Step 4: Replace `src/routes/+page.svelte`**

When there are no players yet, the form is shown directly without a Cancel button.

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getStore } from '$lib/storage/app-store';
	import { bestScore } from '$lib/storage/boards';
	import Avatar from '$lib/ui/Avatar.svelte';
	import NameForm from '$lib/ui/NameForm.svelte';
	import { buttonClass } from '$lib/ui/styles';

	const store = getStore();
	let adding = $state(false);
	const hasPlayers = $derived(store.data.players.length > 0);

	function choose(id: string) {
		if (store.selectPlayer(id)) goto(resolve('/modes'));
	}

	function create(name: string) {
		const result = store.addPlayer(name);
		if ('error' in result) return result.error;
		goto(resolve('/modes'));
		return null;
	}
</script>

<svelte:head><title>Harf Sprint</title></svelte:head>

<header class="mb-6 text-center">
	<p lang="ar" dir="rtl" class="font-arabic text-6xl leading-snug font-bold text-crimson">حَرْف</p>
	<h1 class="text-3xl font-bold">Harf Sprint</h1>
	<p class="mt-1 text-ink/70">Who is playing?</p>
</header>

<main class="flex flex-1 flex-col gap-4">
	{#if hasPlayers}
		<ul class="grid grid-cols-2 gap-3" aria-label="Players">
			{#each store.data.players as player (player.id)}
				{@const best = bestScore(store.data, player.id)}
				<li>
					<button
						type="button"
						onclick={() => choose(player.id)}
						class="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-card bg-white p-3 shadow-soft transition active:translate-y-px"
					>
						<Avatar name={player.name} seed={player.id} size="lg" />
						<span dir="auto" class="max-w-full truncate font-bold">{player.name}</span>
						<span class="text-xs text-ink/60"
							>{best === null ? 'No scores yet' : `Best ${best}`}</span
						>
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	{#if adding || !hasPlayers}
		<NameForm
			label="Your name"
			submitLabel="Let's go"
			onsubmit={create}
			oncancel={hasPlayers ? () => (adding = false) : undefined}
		/>
	{:else}
		<button
			type="button"
			class={buttonClass('secondary', { class: 'w-full' })}
			onclick={() => (adding = true)}
		>
			<span aria-hidden="true">+</span> New player
		</button>
	{/if}
</main>

<nav aria-label="More" class="mt-8 grid grid-cols-2 gap-3">
	<a href={resolve('/leaderboard')} class={buttonClass('ghost')}>Leaderboard</a>
	<a href={resolve('/settings')} class={buttonClass('ghost')}>Settings</a>
</nav>
```

- [ ] **Step 5: Run the e2e tests and the gates**

Run: `pnpm test:e2e && pnpm lint && pnpm check`
Expected: PASS. `/modes`, `/leaderboard` and `/settings` do not exist yet; the tests only assert the URL.

- [ ] **Step 6: Commit**

```bash
git add -A src tests
git commit -m "feat: add pick player screen with name validation"
```

---

### Task 11: Sprint setup screen

Spec 6 (`/modes`).
Words and Sentences tiles are shown disabled with "Coming soon" until Phase 2.

**Files:**

- Create: `src/routes/modes/+page.svelte`, `tests/e2e/modes.e2e.ts`

**Interfaces:**

- Consumes: `getStore`, `playerBest` (Task 8); `LEVELS`, `LEVEL_LABELS`, `LETTER_VARIANTS`, `VARIANT_LABELS`, `ITEM_LIMIT_MS`, `boardKey`, `Level`, `LetterVariant` (Task 5); `accuracy` (Task 5); `Avatar`, `Button`, `ModeTile`, `SegmentedControl`, `buttonClass` (Task 9); `createPlayer` (Task 10)
- Produces: navigation to `/play?mode=letters&level=<level>&variant=<variant>`

- [ ] **Step 1: Write the failing e2e tests**

Create `tests/e2e/modes.e2e.ts`:

```ts
import { expect, test } from '@playwright/test';
import { createPlayer } from './helpers';

test('redirects to the pick player screen without a current player', async ({ page }) => {
	await page.goto('/modes');
	await expect(page).toHaveURL('/');
});

test('sets up a letters sprint', async ({ page }) => {
	await createPlayer(page, 'Sara');
	await expect(page.getByRole('heading', { name: 'Pick a sprint' })).toBeVisible();
	await expect(page.getByText('Playing as')).toBeVisible();
	await expect(page.getByRole('button', { name: /Words/ })).toBeDisabled();
	await expect(page.getByRole('button', { name: /Sentences/ })).toBeDisabled();
	await expect(page.getByText('3 seconds per letter')).toBeVisible();

	await page.getByRole('button', { name: 'Fast' }).click();
	await expect(page.getByText('1.5 seconds per letter')).toBeVisible();
	await page.getByRole('button', { name: 'All forms' }).click();
	await expect(page.getByRole('button', { name: 'All forms' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	await page.getByRole('button', { name: 'Start' }).click();
	await expect(page).toHaveURL('/play?mode=letters&level=fast&variant=forms');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test:e2e tests/e2e/modes.e2e.ts`
Expected: FAIL, `/modes` has no "Pick a sprint" heading and does not redirect.

- [ ] **Step 3: Create `src/routes/modes/+page.svelte`**

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		ITEM_LIMIT_MS,
		LETTER_VARIANTS,
		LEVELS,
		LEVEL_LABELS,
		VARIANT_LABELS,
		boardKey,
		type LetterVariant,
		type Level
	} from '$lib/game/levels';
	import { accuracy } from '$lib/game/scoring';
	import { getStore } from '$lib/storage/app-store';
	import { playerBest } from '$lib/storage/boards';
	import Avatar from '$lib/ui/Avatar.svelte';
	import Button from '$lib/ui/Button.svelte';
	import ModeTile from '$lib/ui/ModeTile.svelte';
	import SegmentedControl from '$lib/ui/SegmentedControl.svelte';
	import { buttonClass } from '$lib/ui/styles';

	const store = getStore();
	const player = $derived(store.currentPlayer);

	let level = $state<Level>('normal');
	let variant = $state<LetterVariant>('isolated');

	const best = $derived(
		player
			? playerBest(store.data, boardKey({ mode: 'letters', level, variant }), player.id)
			: undefined
	);

	const levelOptions = LEVELS.map((value) => ({ value, label: LEVEL_LABELS[value] }));
	const variantOptions = LETTER_VARIANTS.map((value) => ({ value, label: VARIANT_LABELS[value] }));
	const VARIANT_HINTS: Record<LetterVariant, string> = {
		isolated: 'Each letter on its own',
		forms: 'Letters as they look at the start, middle or end of a word'
	};

	$effect(() => {
		if (!player) goto(resolve('/'), { replaceState: true });
	});

	function start() {
		const query = new URLSearchParams({ mode: 'letters', level, variant });
		// resolve() cannot add a query string, so the resolved path is extended here.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto(`${resolve('/play')}?${query}`);
	}
</script>

<svelte:head><title>Pick a sprint · Harf Sprint</title></svelte:head>

{#if player}
	<header class="mb-6 flex items-center gap-3">
		<Avatar name={player.name} seed={player.id} />
		<div class="min-w-0 flex-1">
			<p class="text-xs text-ink/60">Playing as</p>
			<p dir="auto" class="truncate font-bold">{player.name}</p>
		</div>
		<a href={resolve('/')} class={buttonClass('ghost', { size: 'sm', class: 'text-sm' })}
			>Switch player</a
		>
	</header>

	<main class="flex flex-1 flex-col gap-6">
		<h1 class="text-2xl font-bold">Pick a sprint</h1>

		<div class="grid grid-cols-3 gap-3">
			<ModeTile arabic="ب" title="Letters" selected />
			<ModeTile arabic="كَلِمَة" title="Words" subtitle="Coming soon" selected={false} disabled />
			<ModeTile
				arabic="جُمْلَة"
				title="Sentences"
				subtitle="Coming soon"
				selected={false}
				disabled
			/>
		</div>

		<section class="flex flex-col gap-2">
			<h2 class="font-bold">Speed</h2>
			<SegmentedControl label="Speed" options={levelOptions} bind:value={level} />
			<p class="text-sm text-ink/60">{ITEM_LIMIT_MS.letters[level] / 1000} seconds per letter</p>
		</section>

		<section class="flex flex-col gap-2">
			<h2 class="font-bold">Letter shapes</h2>
			<SegmentedControl label="Letter shapes" options={variantOptions} bind:value={variant} />
			<p class="text-sm text-ink/60">{VARIANT_HINTS[variant]}</p>
		</section>

		<dl class="grid grid-cols-3 gap-3 rounded-card bg-white p-4 text-center shadow-soft">
			<div>
				<dt class="text-xs text-ink/60">Best</dt>
				<dd class="text-2xl font-bold tabular-nums">{best ? best.run.score : '-'}</dd>
			</div>
			<div>
				<dt class="text-xs text-ink/60">Rank</dt>
				<dd class="text-2xl font-bold tabular-nums">{best ? `#${best.rank}` : '-'}</dd>
			</div>
			<div>
				<dt class="text-xs text-ink/60">Accuracy</dt>
				<dd class="text-2xl font-bold tabular-nums">
					{best ? `${Math.round(accuracy(best.run.correct, best.run.attempts) * 100)}%` : '-'}
				</dd>
			</div>
		</dl>

		<Button class="mt-auto w-full text-lg" onclick={start}>Start</Button>
	</main>
{/if}
```

- [ ] **Step 4: Run the e2e tests and the gates**

Run: `pnpm test:e2e && pnpm lint && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/modes tests/e2e/modes.e2e.ts
git commit -m "feat: add sprint setup screen"
```

---

### Task 12: Sprint screen (runner, feedback, pause)

Spec 5.1, 5.3, 7.4, 7.5 and 7.6.
The runner owns the `requestAnimationFrame` loop and the `visibilitychange` listener; the page renders `runner.state`.
Results and saving come in Task 13; this task ends with a minimal "Time's up!" view.
A correct answer replaces the answer buttons immediately, so the "correct" flash from spec 7.4 is shown as a brief green ring around the item card.

**Files:**

- Create: `src/lib/audio/sfx.ts`, `src/lib/game/sprint.svelte.ts`, `src/lib/ui/TimerBar.svelte`, `src/lib/ui/ItemCard.svelte`, `src/lib/ui/AnswerGrid.svelte`, `src/routes/play/+page.svelte`, `tests/e2e/sprint.e2e.ts`
- Modify: `tests/e2e/helpers.ts`

**Interfaces:**

- Consumes: `createSprint`, `reduce`, `outcomeBetween`, `itemLimit`, `SprintConfig`, `SprintState`, `SprintEvent`, `Outcome`, `Reveal` (Task 6); `parseBoardKey` (Task 5); `letterByChar`, `LETTERS` (Task 3); `getStore` (Task 8); `Button`, `Chip`, `buttonClass` (Task 9); `createPlayer` (Task 10)
- Produces:
  - `type Sfx = 'correct' | 'wrong' | 'timeup'`, `playSfx(kind: Sfx): void`
  - `createSprintRunner(config: SprintConfig, onOutcome: (outcome: Outcome, state: SprintState) => void)` returning `SprintRunner` with `state` getter, `start()`, `answer(choice: string)`, `resume()`, `stop()`
  - `<TimerBar fraction label>`, `<ItemCard text flash?>` (prompt has `data-testid="prompt"`), `<AnswerGrid choices reveal disabled onanswer>` (group named "Answers", keys 1-4)
  - Play page test ids: `sprint-score` ("Score N"), `sprint-time` ("Ns")
  - e2e helpers: `answerButtons(page)`, `answer(page, correct: boolean)`, `setHidden(page, hidden: boolean)`

- [ ] **Step 1: Extend the e2e helpers**

Append to `tests/e2e/helpers.ts`:

```ts
import { LETTERS } from '../../src/lib/content/letters';

export function answerButtons(page: Page) {
	return page.getByRole('group', { name: 'Answers' }).getByRole('button');
}

/** Answers the current letter with the keyboard, correctly or with a wrong choice. */
export async function answer(page: Page, correct: boolean) {
	const prompt = page.getByTestId('prompt');
	const shown = (await prompt.textContent()) ?? '';
	const letter = LETTERS.find((l) => l.char === shown.replace(/‍/g, ''));
	if (!letter) throw new Error(`Unknown prompt: ${shown}`);
	const labels = await answerButtons(page).allTextContents();
	const index = labels.findIndex((label) => label.includes(letter.arabicName) === correct);
	await page.keyboard.press(String(index + 1));
	if (correct) await expect(prompt).not.toHaveText(shown);
}

/** Simulates the tab being hidden or shown again. */
export async function setHidden(page: Page, hidden: boolean) {
	await page.evaluate((value) => {
		Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => (value ? 'hidden' : 'visible')
		});
		document.dispatchEvent(new Event('visibilitychange'));
	}, hidden);
}
```

Move the new `import` line to the top of the file next to the existing import.

- [ ] **Step 2: Write the failing e2e tests**

Create `tests/e2e/sprint.e2e.ts`.
`page.clock.install()` fakes `performance.now` and `requestAnimationFrame`; time still flows naturally, and `runFor` jumps ahead.

```ts
import { expect, test } from '@playwright/test';
import { answer, answerButtons, createPlayer, setHidden } from './helpers';

test.beforeEach(async ({ page }) => {
	await page.clock.install();
});

test('redirects without a player or with an invalid setup', async ({ page }) => {
	await page.goto('/play?mode=letters&level=normal&variant=isolated');
	await expect(page).toHaveURL('/');
	await createPlayer(page, 'Sara');
	await page.goto('/play?mode=letters&level=turbo&variant=isolated');
	await expect(page).toHaveURL('/modes');
});

test('counts down, scores correct answers, locks out wrong ones and ends', async ({ page }) => {
	await createPlayer(page, 'Sara');
	await page.getByRole('button', { name: 'Relaxed' }).click();
	await page.getByRole('button', { name: 'Start' }).click();

	await expect(page.getByText('3', { exact: true })).toBeVisible();
	await page.clock.runFor(3_000);
	await expect(answerButtons(page)).toHaveCount(4);
	await expect(page.getByTestId('sprint-time')).toHaveText('60s');

	await answer(page, true);
	await answer(page, true);
	await expect(page.getByTestId('sprint-score')).toHaveText('Score 2');

	await answer(page, false);
	await expect(answerButtons(page).first()).toBeDisabled();
	await page.clock.runFor(1_500);
	await expect(answerButtons(page).first()).toBeEnabled();
	await expect(page.getByTestId('sprint-score')).toHaveText('Score 2');

	await page.clock.runFor(60_000);
	await expect(page.getByRole('heading', { name: "Time's up!" })).toBeVisible();
});

test('pauses while the page is hidden and resumes on Continue', async ({ page }) => {
	await createPlayer(page, 'Sara');
	await page.getByRole('button', { name: 'Start' }).click();
	await page.clock.runFor(3_000);
	await expect(answerButtons(page)).toHaveCount(4);

	await setHidden(page, true);
	const dialog = page.getByRole('dialog', { name: 'Paused' });
	await expect(dialog).toBeVisible();
	const time = page.getByTestId('sprint-time');
	const frozen = (await time.textContent()) ?? '';
	await page.clock.runFor(20_000);
	await expect(time).toHaveText(frozen);

	await setHidden(page, false);
	await dialog.getByRole('button', { name: 'Continue' }).click();
	await expect(dialog).toBeHidden();
	await page.clock.runFor(2_000);
	await expect(time).not.toHaveText(frozen);
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `pnpm test:e2e tests/e2e/sprint.e2e.ts`
Expected: FAIL, `/play` does not exist.

- [ ] **Step 4: Create `src/lib/audio/sfx.ts`**

```ts
export type Sfx = 'correct' | 'wrong' | 'timeup';

type Tone = { notes: number[]; wave: OscillatorType; step: number };

const TONES: Record<Sfx, Tone> = {
	correct: { notes: [660, 880], wave: 'sine', step: 0.07 },
	wrong: { notes: [220, 165], wave: 'triangle', step: 0.12 },
	timeup: { notes: [440, 330, 247], wave: 'sine', step: 0.1 }
};

let context: AudioContext | null = null;

/** Plays a short synthesized tone. Silently does nothing where Web Audio is unavailable. */
export function playSfx(kind: Sfx): void {
	if (typeof AudioContext === 'undefined') return;
	context ??= new AudioContext();
	const ctx = context;
	void ctx.resume();
	const { notes, wave, step } = TONES[kind];
	notes.forEach((frequency, index) => {
		const start = ctx.currentTime + index * step;
		const oscillator = ctx.createOscillator();
		const gain = ctx.createGain();
		oscillator.type = wave;
		oscillator.frequency.value = frequency;
		gain.gain.setValueAtTime(0.0001, start);
		gain.gain.exponentialRampToValueAtTime(0.2, start + 0.01);
		gain.gain.exponentialRampToValueAtTime(0.0001, start + step);
		oscillator.connect(gain).connect(ctx.destination);
		oscillator.start(start);
		oscillator.stop(start + step + 0.02);
	});
}
```

- [ ] **Step 5: Create `src/lib/game/sprint.svelte.ts`**

```ts
import {
	createSprint,
	outcomeBetween,
	reduce,
	type Outcome,
	type SprintConfig,
	type SprintEvent,
	type SprintState
} from './sprint';

/** Drives a sprint with requestAnimationFrame and pauses it when the page is hidden. */
export function createSprintRunner(
	config: SprintConfig,
	onOutcome: (outcome: Outcome, state: SprintState) => void
) {
	let state = $state.raw<SprintState>(createSprint(config, performance.now()));
	let frame = 0;

	function dispatch(event: SprintEvent) {
		const previous = state;
		state = reduce(previous, event);
		const outcome = outcomeBetween(previous, state);
		if (outcome) onOutcome(outcome, state);
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
		start() {
			state = createSprint(config, performance.now());
			document.addEventListener('visibilitychange', onVisibilityChange);
			frame = requestAnimationFrame(loop);
		},
		answer(choice: string) {
			dispatch({ type: 'answer', choice, now: performance.now() });
		},
		resume() {
			dispatch({ type: 'resume', now: performance.now() });
		},
		stop() {
			cancelAnimationFrame(frame);
			document.removeEventListener('visibilitychange', onVisibilityChange);
		}
	};
}

export type SprintRunner = ReturnType<typeof createSprintRunner>;
```

- [ ] **Step 6: Create the sprint components**

`src/lib/ui/TimerBar.svelte`:

```svelte
<script lang="ts">
	let { fraction, label }: { fraction: number; label: string } = $props();

	const percent = $derived(Math.max(0, Math.min(1, fraction)) * 100);
</script>

<div
	role="progressbar"
	aria-label={label}
	aria-valuemin={0}
	aria-valuemax={100}
	aria-valuenow={Math.round(percent)}
	class="h-3 overflow-hidden rounded-full bg-white/60"
>
	<div
		class="h-full rounded-full bg-linear-to-r from-purple to-purple-light"
		style:width="{percent}%"
	></div>
</div>
```

`src/lib/ui/ItemCard.svelte`:

```svelte
<script lang="ts">
	let { text, flash = false }: { text: string; flash?: boolean } = $props();
</script>

<div
	class={[
		'grid min-h-56 place-items-center rounded-item bg-white p-6 shadow-item ring-4 transition-shadow duration-150',
		flash ? 'ring-success' : 'ring-transparent'
	]}
>
	{#key text}
		<p
			data-testid="prompt"
			lang="ar"
			dir="rtl"
			class="item-pop font-arabic leading-normal font-bold text-ink"
			style:font-size="clamp(6rem, 32vw, 9rem)"
		>
			{text}
		</p>
	{/key}
</div>
```

`src/lib/ui/AnswerGrid.svelte`:

```svelte
<script lang="ts">
	import { letterByChar } from '$lib/content/letters';
	import type { Reveal } from '$lib/game/sprint';

	type Props = {
		choices: readonly string[];
		reveal: Reveal | null;
		disabled: boolean;
		onanswer: (choice: string) => void;
	};

	let { choices, reveal, disabled, onanswer }: Props = $props();

	/** Keys 1-4 map to the buttons in reading order. */
	const KEYS = ['1', '2', '3', '4'];

	function onkeydown(event: KeyboardEvent) {
		if (disabled || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
		const choice = choices[KEYS.indexOf(event.key)];
		if (choice === undefined) return;
		event.preventDefault();
		onanswer(choice);
	}
</script>

<svelte:window {onkeydown} />

<div role="group" aria-label="Answers" class="grid grid-cols-2 gap-3">
	{#each choices as choice, index (choice)}
		{@const letter = letterByChar(choice)}
		{@const look =
			reveal?.correct === choice ? 'correct' : reveal?.chosen === choice ? 'wrong' : 'idle'}
		<button
			type="button"
			{disabled}
			aria-keyshortcuts={KEYS[index]}
			onclick={() => onanswer(choice)}
			class={[
				'flex min-h-16 flex-wrap items-center justify-center gap-x-2 rounded-button px-3 py-2 text-lg shadow-soft transition',
				look === 'idle' && 'bg-white text-ink',
				look === 'idle' && disabled && 'opacity-60',
				look === 'correct' && 'bg-success text-white',
				look === 'wrong' && 'shake bg-crimson text-white'
			]}
		>
			<span class="font-bold">{letter.name}</span>
			<span aria-hidden="true" class="opacity-60">·</span>
			<span lang="ar" dir="rtl" class="font-arabic text-xl font-bold">{letter.arabicName}</span>
		</button>
	{/each}
</div>
```

- [ ] **Step 7: Create `src/routes/play/+page.svelte`**

The runner is started once on mount; the setup is read from the URL at that moment (a new visit to `/play` always mounts a fresh page).
Task 13 replaces the `finished` branch with the results view and adds "Again".

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { playSfx } from '$lib/audio/sfx';
	import { letterByChar } from '$lib/content/letters';
	import { parseBoardKey } from '$lib/game/levels';
	import { itemLimit, type Outcome, type SprintState } from '$lib/game/sprint';
	import { createSprintRunner, type SprintRunner } from '$lib/game/sprint.svelte';
	import { getStore } from '$lib/storage/app-store';
	import AnswerGrid from '$lib/ui/AnswerGrid.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import ItemCard from '$lib/ui/ItemCard.svelte';
	import TimerBar from '$lib/ui/TimerBar.svelte';
	import { buttonClass } from '$lib/ui/styles';

	const store = getStore();
	const player = $derived(store.currentPlayer);
	const setup = $derived(
		parseBoardKey(
			['mode', 'level', 'variant'].map((key) => page.url.searchParams.get(key)).join(':')
		)
	);

	let runner = $state.raw<SprintRunner | null>(null);
	let announcement = $state('');
	let flash = $state(false);
	let flashTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		if (!player) goto(resolve('/'), { replaceState: true });
		else if (setup?.mode !== 'letters') goto(resolve('/modes'), { replaceState: true });
	});

	function startRound() {
		if (setup?.mode !== 'letters') return;
		runner?.stop();
		runner = createSprintRunner(
			{ mode: 'letters', level: setup.level, variant: setup.variant, rng: Math.random },
			handleOutcome
		);
		runner.start();
	}

	function handleOutcome(outcome: Outcome, state: SprintState) {
		if (store.data.settings.sound) {
			playSfx(outcome === 'correct' ? 'correct' : outcome === 'wrong' ? 'wrong' : 'timeup');
		}
		if (outcome === 'correct') {
			announcement = `Correct. ${state.score} points.`;
			flash = true;
			clearTimeout(flashTimer);
			flashTimer = setTimeout(() => (flash = false), 200);
		} else if (outcome === 'finished') {
			announcement = `Time is up. You scored ${state.score}.`;
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
		<main class="grid flex-1 place-items-center text-center">
			<div>
				<h1 class="text-3xl font-bold">Time's up!</h1>
				<p class="text-7xl font-bold text-crimson tabular-nums">{s.score}</p>
			</div>
		</main>
	{:else}
		<header class="mb-4 flex items-center gap-3">
			<a href={resolve('/modes')} class={buttonClass('ghost', { size: 'sm' })}>Quit</a>
			<span class="flex-1"></span>
			<Chip data-testid="sprint-score">Score {s.score}</Chip>
			<Chip tone="crimson" data-testid="sprint-time">{Math.ceil(s.sprintLeft / 1000)}s</Chip>
		</header>

		<main class="flex flex-1 flex-col gap-4">
			{#if s.phase === 'countdown' || s.resumeTo === 'countdown'}
				<div class="grid flex-1 place-items-center">
					<p class="text-9xl font-bold text-crimson tabular-nums">
						{Math.ceil(s.countdownLeft / 1000)}
					</p>
				</div>
			{:else}
				<TimerBar fraction={s.itemLeft / itemLimit(s.config)} label="Time left for this letter" />
				<ItemCard text={s.prompt.display} {flash} />
				<AnswerGrid
					choices={s.prompt.choices}
					reveal={s.reveal}
					disabled={s.phase !== 'active'}
					onanswer={(choice) => runner?.answer(choice)}
				/>
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

- [ ] **Step 8: Run the e2e tests and the gates**

Run: `pnpm test:e2e && pnpm lint && pnpm check && pnpm test:unit --run`
Expected: PASS.
Then run `pnpm dev`, open `/`, play one sprint by hand with sound on, and confirm the tones, the green ring on correct, the shake on wrong and the pause dialog when switching tabs.

- [ ] **Step 9: Commit**

```bash
git add -A src tests
git commit -m "feat: add letters sprint screen with feedback and pause"
```

---

### Task 13: Results view and saving runs

Spec 5.5 and 6 (results view).

**Files:**

- Create: `src/lib/ui/LeaderboardTable.svelte`, `src/lib/ui/ResultsView.svelte`, `tests/e2e/results.e2e.ts`
- Modify: `src/routes/play/+page.svelte` (full replacement below)

**Interfaces:**

- Consumes: `boardRows`, `BoardRow` (Task 8); `SaveResult`, `store.saveRun` (Task 8); `boardKey` (Task 5); `accuracy`, `attempts` (Task 5); `letterByChar` (Task 3); `SprintState` (Task 6); `Avatar`, `Button`, `Chip`, `buttonClass` (Task 9); runner and sprint components (Task 12); e2e helpers (Tasks 10, 12)
- Produces:
  - `<LeaderboardTable rows currentPlayerId limit?>`: an `<ol aria-label="Leaderboard">`; the current player's row has `aria-current="true"` and is appended below the top `limit` when ranked lower
  - `<ResultsView state save rows currentPlayerId onagain>` (score has `data-testid="result-score"`)

- [ ] **Step 1: Write the failing e2e test**

Create `tests/e2e/results.e2e.ts`:

```ts
import { expect, test } from '@playwright/test';
import { answer, answerButtons, createPlayer } from './helpers';

test.beforeEach(async ({ page }) => {
	await page.clock.install();
});

test('shows results, saves the run, restarts with Again and persists the best', async ({
	page
}) => {
	await createPlayer(page, 'Sara');
	await page.getByRole('button', { name: 'Relaxed' }).click();
	await page.getByRole('button', { name: 'Start' }).click();
	await page.clock.runFor(3_000);
	await expect(answerButtons(page)).toHaveCount(4);
	await answer(page, true);
	await answer(page, true);
	await answer(page, true);
	await answer(page, false);
	await page.clock.runFor(61_000);

	await expect(page.getByRole('heading', { name: "Time's up!" })).toBeVisible();
	await expect(page.getByTestId('result-score')).toHaveText('3');
	await expect(page.getByText('New personal best')).toBeVisible();
	const board = page.getByRole('list', { name: 'Leaderboard' });
	await expect(board.locator('li[aria-current="true"]')).toContainText('Sara');
	await expect(page.getByRole('heading', { name: 'Review what you missed' })).toBeVisible();

	await page.getByRole('button', { name: 'Again' }).click();
	await page.clock.runFor(3_000);
	await expect(answerButtons(page)).toHaveCount(4);
	await answer(page, false);
	await page.clock.runFor(61_000);
	await expect(page.getByTestId('result-score')).toHaveText('0');
	await expect(page.getByText('New personal best')).toBeHidden();

	await page.getByRole('link', { name: 'Home' }).click();
	await expect(page.getByRole('button', { name: /Sara/ })).toContainText('Best 3');
	await page.reload();
	await expect(page.getByRole('button', { name: /Sara/ })).toContainText('Best 3');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:e2e tests/e2e/results.e2e.ts`
Expected: FAIL, no `result-score`.

- [ ] **Step 3: Create `src/lib/ui/LeaderboardTable.svelte`**

```svelte
<script lang="ts">
	import { accuracy } from '$lib/game/scoring';
	import type { BoardRow } from '$lib/storage/boards';
	import Avatar from './Avatar.svelte';

	type Props = { rows: BoardRow[]; currentPlayerId: string | null; limit?: number };

	let { rows, currentPlayerId, limit = 10 }: Props = $props();

	const top = $derived(rows.slice(0, limit));
	const mine = $derived(rows.find((row) => row.player.id === currentPlayerId && row.rank > limit));
</script>

{#snippet item(row: BoardRow)}
	{@const current = row.player.id === currentPlayerId}
	<li
		aria-current={current ? 'true' : undefined}
		class={[
			'flex min-h-14 items-center gap-3 rounded-card px-4 py-2',
			current
				? 'bg-linear-to-br from-purple-light to-purple text-white shadow-purple'
				: 'bg-white shadow-soft'
		]}
	>
		<span class="w-6 text-right font-bold tabular-nums">{row.rank}</span>
		<Avatar name={row.player.name} seed={row.player.id} size="sm" />
		<span dir="auto" class="min-w-0 flex-1 truncate font-bold">{row.player.name}</span>
		<span class={['text-sm tabular-nums', current ? 'text-white/80' : 'text-ink/60']}>
			{Math.round(accuracy(row.run.correct, row.run.attempts) * 100)}%
		</span>
		<span class="w-10 text-right text-xl font-bold tabular-nums">{row.run.score}</span>
	</li>
{/snippet}

{#if rows.length === 0}
	<p class="rounded-card bg-white/70 p-5 text-center text-ink/70">No scores yet. Be the first!</p>
{:else}
	<ol aria-label="Leaderboard" class="flex flex-col gap-2">
		{#each top as row (row.player.id)}
			{@render item(row)}
		{/each}
		{#if mine}
			<li aria-hidden="true" class="text-center leading-none text-ink/50">...</li>
			{@render item(mine)}
		{/if}
	</ol>
{/if}
```

- [ ] **Step 4: Create `src/lib/ui/ResultsView.svelte`**

```svelte
<script lang="ts">
	import { resolve } from '$app/paths';
	import { letterByChar } from '$lib/content/letters';
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
	const missed = $derived(state.missed.map(letterByChar));
</script>

<main class="flex flex-1 flex-col gap-6">
	<section class="rounded-item bg-white p-6 text-center shadow-item">
		<h1 class="text-lg font-bold text-ink/70">Time's up!</h1>
		<p data-testid="result-score" class="text-7xl font-bold text-crimson tabular-nums">
			{state.score}
		</p>
		<p class="text-sm text-ink/60">{state.score === 1 ? 'point' : 'points'}</p>
		{#if save?.saved && save.personalBest}
			<div class="mt-3"><Chip tone="purple">New personal best</Chip></div>
		{:else if save && !save.saved}
			<p class="mt-3 text-sm font-bold text-crimson">This run could not be saved.</p>
		{/if}
		<dl class="mt-5 grid grid-cols-2 gap-3">
			<div class="rounded-card bg-ink/5 p-3">
				<dt class="text-xs text-ink/60">Accuracy</dt>
				<dd class="text-2xl font-bold tabular-nums">{percent}%</dd>
			</div>
			<div class="rounded-card bg-ink/5 p-3">
				<dt class="text-xs text-ink/60">Best streak</dt>
				<dd class="text-2xl font-bold tabular-nums">{state.counters.bestStreak}</dd>
			</div>
		</dl>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="font-bold">Top 3</h2>
		<LeaderboardTable {rows} {currentPlayerId} limit={3} />
	</section>

	{#if missed.length > 0}
		<section class="flex flex-col gap-2">
			<h2 class="font-bold">Review what you missed</h2>
			<ul class="grid grid-cols-2 gap-2">
				{#each missed as letter (letter.char)}
					<li class="flex items-center gap-3 rounded-card bg-white px-4 py-2 shadow-soft">
						<span lang="ar" dir="rtl" class="font-arabic text-3xl leading-normal font-bold"
							>{letter.char}</span
						>
						<span class="flex min-w-0 flex-col leading-tight">
							<span class="font-bold">{letter.name}</span>
							<span lang="ar" dir="rtl" class="font-arabic text-ink/70">{letter.arabicName}</span>
						</span>
					</li>
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

- [ ] **Step 5: Replace `src/routes/play/+page.svelte`**

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
	import { itemLimit, type Outcome, type SprintState } from '$lib/game/sprint';
	import { createSprintRunner, type SprintRunner } from '$lib/game/sprint.svelte';
	import { getStore } from '$lib/storage/app-store';
	import { boardRows } from '$lib/storage/boards';
	import type { SaveResult } from '$lib/storage/store.svelte';
	import AnswerGrid from '$lib/ui/AnswerGrid.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import ItemCard from '$lib/ui/ItemCard.svelte';
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

	let runner = $state.raw<SprintRunner | null>(null);
	let save = $state.raw<SaveResult | null>(null);
	let announcement = $state('');
	let flash = $state(false);
	let flashTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		if (!player) goto(resolve('/'), { replaceState: true });
		else if (setup?.mode !== 'letters') goto(resolve('/modes'), { replaceState: true });
	});

	function startRound() {
		if (setup?.mode !== 'letters') return;
		runner?.stop();
		save = null;
		announcement = '';
		runner = createSprintRunner(
			{ mode: 'letters', level: setup.level, variant: setup.variant, rng: Math.random },
			handleOutcome
		);
		runner.start();
	}

	function handleOutcome(outcome: Outcome, state: SprintState) {
		if (store.data.settings.sound) {
			playSfx(outcome === 'correct' ? 'correct' : outcome === 'wrong' ? 'wrong' : 'timeup');
		}
		if (outcome === 'correct') {
			announcement = `Correct. ${state.score} points.`;
			flash = true;
			clearTimeout(flashTimer);
			flashTimer = setTimeout(() => (flash = false), 200);
		} else if (outcome === 'finished') {
			save = store.saveRun({
				board: boardKey(state.config),
				score: state.score,
				correct: state.counters.correct,
				attempts: attempts(state.counters),
				bestStreak: state.counters.bestStreak,
				missed: [...state.missed]
			});
			announcement = `Time is up. You scored ${state.score}.`;
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
		<header class="mb-4 flex items-center gap-3">
			<a href={resolve('/modes')} class={buttonClass('ghost', { size: 'sm' })}>Quit</a>
			<span class="flex-1"></span>
			<Chip data-testid="sprint-score">Score {s.score}</Chip>
			<Chip tone="crimson" data-testid="sprint-time">{Math.ceil(s.sprintLeft / 1000)}s</Chip>
		</header>

		<main class="flex flex-1 flex-col gap-4">
			{#if s.phase === 'countdown' || s.resumeTo === 'countdown'}
				<div class="grid flex-1 place-items-center">
					<p class="text-9xl font-bold text-crimson tabular-nums">
						{Math.ceil(s.countdownLeft / 1000)}
					</p>
				</div>
			{:else}
				<TimerBar fraction={s.itemLeft / itemLimit(s.config)} label="Time left for this letter" />
				<ItemCard text={s.prompt.display} {flash} />
				<AnswerGrid
					choices={s.prompt.choices}
					reveal={s.reveal}
					disabled={s.phase !== 'active'}
					onanswer={(choice) => runner?.answer(choice)}
				/>
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

- [ ] **Step 6: Run the e2e tests and the gates**

Run: `pnpm test:e2e && pnpm lint && pnpm check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A src tests
git commit -m "feat: add results view and save runs to leaderboards"
```

---

### Task 14: Leaderboard screen

Spec 6 (`/leaderboard`) and 8.9.

**Files:**

- Create: `src/routes/leaderboard/+page.svelte`, `tests/e2e/leaderboard.e2e.ts`

**Interfaces:**

- Consumes: `boardRows` (Task 8); `MODES`, `MODE_LABELS`, `LEVELS`, `LEVEL_LABELS`, `LETTER_VARIANTS`, `VARIANT_LABELS`, `boardKey` (Task 5); `LeaderboardTable` (Task 13); `SegmentedControl`, `buttonClass` (Task 9)

- [ ] **Step 1: Write the failing e2e test**

Create `tests/e2e/leaderboard.e2e.ts`. It seeds localStorage directly so it does not need to play 12 sprints.

```ts
import { expect, test } from '@playwright/test';

function seedData() {
	const players = Array.from({ length: 12 }, (_, i) => ({
		id: `p${i}`,
		name: `Player ${i + 1}`,
		createdAt: '2026-09-14T09:00:00.000Z'
	}));
	const run = (playerId: string, score: number, board: string) => ({
		id: `${playerId}-${board}`,
		playerId,
		board,
		score,
		correct: score,
		attempts: score + 1,
		bestStreak: 3,
		missed: [],
		finishedAt: '2026-09-14T10:00:00.000Z'
	});
	return {
		version: 1,
		players,
		lastPlayerId: 'p11',
		runs: [],
		bests: {
			'letters:normal:isolated': Object.fromEntries(
				players.map((p, i) => [p.id, run(p.id, 40 - i, 'letters:normal:isolated')])
			),
			'letters:fast:forms': { p3: run('p3', 17, 'letters:fast:forms') }
		},
		settings: { sound: false }
	};
}

test('shows the top 10 per board with the current player highlighted', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(
		(data) => localStorage.setItem('harf-sprint:v1', JSON.stringify(data)),
		seedData()
	);
	await page.goto('/leaderboard');

	await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Words' })).toBeDisabled();

	const board = page.getByRole('list', { name: 'Leaderboard' });
	const rows = board.getByRole('listitem');
	await expect(rows).toHaveCount(11);
	await expect(rows.first()).toContainText('Player 1');
	await expect(rows.first()).toContainText('40');
	const mine = board.locator('li[aria-current="true"]');
	await expect(mine).toContainText('Player 12');
	await expect(mine).toContainText('29');

	await page.getByRole('button', { name: 'Fast' }).click();
	await expect(page.getByText('No scores yet. Be the first!')).toBeVisible();
	await page.getByRole('button', { name: 'All forms' }).click();
	await expect(rows).toHaveCount(1);
	await expect(rows.first()).toContainText('Player 4');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:e2e tests/e2e/leaderboard.e2e.ts`
Expected: FAIL, no "Leaderboard" heading.

- [ ] **Step 3: Create `src/routes/leaderboard/+page.svelte`**

```svelte
<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		LETTER_VARIANTS,
		LEVELS,
		LEVEL_LABELS,
		MODES,
		MODE_LABELS,
		VARIANT_LABELS,
		boardKey,
		type LetterVariant,
		type Level,
		type Mode
	} from '$lib/game/levels';
	import { getStore } from '$lib/storage/app-store';
	import { boardRows } from '$lib/storage/boards';
	import LeaderboardTable from '$lib/ui/LeaderboardTable.svelte';
	import SegmentedControl from '$lib/ui/SegmentedControl.svelte';
	import { buttonClass } from '$lib/ui/styles';

	const store = getStore();

	// Words and Sentences boards arrive in Phase 2.
	let mode = $state<Mode>('letters');
	let level = $state<Level>('normal');
	let variant = $state<LetterVariant>('isolated');

	const modeOptions = MODES.map((value) => ({
		value,
		label: MODE_LABELS[value],
		disabled: value !== 'letters'
	}));
	const levelOptions = LEVELS.map((value) => ({ value, label: LEVEL_LABELS[value] }));
	const variantOptions = LETTER_VARIANTS.map((value) => ({ value, label: VARIANT_LABELS[value] }));

	const rows = $derived(boardRows(store.data, boardKey({ mode: 'letters', level, variant })));
</script>

<svelte:head><title>Leaderboard · Harf Sprint</title></svelte:head>

<header class="mb-6 flex items-center gap-3">
	<a href={resolve('/')} class={buttonClass('ghost', { size: 'sm' })}>Back</a>
	<h1 class="text-2xl font-bold">Leaderboard</h1>
</header>

<main class="flex flex-1 flex-col gap-3">
	<SegmentedControl label="Mode" options={modeOptions} bind:value={mode} />
	<SegmentedControl label="Speed" options={levelOptions} bind:value={level} />
	<SegmentedControl label="Letter shapes" options={variantOptions} bind:value={variant} />
	<div class="mt-3">
		<LeaderboardTable {rows} currentPlayerId={store.data.lastPlayerId} />
	</div>
</main>
```

- [ ] **Step 4: Run the e2e tests and the gates**

Run: `pnpm test:e2e && pnpm lint && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/leaderboard tests/e2e/leaderboard.e2e.ts
git commit -m "feat: add leaderboard screen"
```

---

### Task 15: Settings screen

Spec 6 (`/settings`), 7.6 (sound toggle), 8.8 (rename, delete, reset) and 10 (player deleted in another tab).

**Files:**

- Create: `src/routes/settings/+page.svelte`, `tests/e2e/settings.e2e.ts`

**Interfaces:**

- Consumes: `store.setSound`, `store.renamePlayer`, `store.deletePlayer`, `store.resetAll` (Task 8); `Avatar`, `Button`, `ConfirmPanel`, `buttonClass` (Task 9); `NameForm` (Task 10); `createPlayer` (Task 10)

- [ ] **Step 1: Write the failing e2e tests**

Create `tests/e2e/settings.e2e.ts`:

```ts
import { expect, test } from '@playwright/test';
import { createPlayer } from './helpers';

test('toggles sound, renames and deletes players, and resets all data', async ({ page }) => {
	await createPlayer(page, 'Sara');
	await createPlayer(page, 'Yusuf');
	await page.goto('/settings');

	const sound = page.getByRole('switch', { name: 'Sound effects' });
	await expect(sound).toHaveAttribute('aria-checked', 'true');
	await sound.click();
	await page.reload();
	await expect(sound).toHaveAttribute('aria-checked', 'false');

	await page.getByRole('button', { name: 'Rename Sara' }).click();
	const input = page.getByLabel('Rename Sara');
	await input.fill('yusuf');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('That name is already taken.')).toBeVisible();
	await input.fill('Sara Ali');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('button', { name: 'Rename Sara Ali' })).toBeVisible();

	await page.getByRole('button', { name: 'Delete Yusuf' }).click();
	await page.getByRole('button', { name: 'Cancel' }).click();
	await page.getByRole('button', { name: 'Delete Yusuf' }).click();
	await page
		.getByRole('group', { name: 'Confirm' })
		.getByRole('button', { name: 'Delete' })
		.click();
	await expect(page.getByText('Yusuf')).toBeHidden();

	await page.getByRole('button', { name: 'Reset all data' }).click();
	await page.getByRole('button', { name: 'Reset', exact: true }).click();
	await expect(page).toHaveURL('/');
	await expect(page.getByLabel('Your name')).toBeVisible();
});

test('a player deleted in another tab is sent back to the pick player screen', async ({
	page,
	context
}) => {
	await createPlayer(page, 'Sara');
	const other = await context.newPage();
	await other.goto('/settings');
	await other.getByRole('button', { name: 'Delete Sara' }).click();
	await other
		.getByRole('group', { name: 'Confirm' })
		.getByRole('button', { name: 'Delete' })
		.click();
	await expect(page).toHaveURL('/');
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test:e2e tests/e2e/settings.e2e.ts`
Expected: FAIL, no "Sound effects" switch.

- [ ] **Step 3: Create `src/routes/settings/+page.svelte`**

```svelte
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getStore } from '$lib/storage/app-store';
	import Avatar from '$lib/ui/Avatar.svelte';
	import Button from '$lib/ui/Button.svelte';
	import ConfirmPanel from '$lib/ui/ConfirmPanel.svelte';
	import NameForm from '$lib/ui/NameForm.svelte';
	import { buttonClass } from '$lib/ui/styles';

	const store = getStore();
	const sound = $derived(store.data.settings.sound);

	let renamingId = $state<string | null>(null);
	let deletingId = $state<string | null>(null);
	let confirmingReset = $state(false);

	function rename(id: string, name: string) {
		const error = store.renamePlayer(id, name);
		if (!error) renamingId = null;
		return error;
	}

	function remove(id: string) {
		store.deletePlayer(id);
		deletingId = null;
	}

	function reset() {
		confirmingReset = false;
		if (store.resetAll()) goto(resolve('/'));
	}
</script>

<svelte:head><title>Settings · Harf Sprint</title></svelte:head>

<header class="mb-6 flex items-center gap-3">
	<a href={resolve('/')} class={buttonClass('ghost', { size: 'sm' })}>Back</a>
	<h1 class="text-2xl font-bold">Settings</h1>
</header>

<main class="flex flex-1 flex-col gap-8">
	<section class="flex flex-col gap-2">
		<h2 class="font-bold">Sound</h2>
		<button
			type="button"
			role="switch"
			aria-checked={sound}
			onclick={() => store.setSound(!sound)}
			class="flex min-h-14 items-center justify-between rounded-card bg-white px-4 shadow-soft"
		>
			<span class="font-bold">Sound effects</span>
			<span
				aria-hidden="true"
				class={[
					'relative h-8 w-14 rounded-full transition-colors',
					sound ? 'bg-crimson' : 'bg-ink/20'
				]}
			>
				<span
					class={[
						'absolute top-1 size-6 rounded-full bg-white shadow-soft transition-all',
						sound ? 'left-7' : 'left-1'
					]}
				></span>
			</span>
		</button>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="font-bold">Players</h2>
		{#if store.data.players.length === 0}
			<p class="text-ink/60">No players yet.</p>
		{/if}
		<ul class="flex flex-col gap-2">
			{#each store.data.players as player (player.id)}
				<li>
					{#if renamingId === player.id}
						<NameForm
							label="Rename {player.name}"
							submitLabel="Save"
							initial={player.name}
							onsubmit={(name) => rename(player.id, name)}
							oncancel={() => (renamingId = null)}
						/>
					{:else if deletingId === player.id}
						<ConfirmPanel
							message="Delete {player.name} and all their scores?"
							confirmLabel="Delete"
							onconfirm={() => remove(player.id)}
							oncancel={() => (deletingId = null)}
						/>
					{:else}
						<div class="flex items-center gap-2 rounded-card bg-white py-1 pr-1 pl-4 shadow-soft">
							<Avatar name={player.name} seed={player.id} size="sm" />
							<span dir="auto" class="min-w-0 flex-1 truncate font-bold">{player.name}</span>
							<Button
								variant="ghost"
								size="sm"
								aria-label="Rename {player.name}"
								onclick={() => {
									renamingId = player.id;
									deletingId = null;
								}}
							>
								Rename
							</Button>
							<Button
								variant="danger"
								size="sm"
								aria-label="Delete {player.name}"
								onclick={() => {
									deletingId = player.id;
									renamingId = null;
								}}
							>
								Delete
							</Button>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="font-bold">Data</h2>
		<p class="text-sm text-ink/60">Players and scores are saved only in this browser.</p>
		{#if confirmingReset}
			<ConfirmPanel
				message="Delete all players, scores and settings?"
				confirmLabel="Reset"
				onconfirm={reset}
				oncancel={() => (confirmingReset = false)}
			/>
		{:else}
			<Button variant="danger" class="self-start" onclick={() => (confirmingReset = true)}>
				Reset all data
			</Button>
		{/if}
	</section>
</main>
```

- [ ] **Step 4: Run the e2e tests and the gates**

Run: `pnpm test:e2e && pnpm lint && pnpm check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/settings tests/e2e/settings.e2e.ts
git commit -m "feat: add settings screen"
```

---

### Task 16: Screen review at phone and desktop sizes, and quality gates

Spec 7.5, 11.2 (screens at 390×844 and desktop, screenshots reviewed) and 11.4.
The test fails on horizontal scrolling and on tap targets under 48px; the screenshots are then reviewed by eye.

**Files:**

- Create: `tests/e2e/screens.e2e.ts`
- Modify: any UI file the review shows needs fixing

**Interfaces:**

- Consumes: e2e helpers (Tasks 10, 12); every screen from Tasks 9 to 15

- [ ] **Step 1: Write the screens test**

Create `tests/e2e/screens.e2e.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';
import { answer, answerButtons, createPlayer } from './helpers';

const VIEWPORTS = [
	{ name: 'phone', width: 390, height: 844 },
	{ name: 'desktop', width: 1280, height: 800 }
];

/** Fails on horizontal scrolling or small tap targets, then saves a full-page screenshot. */
async function capture(page: Page, viewport: string, screen: string) {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(overflow, `${screen} scrolls horizontally`).toBeLessThanOrEqual(0);

	const smallTargets = await page.evaluate(() =>
		[...document.querySelectorAll('button, a[href], input')]
			.filter((el) => {
				const box = el.getBoundingClientRect();
				return box.width > 0 && box.height < 48;
			})
			.map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName)
	);
	expect(smallTargets, `${screen} has tap targets under 48px`).toEqual([]);

	await page.screenshot({ path: `test-results/screens/${viewport}-${screen}.png`, fullPage: true });
}

for (const viewport of VIEWPORTS) {
	test.describe(viewport.name, () => {
		test.use({ viewport: { width: viewport.width, height: viewport.height } });

		test('every screen fits and is captured', async ({ page }) => {
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.clock.install();

			await page.goto('/');
			await expect(page.getByLabel('Your name')).toBeVisible();
			await capture(page, viewport.name, '1-first-visit');

			await createPlayer(page, 'Sara');
			await createPlayer(page, 'يوسف');
			await page.goto('/');
			await expect(page.getByRole('button', { name: /Sara/ })).toBeVisible();
			await capture(page, viewport.name, '2-pick-player');

			await page.getByRole('button', { name: /Sara/ }).click();
			await expect(page).toHaveURL('/modes');
			await capture(page, viewport.name, '3-modes');

			await page.getByRole('button', { name: 'Relaxed' }).click();
			await page.getByRole('button', { name: 'All forms' }).click();
			await page.getByRole('button', { name: 'Start' }).click();
			await expect(page.getByText('3', { exact: true })).toBeVisible();
			await capture(page, viewport.name, '4-countdown');

			await page.clock.runFor(3_000);
			await expect(answerButtons(page)).toHaveCount(4);
			await answer(page, true);
			await capture(page, viewport.name, '5-sprint');

			await answer(page, false);
			await capture(page, viewport.name, '6-wrong-answer');

			await page.clock.runFor(61_000);
			await expect(page.getByRole('heading', { name: "Time's up!" })).toBeVisible();
			await capture(page, viewport.name, '7-results');

			await page.goto('/leaderboard');
			await page.getByRole('button', { name: 'Relaxed' }).click();
			await page.getByRole('button', { name: 'All forms' }).click();
			await capture(page, viewport.name, '8-leaderboard');

			await page.goto('/settings');
			await expect(page.getByRole('switch', { name: 'Sound effects' })).toBeVisible();
			await capture(page, viewport.name, '9-settings');
		});
	});
}
```

- [ ] **Step 2: Run it**

Run: `pnpm exec playwright test tests/e2e/screens.e2e.ts`
Expected: PASS. If the overflow or tap target assertions fail, fix the named screen first.

- [ ] **Step 3: Review every screenshot**

Open each of the 18 files in `test-results/screens/` (use the Read tool to view them) and check:

- Arabic renders in Noto Naskh Arabic (not a system fallback), and the harakat on حَرْف are not clipped.
- In the forms variant, initial, medial and final forms render as joined shapes (for example ـبـ), not as isolated letters.
- The gradient fills the whole page height with no white band, including the long results page.
- Spacing, radii and shadows match the tokens in spec 7.1 and look consistent between screens.
- No unexpected truncation: "Sentences" and "Coming soon" fit their tiles at 390px; "Switch player" and names fit their rows.
- Answer buttons: the transliteration and Arabic name read clearly; in the wrong-answer screenshot the red and green buttons have readable text.
- The desktop layout is centered at 480px and does not look lost; nothing stretches edge to edge.

Also tab through `/modes` with the keyboard in `pnpm dev` and confirm the purple focus ring is visible on every control.

- [ ] **Step 4: Fix what looks off and repeat**

Fix each issue in the relevant component, re-run Step 2, and re-review the affected screenshots until nothing looks off.

- [ ] **Step 5: Run all quality gates and check for flakiness**

```bash
pnpm lint
pnpm check
pnpm test:unit --run
pnpm test:e2e
pnpm exec playwright test --repeat-each=3
```

Expected: everything passes with no warnings, and the repeated run has no failures. Fix any flaky test at its cause (usually a missing `expect` wait before an action), not with retries or timeouts.

- [ ] **Step 6: Commit**

```bash
git add -A src tests
git commit -m "test: add phone and desktop screen checks and polish UI"
```

---

### Task 17: First Vercel deployment

Spec 8.1 and Phase 1 step 8.
Deploying publishes the app on the internet, so it needs the user's explicit go-ahead.

**Files:** none (deployment only)

- [ ] **Step 1: Ask the user before deploying**

Ask the user to confirm they want to deploy now, and whether to use the Vercel CLI linked to their account or a GitHub import (the repository has no remote yet).
Stop here until they say yes.

- [ ] **Step 2: Log in and link (CLI path)**

Ask the user to run the interactive login themselves by typing:

```
! pnpm dlx vercel@latest login
```

Then link the project (accept the detected SvelteKit settings; name it `harf-sprint`):

```bash
pnpm dlx vercel@latest link
```

- [ ] **Step 3: Deploy**

```bash
pnpm dlx vercel@latest deploy --prod
```

Expected: the build runs `pnpm build`; `adapter-static` detects Vercel and writes the static output; the command prints the production URL.

- [ ] **Step 4: Verify the production site**

On the production URL, at a phone viewport and a desktop viewport (Playwright browser tools or a real phone):

- `/` loads with the title "Harf Sprint" and the favicon.
- Create a player, play a full letters sprint, see results and the leaderboard entry.
- Reload directly on `/modes`, `/leaderboard`, `/settings` and `/play?mode=letters&level=normal&variant=isolated`; each loads without a 404.
- Reload `/` and confirm the player and score persist.

- [ ] **Step 5: Report**

Give the user the production URL and the verification results.
Phase 2 (words and sentences with speech) gets its own plan.
