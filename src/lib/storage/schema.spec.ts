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
		expect(parseData(null)).toEqual({ data: emptyData(), corrupt: false, newer: false });
		expect(isStoredData(emptyData())).toBe(true);
	});

	it('accepts valid data', () => {
		expect(parseData(JSON.stringify(valid))).toEqual({ data: valid, corrupt: false, newer: false });
	});

	it('accepts a remembered setup and rejects one that is not a board', () => {
		const withSetup = { ...valid, settings: { sound: true, lastSetup: 'words:fast:msa' } };
		expect(parseData(JSON.stringify(withSetup))).toEqual({
			data: withSetup,
			corrupt: false,
			newer: false
		});
		const bad = JSON.stringify({ ...valid, settings: { sound: true, lastSetup: 'words:fast' } });
		expect(parseData(bad).corrupt).toBe(true);
	});

	it('flags data from a newer version without calling it corrupt', () => {
		for (const version of [2, 7]) {
			expect(parseData(JSON.stringify({ ...valid, version }))).toEqual({
				data: emptyData(),
				corrupt: false,
				newer: true
			});
		}
		// A version this build does not know how to read, but not a later one, is still corrupt.
		expect(parseData(JSON.stringify({ ...valid, version: '2' })).corrupt).toBe(true);
	});

	it('flags unparseable or invalid data as corrupt', () => {
		const cases = [
			'{not json',
			'null',
			'[]',
			JSON.stringify({ ...valid, version: 0 }),
			JSON.stringify({ ...valid, players: [{ id: 'p1' }] }),
			JSON.stringify({ ...valid, lastPlayerId: 5 }),
			JSON.stringify({ ...valid, runs: [{ ...run, board: 'letters:turbo:isolated' }] }),
			JSON.stringify({ ...valid, runs: [{ ...run, score: -1 }] }),
			JSON.stringify({ ...valid, runs: [{ ...run, missed: [1] }] }),
			JSON.stringify({ ...valid, bests: { nope: { p1: run } } }),
			JSON.stringify({ ...valid, settings: {} })
		];
		for (const raw of cases) {
			expect(parseData(raw)).toEqual({ data: emptyData(), corrupt: true, newer: false });
		}
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

	it('removes invisible control and format characters', () => {
		expect(normalizeName('Sa​ra')).toBe('Sara');
		expect(normalizeName('‎Sara‏﻿')).toBe('Sara');
		expect(normalizeName('Umm\t­ Yusuf\n')).toBe('Umm Yusuf');
		expect(normalizeName('‍سارة‌')).toBe('سارة');
	});

	it('keeps Arabic marks and joiners between letters', () => {
		expect(normalizeName('مُحَمَّد')).toBe('مُحَمَّد');
		expect(normalizeName('نرگس‌آرا')).toBe('نرگس‌آرا');
	});

	it('treats names without a letter as empty and invisible differences as taken', () => {
		expect(validateName('​', players)).toBe('empty');
		expect(validateName('​⁠­', players)).toBe('empty');
		expect(validateName('123', players)).toBe('empty');
		expect(validateName('Sara​', players)).toBe('taken');
		const stored: Player[] = [{ id: 'p2', name: 'Yusuf​', createdAt: '' }];
		expect(validateName('yusuf', stored)).toBe('taken');
	});
});
