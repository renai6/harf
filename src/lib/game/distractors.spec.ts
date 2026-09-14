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
