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
