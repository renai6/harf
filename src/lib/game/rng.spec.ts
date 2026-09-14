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
