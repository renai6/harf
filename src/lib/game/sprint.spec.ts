import { describe, expect, it } from 'vitest';
import { letterByChar } from '$lib/content/letters';
import { formsFor, renderForm } from './forms';
import { COUNTDOWN_MS } from './levels';
import { mulberry32 } from './rng';
import { attempts } from './scoring';
import {
	createSprint,
	outcomeBetween,
	reduce,
	type SprintConfig,
	type SprintState
} from './sprint';

const config = (overrides: Partial<SprintConfig> = {}): SprintConfig => ({
	mode: 'letters',
	level: 'normal',
	variant: 'isolated',
	rng: mulberry32(1),
	...overrides
});

const tick = (s: SprintState, now: number) => reduce(s, { type: 'tick', now });
const answer = (s: SprintState, choice: string, now: number) =>
	reduce(s, { type: 'answer', choice, now });
const wrongChoice = (s: SprintState) => s.prompt.choices.find((c) => c !== s.prompt.id)!;

/** A sprint that just left the countdown at now = 3000 (normal level: 3000 ms per letter). */
const activeSprint = (overrides: Partial<SprintConfig> = {}) =>
	tick(createSprint(config(overrides), 0), COUNTDOWN_MS);

describe('countdown', () => {
	it('starts with a 3 s countdown and a ready prompt', () => {
		const s = createSprint(config(), 0);
		expect(s.phase).toBe('countdown');
		expect(s.prompt.choices).toHaveLength(4);
		expect(s.prompt.choices).toContain(s.prompt.id);
		expect(tick(s, 2_999)).toMatchObject({ phase: 'countdown', countdownLeft: 1 });
		expect(tick(s, 3_000)).toMatchObject({ phase: 'active', sprintLeft: 60_000, itemLeft: 3_000 });
	});

	it('ignores answers during the countdown', () => {
		const s = createSprint(config(), 0);
		expect(answer(s, s.prompt.id, 1_000)).toMatchObject({ phase: 'countdown', score: 0 });
	});
});

describe('answering', () => {
	it('scores a correct answer and deals a different letter immediately', () => {
		const s = activeSprint();
		const next = answer(s, s.prompt.id, 3_500);
		expect(next).toMatchObject({ phase: 'active', score: 1, itemLeft: 3_000, sprintLeft: 59_500 });
		expect(next.counters).toMatchObject({ correct: 1, streak: 1, bestStreak: 1 });
		expect(next.prompt.id).not.toBe(s.prompt.id);
	});

	it('reveals a wrong answer, locks out for 1.5 s, then deals the next letter', () => {
		const s = activeSprint();
		const choice = wrongChoice(s);
		const locked = answer(s, choice, 3_500);
		expect(locked).toMatchObject({
			phase: 'lockout',
			score: 0,
			reveal: { chosen: choice, correct: s.prompt.id },
			missed: [s.prompt.id]
		});
		expect(locked.counters.wrong).toBe(1);

		const ignored = answer(locked, s.prompt.id, 4_000);
		expect(ignored).toMatchObject({ phase: 'lockout', score: 0 });

		const next = tick(ignored, 5_000);
		expect(next).toMatchObject({
			phase: 'active',
			reveal: null,
			itemLeft: 3_000,
			sprintLeft: 58_000
		});
		expect(next.prompt.id).not.toBe(s.prompt.id);
	});

	it('records a timeout when the per-item limit passes', () => {
		const s = activeSprint();
		const timedOut = tick(s, 6_000);
		expect(timedOut).toMatchObject({
			phase: 'lockout',
			reveal: { chosen: null, correct: s.prompt.id },
			missed: [s.prompt.id]
		});
		expect(timedOut.counters.timeouts).toBe(1);
	});

	it('handles several transitions in one tick', () => {
		const s = tick(activeSprint(), 8_500);
		expect(s).toMatchObject({ phase: 'active', itemLeft: 2_000 });
		expect(s.counters.timeouts).toBe(1);
	});

	it('tracks streaks across misses', () => {
		let s = activeSprint();
		s = answer(s, s.prompt.id, 3_100);
		s = answer(s, s.prompt.id, 3_200);
		s = answer(s, wrongChoice(s), 3_300);
		expect(s.counters).toMatchObject({ correct: 2, wrong: 1, streak: 0, bestStreak: 2 });
	});

	it('lists each missed letter once', () => {
		const s = activeSprint();
		const next = answer({ ...s, missed: [s.prompt.id] }, wrongChoice(s), 3_500);
		expect(next.missed).toEqual([s.prompt.id]);
	});
});

describe('sprint end', () => {
	it('does not count the item in progress when time runs out', () => {
		let s = activeSprint();
		s = answer(s, s.prompt.id, 4_000);
		s = tick(s, 63_000);
		expect(s.phase).toBe('finished');
		expect(s.score).toBe(1);
		expect(s.counters.timeouts).toBe(13);
		expect(attempts(s.counters)).toBe(14);
	});

	it('finishes cleanly when time runs out during a lockout', () => {
		const s = activeSprint({ level: 'fast' });
		const locked = tick(s, 62_000);
		expect(locked).toMatchObject({ phase: 'lockout' });
		expect(locked.counters.timeouts).toBe(20);
		expect(tick(locked, 63_000)).toMatchObject({ phase: 'finished', reveal: null, sprintLeft: 0 });
	});

	it('ignores events once finished', () => {
		const finished = tick(activeSprint(), 70_000);
		expect(finished.phase).toBe('finished');
		expect(answer(finished, finished.prompt.id, 70_100)).toBe(finished);
		expect(tick(finished, 80_000)).toBe(finished);
	});
});

describe('pause', () => {
	it('excludes paused time from the sprint and the item', () => {
		let s = reduce(activeSprint(), { type: 'pause', now: 4_000 });
		expect(s).toMatchObject({ phase: 'paused', resumeTo: 'active' });
		s = tick(s, 30_000);
		expect(s).toMatchObject({ phase: 'paused', sprintLeft: 59_000, itemLeft: 2_000 });
		expect(answer(s, s.prompt.id, 31_000).score).toBe(0);
		s = reduce(s, { type: 'resume', now: 50_000 });
		s = tick(s, 50_500);
		expect(s).toMatchObject({ phase: 'active', sprintLeft: 58_500, itemLeft: 1_500 });
	});

	it('resumes into the countdown or lockout it paused', () => {
		let c = reduce(createSprint(config(), 0), { type: 'pause', now: 1_000 });
		c = reduce(c, { type: 'resume', now: 9_000 });
		expect(c.phase).toBe('countdown');
		expect(tick(c, 11_000).phase).toBe('active');

		const s = activeSprint();
		let l = answer(s, wrongChoice(s), 3_500);
		l = reduce(l, { type: 'pause', now: 4_000 });
		l = reduce(l, { type: 'resume', now: 20_000 });
		expect(l).toMatchObject({ phase: 'lockout', lockoutLeft: 1_000 });
	});
});

describe('letter forms', () => {
	it('uses random valid forms in the forms variant and isolated otherwise', () => {
		const seen = new Set<string>();
		let s = activeSprint({ variant: 'forms', rng: mulberry32(9) });
		for (let i = 1; i <= 200; i++) {
			const letter = letterByChar(s.prompt.id);
			expect(formsFor(letter)).toContain(s.prompt.form);
			expect(s.prompt.display).toBe(renderForm(letter.char, s.prompt.form));
			seen.add(s.prompt.form);
			s = answer(s, s.prompt.id, COUNTDOWN_MS + i * 100);
		}
		expect(seen.size).toBe(4);

		let iso = activeSprint();
		for (let i = 1; i <= 50; i++) {
			expect(iso.prompt.form).toBe('isolated');
			iso = answer(iso, iso.prompt.id, COUNTDOWN_MS + i * 100);
		}
	});
});

describe('outcomeBetween', () => {
	it('reports what changed', () => {
		const s = activeSprint();
		expect(outcomeBetween(s, tick(s, 3_100))).toBeNull();
		expect(outcomeBetween(s, answer(s, s.prompt.id, 3_100))).toBe('correct');
		expect(outcomeBetween(s, answer(s, wrongChoice(s), 3_100))).toBe('wrong');
		expect(outcomeBetween(s, tick(s, 6_000))).toBe('timeout');
		expect(outcomeBetween(s, tick(s, 70_000))).toBe('finished');
	});
});
