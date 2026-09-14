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
