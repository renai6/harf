import { LETTER_CHARS, letterByChar } from '$lib/content/letters';
import { draw, newDeck, type Deck } from './deck';
import { buildChoices } from './distractors';
import { formsFor, renderForm, type Form } from './forms';
import {
	COUNTDOWN_MS,
	ITEM_LIMIT_MS,
	LOCKOUT_MS,
	SPRINT_MS,
	type Level,
	type LetterVariant
} from './levels';
import { pick, type Rng } from './rng';
import { ZERO_COUNTERS, recordCorrect, recordMiss, type Counters } from './scoring';

export type SprintConfig = { mode: 'letters'; level: Level; variant: LetterVariant; rng: Rng };

export type LetterPrompt = {
	/** The letter character; also the correct choice. */
	id: string;
	form: Form;
	/** Text to render, including zero-width joiners for positional forms. */
	display: string;
	choices: readonly string[];
};

export type SprintPhase = 'countdown' | 'active' | 'lockout' | 'paused' | 'finished';
type RunningPhase = 'countdown' | 'active' | 'lockout';

export type Reveal = { chosen: string | null; correct: string };

export type SprintState = {
	readonly config: SprintConfig;
	readonly phase: SprintPhase;
	readonly resumeTo: RunningPhase | null;
	readonly lastEventAt: number;
	readonly countdownLeft: number;
	readonly sprintLeft: number;
	readonly itemLeft: number;
	readonly lockoutLeft: number;
	readonly deck: Deck<string>;
	readonly prompt: LetterPrompt;
	readonly reveal: Reveal | null;
	readonly counters: Counters;
	readonly score: number;
	readonly missed: readonly string[];
};

export type SprintEvent =
	| { type: 'tick'; now: number }
	| { type: 'answer'; choice: string; now: number }
	| { type: 'pause'; now: number }
	| { type: 'resume'; now: number };

export type Outcome = 'correct' | 'wrong' | 'timeout' | 'finished';

export function itemLimit(config: SprintConfig): number {
	return ITEM_LIMIT_MS[config.mode][config.level];
}

function deal(
	deck: Deck<string>,
	config: SprintConfig
): { deck: Deck<string>; prompt: LetterPrompt } {
	const drawn = draw(deck, config.rng);
	const letter = letterByChar(drawn.item);
	const form = config.variant === 'forms' ? pick(formsFor(letter), config.rng) : 'isolated';
	return {
		deck: drawn.deck,
		prompt: {
			id: letter.char,
			form,
			display: renderForm(letter.char, form),
			choices: buildChoices(letter.char, LETTER_CHARS, config.rng)
		}
	};
}

export function createSprint(config: SprintConfig, now: number): SprintState {
	const { deck, prompt } = deal(newDeck(LETTER_CHARS, config.rng), config);
	return {
		config,
		phase: 'countdown',
		resumeTo: null,
		lastEventAt: now,
		countdownLeft: COUNTDOWN_MS,
		sprintLeft: SPRINT_MS,
		itemLeft: itemLimit(config),
		lockoutLeft: 0,
		deck,
		prompt,
		reveal: null,
		counters: ZERO_COUNTERS,
		score: 0,
		missed: []
	};
}

function nextItem(state: SprintState): SprintState {
	const { deck, prompt } = deal(state.deck, state.config);
	return {
		...state,
		phase: 'active',
		deck,
		prompt,
		reveal: null,
		itemLeft: itemLimit(state.config),
		lockoutLeft: 0
	};
}

function miss(state: SprintState, kind: 'wrong' | 'timeouts', chosen: string | null): SprintState {
	const id = state.prompt.id;
	return {
		...state,
		phase: 'lockout',
		lockoutLeft: LOCKOUT_MS,
		reveal: { chosen, correct: id },
		counters: recordMiss(state.counters, kind),
		missed: state.missed.includes(id) ? state.missed : [...state.missed, id]
	};
}

/** Moves the clocks forward to `now`, applying every transition that happens on the way. */
function advance(state: SprintState, now: number): SprintState {
	let dt = Math.max(0, now - state.lastEventAt);
	let s: SprintState = { ...state, lastEventAt: now };
	while (dt > 0) {
		if (s.phase === 'countdown') {
			const step = Math.min(dt, s.countdownLeft);
			dt -= step;
			s = { ...s, countdownLeft: s.countdownLeft - step };
			if (s.countdownLeft === 0) s = { ...s, phase: 'active' };
		} else if (s.phase === 'active') {
			const step = Math.min(dt, s.sprintLeft, s.itemLeft);
			dt -= step;
			s = { ...s, sprintLeft: s.sprintLeft - step, itemLeft: s.itemLeft - step };
			if (s.sprintLeft === 0) s = { ...s, phase: 'finished' };
			else if (s.itemLeft === 0) s = miss(s, 'timeouts', null);
		} else if (s.phase === 'lockout') {
			const step = Math.min(dt, s.sprintLeft, s.lockoutLeft);
			dt -= step;
			s = { ...s, sprintLeft: s.sprintLeft - step, lockoutLeft: s.lockoutLeft - step };
			if (s.sprintLeft === 0) s = { ...s, phase: 'finished', reveal: null };
			else if (s.lockoutLeft === 0) s = nextItem(s);
		} else {
			break;
		}
	}
	return s;
}

export function reduce(state: SprintState, event: SprintEvent): SprintState {
	if (state.phase === 'finished') return state;
	switch (event.type) {
		case 'tick':
			// Paused time never counts because resume resets lastEventAt, so the same object is kept and nothing re-renders.
			return state.phase === 'paused' ? state : advance(state, event.now);
		case 'answer': {
			const s = advance(state, event.now);
			if (s.phase !== 'active') return s;
			if (event.choice !== s.prompt.id) return miss(s, 'wrong', event.choice);
			return nextItem({ ...s, score: s.score + 1, counters: recordCorrect(s.counters) });
		}
		case 'pause': {
			const s = advance(state, event.now);
			if (s.phase === 'paused' || s.phase === 'finished') return s;
			return { ...s, phase: 'paused', resumeTo: s.phase };
		}
		case 'resume':
			if (state.phase !== 'paused' || state.resumeTo === null) return state;
			return { ...state, phase: state.resumeTo, resumeTo: null, lastEventAt: event.now };
	}
}

export function outcomeBetween(prev: SprintState, next: SprintState): Outcome | null {
	if (next.phase === 'finished' && prev.phase !== 'finished') return 'finished';
	if (next.counters.correct > prev.counters.correct) return 'correct';
	if (next.counters.wrong > prev.counters.wrong) return 'wrong';
	if (next.counters.timeouts > prev.counters.timeouts) return 'timeout';
	return null;
}
