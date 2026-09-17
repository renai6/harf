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
