import { describe, expect, it } from 'vitest';
import { PACKS } from '$lib/content/packs';
import { reviewItems } from './review';
import { mulberry32 } from './rng';

describe('reviewItems', () => {
	it('describes missed letters by transliterated and Arabic name', () => {
		const letters = {
			mode: 'letters',
			level: 'normal',
			variant: 'isolated',
			rng: mulberry32(1),
			practice: false
		} as const;
		expect(reviewItems(letters, ['ب'])).toEqual([
			{ id: 'ب', arabic: 'ب', label: 'baa', detail: 'باء' }
		]);
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
