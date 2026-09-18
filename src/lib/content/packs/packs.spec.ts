import { describe, expect, it } from 'vitest';
import { LETTER_CHARS } from '$lib/content/letters';
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
	it('are keyed by their own id', () => {
		for (const [key, pack] of Object.entries(PACKS)) {
			expect(pack.id).toBe(key);
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
			const [surah, ayah] = sentence.source!.split(':').map(Number);
			expect(surah, sentence.id).toBeGreaterThanOrEqual(1);
			expect(surah, sentence.id).toBeLessThanOrEqual(114);
			expect(ayah, sentence.id).toBeGreaterThanOrEqual(1);
		}
	});

	it('gives no MSA sentence a source', () => {
		for (const sentence of PACKS.msa.sentences) {
			expect(sentence.source, sentence.id).toBeUndefined();
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
