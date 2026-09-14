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
