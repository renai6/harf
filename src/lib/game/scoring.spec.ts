import { describe, expect, it } from 'vitest';
import {
	ZERO_COUNTERS,
	accuracy,
	attempts,
	compareRuns,
	recordCorrect,
	recordMiss,
	type RankFields
} from './scoring';

describe('counters', () => {
	it('counts attempts as correct + wrong + timeouts + skips', () => {
		expect(attempts({ ...ZERO_COUNTERS, correct: 5, wrong: 2, timeouts: 1, skips: 3 })).toBe(11);
	});

	it('tracks streak and best streak', () => {
		let c = recordCorrect(recordCorrect(ZERO_COUNTERS));
		expect(c).toMatchObject({ correct: 2, streak: 2, bestStreak: 2 });
		c = recordMiss(c, 'wrong');
		expect(c).toMatchObject({ wrong: 1, streak: 0, bestStreak: 2 });
		c = recordMiss(recordCorrect(c), 'timeouts');
		expect(c).toMatchObject({ correct: 3, timeouts: 1, streak: 0, bestStreak: 2 });
	});

	it('reports 0 accuracy with no attempts', () => {
		expect(accuracy(0, 0)).toBe(0);
		expect(accuracy(3, 4)).toBe(0.75);
	});
});

describe('compareRuns', () => {
	const run = (score: number, correct: number, tries: number, finishedAt: string): RankFields => ({
		score,
		correct,
		attempts: tries,
		finishedAt
	});

	it('orders by score, then accuracy, then earlier finish', () => {
		const a = run(10, 10, 12, '2026-01-01T00:00:03.000Z');
		const b = run(12, 12, 20, '2026-01-01T00:00:01.000Z');
		const c = run(10, 10, 10, '2026-01-01T00:00:04.000Z');
		const d = run(10, 10, 10, '2026-01-01T00:00:02.000Z');
		expect([a, b, c, d].sort(compareRuns)).toEqual([b, d, c, a]);
	});
});
