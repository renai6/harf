import { describe, expect, it } from 'vitest';
import { bestScore, boardRows, playerBest } from './boards';
import { emptyData, type Run, type StoredData } from './schema';

const run = (
	playerId: string,
	score: number,
	correct: number,
	attempts: number,
	at: string
): Run => ({
	id: `${playerId}-${score}`,
	playerId,
	board: 'letters:normal:isolated',
	score,
	correct,
	attempts,
	bestStreak: 1,
	missed: [],
	finishedAt: at
});

const data: StoredData = {
	...emptyData(),
	players: [
		{ id: 'a', name: 'Amal', createdAt: '' },
		{ id: 'b', name: 'Badr', createdAt: '' },
		{ id: 'c', name: 'Dina', createdAt: '' }
	],
	bests: {
		'letters:normal:isolated': {
			a: run('a', 10, 10, 12, '2026-01-02T00:00:00.000Z'),
			b: run('b', 10, 10, 10, '2026-01-03T00:00:00.000Z'),
			c: run('c', 14, 14, 20, '2026-01-01T00:00:00.000Z'),
			ghost: run('ghost', 50, 50, 50, '2026-01-01T00:00:00.000Z')
		},
		'letters:fast:forms': { a: { ...run('a', 21, 21, 25, ''), board: 'letters:fast:forms' } }
	}
};

describe('boards', () => {
	it('ranks existing players by the spec ranking order', () => {
		const rows = boardRows(data, 'letters:normal:isolated');
		expect(rows.map((r) => [r.rank, r.player.name])).toEqual([
			[1, 'Dina'],
			[2, 'Badr'],
			[3, 'Amal']
		]);
		expect(boardRows(data, 'letters:relaxed:isolated')).toEqual([]);
	});

	it('finds a player row and their best score across boards', () => {
		expect(playerBest(data, 'letters:normal:isolated', 'a')?.rank).toBe(3);
		expect(playerBest(data, 'letters:relaxed:isolated', 'a')).toBeUndefined();
		expect(bestScore(data, 'a')).toBe(21);
		expect(bestScore(data, 'nobody')).toBeNull();
	});
});
