export type Counters = {
	correct: number;
	wrong: number;
	timeouts: number;
	skips: number;
	streak: number;
	bestStreak: number;
};

export const ZERO_COUNTERS: Counters = {
	correct: 0,
	wrong: 0,
	timeouts: 0,
	skips: 0,
	streak: 0,
	bestStreak: 0
};

export function attempts(c: Counters): number {
	return c.correct + c.wrong + c.timeouts + c.skips;
}

export function accuracy(correct: number, attempts: number): number {
	return attempts === 0 ? 0 : correct / attempts;
}

export function recordCorrect(c: Counters): Counters {
	const streak = c.streak + 1;
	return { ...c, correct: c.correct + 1, streak, bestStreak: Math.max(c.bestStreak, streak) };
}

export function recordMiss(c: Counters, kind: 'wrong' | 'timeouts' | 'skips'): Counters {
	return { ...c, [kind]: c[kind] + 1, streak: 0 };
}

export type RankFields = { score: number; correct: number; attempts: number; finishedAt: string };

/** Sort comparator: negative when `a` ranks above `b` (spec 5.5). */
export function compareRuns(a: RankFields, b: RankFields): number {
	if (a.score !== b.score) return b.score - a.score;
	const byAccuracy = accuracy(b.correct, b.attempts) - accuracy(a.correct, a.attempts);
	if (byAccuracy !== 0) return byAccuracy;
	return a.finishedAt < b.finishedAt ? -1 : a.finishedAt > b.finishedAt ? 1 : 0;
}
