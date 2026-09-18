import { describe, expect, it } from 'vitest';
import { PACKS } from '$lib/content/packs';
import { wordCount } from '$lib/speech/match';
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

type TextConfig = Extract<SprintConfig, { mode: 'words' | 'sentences' }>;

const textConfig = (overrides: Partial<TextConfig> = {}): TextConfig => ({
	mode: 'words',
	level: 'normal',
	variant: 'quran',
	rng: mulberry32(1),
	practice: false,
	...overrides
});

/** A text sprint that just left the countdown at now = 3000 (normal words: 6000 ms per item). */
const activeText = (overrides: Partial<TextConfig> = {}) =>
	reduce(createSprint(textConfig(overrides), 0), { type: 'tick', now: COUNTDOWN_MS });

const textOf = (s: SprintState) => {
	if (s.prompt.kind !== 'text') throw new Error('Expected a text prompt');
	return s.prompt;
};

describe('text sprint setup', () => {
	it('deals pack words for speech and ranks the run', () => {
		const s = createSprint(textConfig(), 0);
		expect(s).toMatchObject({ phase: 'countdown', input: 'speech', ranked: true, itemLeft: 6_000 });
		const prompt = textOf(s);
		expect(PACKS.quran.words.find((word) => word.id === prompt.id)?.text).toBe(prompt.display);
		expect(prompt).toMatchObject({ matchKind: 'word', points: 1 });
	});

	it('scores sentences by word count with the sentence time limit', () => {
		const s = createSprint(textConfig({ mode: 'sentences', variant: 'msa' }), 0);
		const prompt = textOf(s);
		const item = PACKS.msa.sentences.find((sentence) => sentence.id === prompt.id);
		expect(item).toBeDefined();
		expect(prompt).toMatchObject({ matchKind: 'sentence', points: wordCount(item!.text) });
		expect(s.itemLeft).toBe(12_000);
	});

	it('starts practice on self-report, unranked', () => {
		expect(createSprint(textConfig({ practice: true }), 0)).toMatchObject({
			input: 'selfReport',
			ranked: false
		});
	});

	it('keeps letters sprints on choices, ranked', () => {
		const s = createSprint(
			{ mode: 'letters', level: 'normal', variant: 'isolated', rng: mulberry32(1) },
			0
		);
		expect(s).toMatchObject({ input: 'choices', ranked: true });
	});
});

describe('speech answers', () => {
	it('ignores a match during the countdown', () => {
		const s = createSprint(textConfig(), 0);
		expect(reduce(s, { type: 'matched', now: 1_000 })).toMatchObject({
			phase: 'countdown',
			score: 0
		});
	});

	it('scores a match with the prompt points and deals the next item without a lockout', () => {
		const s = activeText({ mode: 'sentences' });
		const points = textOf(s).points;
		const next = reduce(s, { type: 'matched', now: 4_000 });
		expect(next).toMatchObject({
			phase: 'active',
			score: points,
			itemLeft: 12_000,
			sprintLeft: 59_000
		});
		expect(next.counters).toMatchObject({ correct: 1, streak: 1 });
		expect(next.prompt.id).not.toBe(s.prompt.id);
	});

	it('ignores letter answers and self-reports in a speech sprint', () => {
		const s = activeText();
		expect(reduce(s, { type: 'answer', choice: s.prompt.id, now: 3_100 }).score).toBe(0);
		expect(reduce(s, { type: 'selfReport', correct: true, now: 3_100 }).score).toBe(0);
	});

	it('skips to the next item as a miss without a lockout', () => {
		const s = activeText();
		const next = reduce(s, { type: 'skip', now: 3_500 });
		expect(next).toMatchObject({
			phase: 'active',
			score: 0,
			missed: [s.prompt.id],
			itemLeft: 6_000
		});
		expect(next.counters).toMatchObject({ skips: 1, streak: 0 });
		expect(next.prompt.id).not.toBe(s.prompt.id);
	});

	it('moves on after a timeout without a lockout', () => {
		const s = activeText();
		const next = reduce(s, { type: 'tick', now: 9_000 });
		expect(next).toMatchObject({
			phase: 'active',
			missed: [s.prompt.id],
			itemLeft: 6_000,
			sprintLeft: 54_000
		});
		expect(next.counters.timeouts).toBe(1);
	});

	it('does not count the item in progress when time runs out', () => {
		const s = reduce(activeText(), { type: 'tick', now: 63_000 });
		expect(s.phase).toBe('finished');
		expect(s.counters.timeouts).toBe(9);
		expect(attempts(s.counters)).toBe(9);
	});
});

describe('speech loss', () => {
	it('switches to self-report and unranked for the rest of the sprint', () => {
		const s = reduce(activeText(), { type: 'speechLost', now: 3_500 });
		expect(s).toMatchObject({ phase: 'active', input: 'selfReport', ranked: false });
		expect(reduce(s, { type: 'matched', now: 3_600 }).score).toBe(0);
		expect(reduce(s, { type: 'selfReport', correct: true, now: 3_600 }).score).toBe(1);
	});

	it('keeps a sprint ranked when speech stops as it ends', () => {
		expect(reduce(activeText(), { type: 'speechLost', now: 70_000 })).toMatchObject({
			phase: 'finished',
			input: 'speech',
			ranked: true
		});
	});

	it('changes nothing in practice or letters sprints', () => {
		const practice = activeText({ practice: true });
		expect(reduce(practice, { type: 'speechLost', now: 3_500 })).toMatchObject({
			input: 'selfReport',
			ranked: false
		});
		const letters = reduce(
			createSprint(
				{ mode: 'letters', level: 'normal', variant: 'isolated', rng: mulberry32(1) },
				0
			),
			{ type: 'speechLost', now: 1_000 }
		);
		expect(letters).toMatchObject({ input: 'choices', ranked: true });
	});
});

describe('practice self-report', () => {
	it('scores Got it and counts Missed as a miss without a lockout', () => {
		const s = activeText({ practice: true });
		const got = reduce(s, { type: 'selfReport', correct: true, now: 3_500 });
		expect(got).toMatchObject({ phase: 'active', score: 1 });
		const missed = reduce(got, { type: 'selfReport', correct: false, now: 3_600 });
		expect(missed).toMatchObject({ phase: 'active', score: 1, missed: [got.prompt.id] });
		expect(missed.counters).toMatchObject({ correct: 1, wrong: 1 });
		expect(attempts(missed.counters)).toBe(2);
		expect(reduce(s, { type: 'matched', now: 3_500 }).score).toBe(0);
	});
});

describe('text deck', () => {
	it('never shows the same item twice in a row', () => {
		let s = activeText({ rng: mulberry32(4) });
		let previous = s.prompt.id;
		for (let i = 1; i <= 40; i++) {
			s = reduce(s, { type: 'skip', now: COUNTDOWN_MS + i * 10 });
			expect(s.prompt.id).not.toBe(previous);
			previous = s.prompt.id;
		}
	});
});

describe('outcomeBetween for text sprints', () => {
	it('reports skips and matches', () => {
		const s = activeText();
		expect(outcomeBetween(s, reduce(s, { type: 'skip', now: 3_100 }))).toBe('skip');
		expect(outcomeBetween(s, reduce(s, { type: 'matched', now: 3_100 }))).toBe('correct');
	});
});
