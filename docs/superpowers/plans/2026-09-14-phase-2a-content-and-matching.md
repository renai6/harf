# Harf Sprint Phase 2A (Content Packs and Arabic Matching) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Quranic and Modern Standard Arabic word and sentence packs, and the pure Arabic normalization and transcript matching that speech checking (Phase 2B) will use.

**Architecture:** Pure TypeScript modules with no DOM, timers or browser APIs, unit-tested in Vitest's node environment.
`src/lib/speech/normalize.ts` turns vowelled Arabic and recognizer transcripts into comparable tokens; `src/lib/speech/match.ts` decides whether a transcript reads an item.
`src/lib/content/packs/` holds the two packs as typed data, guarded by an automated content validation test (spec 9.3).
Phase 2A starts with a small starter set proven against Chrome recognition in the spike; Task 4 drafts the full packs, which need a fluent reader's review before Phase 2 is released.

**Tech Stack:** TypeScript (strict), Vitest 4 (node environment), pnpm.

**Spec:** `docs/superpowers/specs/2026-09-13-arabic-reading-sprint-design.md` (sections 8.7 matching, 9.2 packs, 9.3 content validation, 11.1 tests, 12 Phase 2).

**Follow-up plan:** Phase 2B (engine generalization, Web Speech listener, mic check, unranked practice, Words and Sentences screens) consumes the interfaces this plan produces.

## Global Constraints

- Package manager: pnpm only. Never run npm or yarn.
- Never use the em dash character in code, comments, copy or docs.
- Quality gates, all passing with no warnings: `pnpm lint`, `pnpm check`, `pnpm test:unit --run`.
- Word and sentence text is fully vowelled standard Unicode Arabic (no Uthmani-specific marks, U+06D6 to U+06ED), so the font and the matcher stay consistent. Harakat are always present.
- Sentences have 2 to 6 words. Quranic sentences carry a `source` reference (`surah:ayah`).
- Content is drafted by Claude and must be reviewed by the user or a fluent reader before Phase 2 is released.
- Write invisible or combining characters in regular expressions and tests as `\u` escapes, never as raw characters.
- Arabic string literals in code must be copied exactly from this plan (programmatically, not retyped), so every code point is preserved.
- Existing interfaces used here: `type PackVariant = 'quran' | 'msa'` from `src/lib/game/levels.ts`.
- Commit messages end with a blank line and `Claude-Session: https://claude.ai/code/session_01QWMbjMc8aiczKFP1fL5faM`. Never add a Co-Authored-By line.

## File Map

```
src/lib/speech/
  normalize.ts            normalizeArabic, tokens (Task 1)
  normalize.spec.ts
  match.ts                matchTranscript, wordCount (Task 2)
  match.spec.ts
src/lib/content/
  types.ts                + Word, Sentence, Pack (Task 3)
  packs/quran.ts          QURAN_PACK (Task 3 starter, Task 4 full)
  packs/msa.ts            MSA_PACK (Task 3 starter, Task 4 full)
  packs/index.ts          PACKS (Task 3)
  packs/packs.spec.ts     content validation (Task 3, sizes added in Task 4)
```

---

### Task 1: Arabic normalization

Spec 8.7 (normalize).

**Files:**

- Create: `src/lib/speech/normalize.ts`
- Test: `src/lib/speech/normalize.spec.ts`

**Interfaces:**

- Produces:
  - `normalizeArabic(text: string): string` - strips harakat (U+064B to U+065F), superscript alef (U+0670), Quranic annotation marks (U+06D6 to U+06ED), tatweel (U+0640) and format characters (`\p{Cf}`); unifies أ إ آ ٱ to ا, ة to ه, ى and ئ to ي, ؤ to و; removes standalone hamza ء; turns punctuation into spaces; lowercases Latin; collapses whitespace; trims.
  - `tokens(text: string): string[]` - `normalizeArabic` split on spaces; `[]` for empty input.

- [ ] **Step 1: Write the failing test**

Create `src/lib/speech/normalize.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeArabic, tokens } from './normalize';

describe('normalizeArabic', () => {
	it('strips harakat and shadda', () => {
		expect(normalizeArabic('اللَّه')).toBe('الله');
		expect(normalizeArabic('كِتَاب')).toBe('كتاب');
	});

	it('strips superscript alef', () => {
		expect(normalizeArabic('الرَّحْمَٰنِ')).toBe('الرحمن');
		expect(normalizeArabic('هَٰذَا')).toBe('هذا');
	});

	it('unifies alef forms', () => {
		expect(normalizeArabic('أَحَدٌ')).toBe('احد');
		expect(normalizeArabic('إِيَّاكَ')).toBe('اياك');
		expect(normalizeArabic('قُرْآن')).toBe('قران');
		expect(normalizeArabic('ٱلْحَمْدُ')).toBe('الحمد');
	});

	it('unifies ta marbuta, alef maqsura and hamza seats', () => {
		expect(normalizeArabic('صَلَاة')).toBe('صلاه');
		expect(normalizeArabic('مُوسَى')).toBe('موسي');
		expect(normalizeArabic('سَائِل')).toBe('سايل');
		expect(normalizeArabic('مُؤْمِن')).toBe('مومن');
	});

	it('removes standalone hamza', () => {
		expect(normalizeArabic('مَاء')).toBe('ما');
		expect(normalizeArabic('شَيْءٌ')).toBe('شي');
	});

	it('removes tatweel, Quranic marks and format characters', () => {
		expect(normalizeArabic('كتـــاب')).toBe('كتاب');
		expect(normalizeArabic('الْعَالَمِينَ \u06DD')).toBe('العالمين');
		expect(normalizeArabic('ب\u200Dت')).toBe('بت');
	});

	it('turns punctuation into spaces and collapses whitespace', () => {
		expect(normalizeArabic('  بسم  الله،الرحمن! ')).toBe('بسم الله الرحمن');
		expect(normalizeArabic('من؟ انا')).toBe('من انا');
	});

	it('lowercases Latin noise', () => {
		expect(normalizeArabic('Hello  WORLD')).toBe('hello world');
	});
});

describe('tokens', () => {
	it('splits normalized text into words', () => {
		expect(tokens('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ')).toEqual([
			'بسم',
			'الله',
			'الرحمن',
			'الرحيم'
		]);
	});

	it('returns no tokens for empty or blank input', () => {
		expect(tokens('')).toEqual([]);
		expect(tokens('  ،  ')).toEqual([]);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit --run src/lib/speech/normalize.spec.ts`
Expected: FAIL, cannot resolve `./normalize`.

- [ ] **Step 3: Implement `src/lib/speech/normalize.ts`**

```ts
/** Harakat U+064B-U+065F, superscript alef U+0670, Quranic annotation marks U+06D6-U+06ED, tatweel U+0640. */
const MARKS = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const FORMAT = /\p{Cf}/gu;
/** أ إ آ ٱ */
const ALEF_FORMS = /[\u0623\u0625\u0622\u0671]/g;
const TA_MARBUTA = /\u0629/g;
/** ى ئ */
const YA_FORMS = /[\u0649\u0626]/g;
const WAW_HAMZA = /\u0624/g;
const HAMZA = /\u0621/g;
const NOT_WORD = /[^\p{L}\p{N}\s]/gu;

/**
 * Makes vowelled text and recognizer transcripts comparable (spec 8.7).
 * Both sides of a comparison must go through this function.
 */
export function normalizeArabic(text: string): string {
	return text
		.replace(MARKS, '')
		.replace(FORMAT, '')
		.replace(ALEF_FORMS, '\u0627')
		.replace(TA_MARBUTA, '\u0647')
		.replace(YA_FORMS, '\u064A')
		.replace(WAW_HAMZA, '\u0648')
		.replace(HAMZA, '')
		.replace(NOT_WORD, ' ')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

export function tokens(text: string): string[] {
	const normalized = normalizeArabic(text);
	return normalized === '' ? [] : normalized.split(' ');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:unit --run src/lib/speech/normalize.spec.ts`
Expected: PASS.

- [ ] **Step 5: Lint, type-check and commit**

Run: `pnpm lint && pnpm check`
Expected: clean. Run `pnpm format` first if Prettier reports formatting.

```bash
git add src/lib/speech/normalize.ts src/lib/speech/normalize.spec.ts
git commit -m "feat: add Arabic text normalization for speech matching

Claude-Session: https://claude.ai/code/session_01QWMbjMc8aiczKFP1fL5faM"
```

---

### Task 2: Transcript matching

Spec 8.7 (matching) and 11.1 (fixtures).
The spike's saved transcripts were lost with an old session scratchpad, so the fixtures below are built from the recognizer behaviors the spike recorded: Chrome's plain spellings without harakat, ta marbuta written as ha, and a new answer appended to the previous item's still-open result.

**Files:**

- Create: `src/lib/speech/match.ts`
- Test: `src/lib/speech/match.spec.ts`

**Interfaces:**

- Consumes: `tokens(text: string): string[]` (Task 1)
- Produces:
  - `type MatchKind = 'word' | 'sentence'`
  - `SENTENCE_THRESHOLD = 0.8`
  - `type MatchResult = { matched: boolean; ratio: number }` (`ratio` is the share of expected words found, 0 to 1)
  - `matchTranscript(expected: string, transcript: string, kind: MatchKind): MatchResult` - compares only the last `expectedWordCount + 2` transcript tokens; each expected word consumes one matching transcript token; a word matches when all its tokens are found, a sentence when at least 80% are.
  - `wordCount(text: string): number` - number of normalized words (Phase 2B scores sentences at +1 per word)

- [ ] **Step 1: Write the failing test**

Create `src/lib/speech/match.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { matchTranscript, wordCount } from './match';

describe('matchTranscript: words', () => {
	it('matches a plain transcript of a vowelled word', () => {
		expect(matchTranscript('نُور', 'نور', 'word')).toEqual({ matched: true, ratio: 1 });
	});

	it('matches recognizer spellings of ta marbuta and alef madda', () => {
		expect(matchTranscript('صَلَاة', 'صلاه', 'word').matched).toBe(true);
		expect(matchTranscript('قُرْآن', 'قران', 'word').matched).toBe(true);
	});

	it('matches when the previous answer is still at the start of the result', () => {
		expect(matchTranscript('سَلَام', 'نور سلام', 'word').matched).toBe(true);
	});

	it('ignores tokens before the tail', () => {
		expect(matchTranscript('سَلَام', 'سلام نور كتاب بيت', 'word')).toEqual({
			matched: false,
			ratio: 0
		});
	});

	it('does not match a similar but different word', () => {
		expect(matchTranscript('قَلَم', 'علم', 'word').matched).toBe(false);
	});
});

describe('matchTranscript: sentences', () => {
	const basmala = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';

	it('matches a full plain transcript', () => {
		expect(matchTranscript(basmala, 'بسم الله الرحمن الرحيم', 'sentence')).toEqual({
			matched: true,
			ratio: 1
		});
	});

	it('does not match an unfinished interim transcript of a 4-word sentence', () => {
		expect(matchTranscript(basmala, 'بسم الله الرحمن', 'sentence')).toEqual({
			matched: false,
			ratio: 0.75
		});
	});

	it('matches at exactly 80% of a 5-word sentence and not below', () => {
		const sentence = 'أَنَا أُحِبُّ اللُّغَةَ الْعَرَبِيَّةَ كَثِيرًا';
		expect(matchTranscript(sentence, 'انا احب اللغه العربيه', 'sentence')).toEqual({
			matched: true,
			ratio: 0.8
		});
		expect(matchTranscript(sentence, 'انا احب اللغه', 'sentence').matched).toBe(false);
	});

	it('matches when the previous sentence is still at the start of the result', () => {
		expect(
			matchTranscript(
				'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
				'قل هو الله احد الحمد لله رب العالمين',
				'sentence'
			).matched
		).toBe(true);
	});

	it('counts a repeated expected word only as often as it was heard', () => {
		expect(matchTranscript('لَا لَا', 'لا', 'sentence')).toEqual({ matched: false, ratio: 0.5 });
	});
});

describe('matchTranscript: empty input', () => {
	it('never matches an empty expected text and scores an empty transcript as 0', () => {
		expect(matchTranscript('', 'نور', 'word')).toEqual({ matched: false, ratio: 0 });
		expect(matchTranscript('نُور', '', 'word')).toEqual({ matched: false, ratio: 0 });
	});
});

describe('wordCount', () => {
	it('counts normalized words', () => {
		expect(wordCount('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ')).toBe(4);
		expect(wordCount('نُور')).toBe(1);
		expect(wordCount('')).toBe(0);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit --run src/lib/speech/match.spec.ts`
Expected: FAIL, cannot resolve `./match`.

- [ ] **Step 3: Implement `src/lib/speech/match.ts`**

```ts
import { tokens } from './normalize';

export type MatchKind = 'word' | 'sentence';

export type MatchResult = { matched: boolean; ratio: number };

export const SENTENCE_THRESHOLD = 0.8;

/**
 * Extra transcript tokens compared beyond the expected length.
 * Chrome can append a new answer to the previous item's still-open result, so only the tail counts.
 */
const TAIL_SLACK = 2;

export function matchTranscript(
	expected: string,
	transcript: string,
	kind: MatchKind
): MatchResult {
	const want = tokens(expected);
	if (want.length === 0) return { matched: false, ratio: 0 };
	const pool = tokens(transcript).slice(-(want.length + TAIL_SLACK));
	let found = 0;
	for (const word of want) {
		const index = pool.indexOf(word);
		if (index === -1) continue;
		pool.splice(index, 1);
		found++;
	}
	const ratio = found / want.length;
	return { matched: kind === 'word' ? ratio === 1 : ratio >= SENTENCE_THRESHOLD, ratio };
}

export function wordCount(text: string): number {
	return tokens(text).length;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:unit --run src/lib/speech`
Expected: PASS (normalize and match).

- [ ] **Step 5: Lint, type-check and commit**

Run: `pnpm lint && pnpm check`
Expected: clean.

```bash
git add src/lib/speech/match.ts src/lib/speech/match.spec.ts
git commit -m "feat: add transcript matching for words and sentences

Claude-Session: https://claude.ai/code/session_01QWMbjMc8aiczKFP1fL5faM"
```

---

### Task 3: Pack types, starter packs and content validation

Spec 9.2 and 9.3.
The starter items are the words and sentences the speech spike tested against Chrome recognition (words 80 to 93% recognized, sentences 80 to 100%), split into their pack.

**Files:**

- Modify: `src/lib/content/types.ts`
- Create: `src/lib/content/packs/quran.ts`, `src/lib/content/packs/msa.ts`, `src/lib/content/packs/index.ts`
- Test: `src/lib/content/packs/packs.spec.ts`

**Interfaces:**

- Consumes: `type PackVariant` (`src/lib/game/levels.ts`); `matchTranscript`, `wordCount` (Task 2); `normalizeArabic` (Task 1)
- Produces:
  - `type Word = { id: string; text: string; translit: string; meaning: string }`
  - `type Sentence = { id: string; text: string; translit: string; meaning: string; source?: string }`
  - `type Pack = { id: PackVariant; name: string; words: readonly Word[]; sentences: readonly Sentence[] }`
  - `QURAN_PACK: Pack` (ids prefixed `q-`), `MSA_PACK: Pack` (ids prefixed `m-`)
  - `PACKS: Record<PackVariant, Pack>`
  - Item ids are stable: Phase 2B stores them in `Run.missed`, so never rename an existing id.

- [ ] **Step 1: Write the failing validation test**

Create `src/lib/content/packs/packs.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { matchTranscript, wordCount } from '$lib/speech/match';
import { normalizeArabic } from '$lib/speech/normalize';
import { PACKS } from './index';

/** Fathatan U+064B through sukun U+0652. */
const HARAKAH = /[\u064B-\u0652]/;
const ARABIC_LETTER = /[\u0621-\u064A\u0671]/;
/** Uthmani-specific Quranic marks, not allowed in pack text. */
const UTHMANI_MARKS = /[\u06D6-\u06ED]/;
const ID_PREFIX = { quran: 'q-', msa: 'm-' } as const;

const packs = Object.values(PACKS);

describe('packs', () => {
	it('are keyed by their own id and named', () => {
		for (const [key, pack] of Object.entries(PACKS)) {
			expect(pack.id).toBe(key);
			expect(pack.name.length).toBeGreaterThan(0);
		}
	});

	it('use ids that are unique across packs and prefixed by pack', () => {
		const ids = packs.flatMap((pack) => [...pack.words, ...pack.sentences].map((item) => item.id));
		expect(new Set(ids).size).toBe(ids.length);
		for (const pack of packs) {
			for (const item of [...pack.words, ...pack.sentences]) {
				expect(item.id.startsWith(ID_PREFIX[pack.id]), item.id).toBe(true);
			}
		}
	});

	it('give every Quranic sentence a surah:ayah source', () => {
		for (const sentence of PACKS.quran.sentences) {
			expect(sentence.source, sentence.id).toMatch(/^\d{1,3}:\d{1,3}$/);
		}
	});
});

for (const pack of packs) {
	const items = [
		...pack.words.map((item) => ({ ...item, kind: 'word' as const })),
		...pack.sentences.map((item) => ({ ...item, kind: 'sentence' as const }))
	];

	describe(`${pack.id} pack`, () => {
		it('has at least 2 words and 2 sentences, so a deck never repeats an item back to back', () => {
			expect(pack.words.length).toBeGreaterThanOrEqual(2);
			expect(pack.sentences.length).toBeGreaterThanOrEqual(2);
		});

		it('is fully vowelled standard Arabic', () => {
			for (const item of items) {
				expect(item.text, item.id).toMatch(ARABIC_LETTER);
				expect(item.text, item.id).toMatch(HARAKAH);
				expect(item.text, item.id).not.toMatch(UTHMANI_MARKS);
			}
		});

		it('has no two items that read the same after normalization', () => {
			const texts = items.map((item) => normalizeArabic(item.text));
			expect(new Set(texts).size).toBe(texts.length);
		});

		it('has single words and sentences of 2 to 6 words', () => {
			for (const word of pack.words) expect(wordCount(word.text), word.id).toBe(1);
			for (const sentence of pack.sentences) {
				expect(wordCount(sentence.text), sentence.id).toBeGreaterThanOrEqual(2);
				expect(wordCount(sentence.text), sentence.id).toBeLessThanOrEqual(6);
			}
		});

		it('has a transliteration and meaning for every item', () => {
			for (const item of items) {
				expect(item.translit.trim().length, item.id).toBeGreaterThan(0);
				expect(item.meaning.trim().length, item.id).toBeGreaterThan(0);
			}
		});

		it('matches every item against its own text', () => {
			for (const item of items) {
				expect(matchTranscript(item.text, item.text, item.kind).matched, item.id).toBe(true);
			}
		});
	});
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:unit --run src/lib/content/packs`
Expected: FAIL, cannot resolve `./index`.

- [ ] **Step 3: Add the pack types**

Replace `src/lib/content/types.ts` with:

```ts
import type { PackVariant } from '$lib/game/levels';

export type Letter = {
	/** The isolated letter, also used as the letter's id. */
	char: string;
	/** Transliterated name shown on answer buttons. Emphatic letters are capitalized (Haa, Saad). */
	name: string;
	arabicName: string;
	/** Whether the letter connects to the following letter. */
	joins: boolean;
};

/**
 * Transliteration convention for words and sentences: long vowels doubled (aa, ii, uu),
 * emphatic letters capitalized (H, S, D, T, Z), and an apostrophe for both hamza and 'ayn.
 */
export type Word = {
	/** Stable id, stored in saved runs. Prefixed by pack: `q-` or `m-`. */
	id: string;
	/** Fully vowelled Arabic. */
	text: string;
	translit: string;
	meaning: string;
};

export type Sentence = {
	/** Stable id, stored in saved runs. Prefixed by pack: `q-` or `m-`. */
	id: string;
	/** Fully vowelled Arabic, 2 to 6 words. */
	text: string;
	translit: string;
	meaning: string;
	/** `surah:ayah` for Quranic sentences. */
	source?: string;
};

export type Pack = {
	id: PackVariant;
	name: string;
	words: readonly Word[];
	sentences: readonly Sentence[];
};
```

- [ ] **Step 4: Add the starter packs**

Create `src/lib/content/packs/quran.ts`:

```ts
import type { Pack } from '../types';

export const QURAN_PACK: Pack = {
	id: 'quran',
	name: 'Quranic',
	words: [
		{ id: 'q-allah', text: 'اللَّه', translit: 'allaah', meaning: 'God (Allah)' },
		{ id: 'q-rabb', text: 'رَبّ', translit: 'rabb', meaning: 'Lord' },
		{ id: 'q-nur', text: 'نُور', translit: 'nuur', meaning: 'light' },
		{ id: 'q-salam', text: 'سَلَام', translit: 'salaam', meaning: 'peace' },
		{ id: 'q-salah', text: 'صَلَاة', translit: 'Salaah', meaning: 'prayer' },
		{ id: 'q-quran', text: 'قُرْآن', translit: "qur'aan", meaning: 'recitation, the Quran' },
		{ id: 'q-jannah', text: 'جَنَّة', translit: 'jannah', meaning: 'garden, paradise' },
		{ id: 'q-kitab', text: 'كِتَاب', translit: 'kitaab', meaning: 'book, scripture' }
	],
	sentences: [
		{
			id: 'q-basmala',
			text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
			translit: 'bismi llaahi r-raHmaani r-raHiim',
			meaning: 'In the name of God, the Most Gracious, the Most Merciful',
			source: '1:1'
		},
		{
			id: 'q-hamd',
			text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ',
			translit: "al-Hamdu lillaahi rabbi l-'aalamiin",
			meaning: 'All praise is for God, Lord of all the worlds',
			source: '1:2'
		},
		{
			id: 'q-ikhlas-1',
			text: 'قُلْ هُوَ اللَّهُ أَحَدٌ',
			translit: 'qul huwa llaahu aHad',
			meaning: 'Say: He is God, the One',
			source: '112:1'
		}
	]
};
```

Create `src/lib/content/packs/msa.ts`:

```ts
import type { Pack } from '../types';

export const MSA_PACK: Pack = {
	id: 'msa',
	name: 'Modern Standard',
	words: [
		{ id: 'm-bayt', text: 'بَيْت', translit: 'bayt', meaning: 'house' },
		{ id: 'm-maa', text: 'مَاء', translit: "maa'", meaning: 'water' },
		{ id: 'm-qalam', text: 'قَلَم', translit: 'qalam', meaning: 'pen' },
		{ id: 'm-shams', text: 'شَمْس', translit: 'shams', meaning: 'sun' },
		{ id: 'm-qamar', text: 'قَمَر', translit: 'qamar', meaning: 'moon' },
		{ id: 'm-walad', text: 'وَلَد', translit: 'walad', meaning: 'boy' },
		{ id: 'm-madrasah', text: 'مَدْرَسَة', translit: 'madrasah', meaning: 'school' }
	],
	sentences: [
		{
			id: 'm-bayt-kabir',
			text: 'هَٰذَا بَيْتٌ كَبِيرٌ',
			translit: 'haadhaa baytun kabiir',
			meaning: 'This is a big house'
		},
		{
			id: 'm-ashrabu-maa',
			text: 'أَنَا أَشْرَبُ الْمَاءَ',
			translit: "anaa ashrabu l-maa'",
			meaning: 'I drink the water'
		}
	]
};
```

Create `src/lib/content/packs/index.ts`:

```ts
import type { PackVariant } from '$lib/game/levels';
import type { Pack } from '../types';
import { MSA_PACK } from './msa';
import { QURAN_PACK } from './quran';

export const PACKS: Record<PackVariant, Pack> = { quran: QURAN_PACK, msa: MSA_PACK };
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm test:unit --run src/lib/content src/lib/speech`
Expected: PASS.
If an Arabic item fails the harakah or self-match check, compare its code points with this plan (for example with `node -e "console.log([...'<text>'].map(c => c.codePointAt(0).toString(16)))"`) before changing the test.

- [ ] **Step 6: Run all gates and commit**

Run: `pnpm test:unit --run && pnpm lint && pnpm check`
Expected: all pass, no warnings.

```bash
git add src/lib/content
git commit -m "feat: add starter Quranic and MSA packs with content validation

Claude-Session: https://claude.ai/code/session_01QWMbjMc8aiczKFP1fL5faM"
```

---

### Task 4: Draft the full content packs

Spec 9.2 ("About 80 words and 25 sentences per pack", "Content is drafted by Claude and must be reviewed by the user or a fluent reader before Phase 2 is released").
This task does not block Phase 2B: the engine and screens work with any pack that passes the Task 3 validation.
Run it on the most capable model; accuracy of Arabic spelling, harakat and Quranic text matters more than speed.

**Files:**

- Modify: `src/lib/content/packs/quran.ts`, `src/lib/content/packs/msa.ts`, `src/lib/content/packs/packs.spec.ts`

**Interfaces:**

- Consumes: `Pack`, `Word`, `Sentence` (Task 3); `LETTER_CHARS` (`src/lib/content/letters.ts`); `normalizeArabic` (Task 1)
- Produces: the same `QURAN_PACK` and `MSA_PACK` exports, with every starter item kept unchanged (same id, text, translit, meaning, source).

**Content rules (both packs):**

- Keep all starter items from Task 3 exactly as they are, and add new items after them.
- Every text is fully vowelled standard Unicode Arabic, including case endings in sentences where natural; no Uthmani-specific marks (U+06D6 to U+06ED); superscript alef (U+0670) only where standard vowelled script uses it (as in الرَّحْمَٰنِ and هَٰذَا).
- Words are single words (one token after normalization). Prefer common, concrete words children can picture, of 1 to 3 syllables, and avoid words with violent or frightening meanings.
- Across each pack's words, cover at least 24 of the 28 base letters, so reading practice spreads across the alphabet.
- No two items in a pack may read the same after normalization (for example, do not add both مَاء and مَا).
- Ids: lowercase ASCII slugs of the transliteration, prefixed `q-` or `m-`, unique across both packs (for example `q-samaa`, `m-kalb`, `q-kawthar-1`).
- Transliteration follows the convention documented on `Word` in `src/lib/content/types.ts`. Meanings are short plain English.

**Quranic pack rules:**

- Words: about 80 words that occur in the Quran, written in standard vowelled spelling (a dictionary form such as سَمَاء is fine).
- Sentences: about 25, each a complete ayah of 2 to 6 words from the Hafs 'an 'Asim reading, with `source` set to `surah:ayah`. Prefer Al-Fatiha and short surahs of Juz 'Amma (for example 1:5, 1:6, 108:1, 112:2, 112:3, 112:4, 114:1). Never shorten, merge or paraphrase an ayah; if an ayah has more than 6 words, do not use it.
- Only include an ayah whose exact wording you are certain of.

**Modern Standard Arabic pack rules:**

- Words: about 80 everyday words across home, family, food, school, nature, animals, colors, numbers, body and time.
- Sentences: about 25 simple sentences of 2 to 6 words that a beginner can read, no `source`.

- [ ] **Step 1: Add the size and coverage checks**

In `src/lib/content/packs/packs.spec.ts`, add `import { LETTER_CHARS } from '$lib/content/letters';` to the imports, and add these two tests inside the `describe(\`${pack.id} pack\`, ...)` block:

```ts
it('has about 80 words and 25 sentences', () => {
	expect(pack.words.length).toBeGreaterThanOrEqual(70);
	expect(pack.words.length).toBeLessThanOrEqual(90);
	expect(pack.sentences.length).toBeGreaterThanOrEqual(20);
	expect(pack.sentences.length).toBeLessThanOrEqual(30);
});

it('covers at least 24 of the 28 letters across its words', () => {
	const used = new Set([...pack.words.map((word) => normalizeArabic(word.text)).join('')]);
	const covered = LETTER_CHARS.filter((char) => used.has(char));
	expect(covered.length).toBeGreaterThanOrEqual(24);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test:unit --run src/lib/content/packs`
Expected: FAIL on the size test for both packs (the starter packs are small).

- [ ] **Step 3: Draft the Quranic pack**

Add the words and sentences to `src/lib/content/packs/quran.ts` following the rules above.
Run `pnpm test:unit --run src/lib/content/packs` after every 20 items or so, and fix any item the validation rejects.

- [ ] **Step 4: Draft the Modern Standard Arabic pack**

Add the words and sentences to `src/lib/content/packs/msa.ts` the same way.

- [ ] **Step 5: Self-check the content**

Read both packs once more, item by item, and check spelling, harakat, meanings and transliterations.
For every Quranic sentence, re-check the wording and the `surah:ayah` reference.
In the task report, list every item you are less than fully sure of, so the fluent reviewer can check those first.

- [ ] **Step 6: Run all gates and commit**

Run: `pnpm test:unit --run && pnpm lint && pnpm check`
Expected: all pass, no warnings.

```bash
git add src/lib/content/packs
git commit -m "feat: draft full Quranic and MSA content packs

Claude-Session: https://claude.ai/code/session_01QWMbjMc8aiczKFP1fL5faM"
```

- [ ] **Step 7: Hand the content to the user for review**

After the task review, present both packs to the user (Arabic, transliteration, meaning, and source for Quranic sentences), with the drafter's uncertain items first.
Record the review outcome; Phase 2 is not released until the user or a fluent reader has approved the content (spec 9.2).
