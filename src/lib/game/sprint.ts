import { LETTER_CHARS } from '$lib/content/letters';
import { draw, newDeck, type Deck } from './deck';
import {
	COUNTDOWN_MS,
	ITEM_LIMIT_MS,
	LOCKOUT_MS,
	SPRINT_MS,
	type Level,
	type LetterVariant,
	type PackVariant
} from './levels';
import { letterPrompt, textItems, textPrompt, type Prompt, type TextMode } from './prompts';
import type { Rng } from './rng';
import { ZERO_COUNTERS, recordCorrect, recordMiss, type Counters } from './scoring';

export type { LetterPrompt, Prompt, TextPrompt } from './prompts';

/** Unranked practice replaces speech with buttons: letter choices, or Got it and Missed (spec 5.6). */
export type SprintConfig =
	| { mode: 'letters'; level: Level; variant: LetterVariant; rng: Rng; practice: boolean }
	| { mode: TextMode; level: Level; variant: PackVariant; rng: Rng; practice: boolean };

/** How the player answers: letter choices, speech, or the Got it and Missed buttons. */
export type SprintInput = 'choices' | 'speech' | 'selfReport';

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
	readonly input: SprintInput;
	/** False for practice and after speech stops mid-sprint; unranked runs are never saved. */
	readonly ranked: boolean;
	readonly deck: Deck<string>;
	readonly prompt: Prompt;
	readonly reveal: Reveal | null;
	readonly counters: Counters;
	readonly score: number;
	readonly missed: readonly string[];
};

export type SprintEvent =
	| { type: 'tick'; now: number }
	| { type: 'answer'; choice: string; now: number }
	| { type: 'matched'; now: number }
	| { type: 'skip'; now: number }
	| { type: 'selfReport'; correct: boolean; now: number }
	| { type: 'speechLost'; now: number }
	| { type: 'pause'; now: number }
	| { type: 'resume'; now: number };

export type Outcome = 'correct' | 'wrong' | 'timeout' | 'skip' | 'finished';

export function itemLimit(config: SprintConfig): number {
	return ITEM_LIMIT_MS[config.mode][config.level];
}

/**
 * What stands in for the microphone. A letter can still be checked honestly without speech, because
 * its four choices are always dealt with it; a word or sentence can only be self-reported.
 */
function fallbackInput(config: SprintConfig): SprintInput {
	return config.mode === 'letters' ? 'choices' : 'selfReport';
}

function deckItems(config: SprintConfig): readonly string[] {
	return config.mode === 'letters'
		? LETTER_CHARS
		: textItems(config.mode, config.variant).map((item) => item.id);
}

function deal(deck: Deck<string>, config: SprintConfig): { deck: Deck<string>; prompt: Prompt } {
	const drawn = draw(deck, config.rng);
	const prompt =
		config.mode === 'letters'
			? letterPrompt(drawn.item, config.variant, config.rng)
			: textPrompt(config.mode, config.variant, drawn.item);
	return { deck: drawn.deck, prompt };
}

export function createSprint(config: SprintConfig, now: number): SprintState {
	const { deck, prompt } = deal(newDeck(deckItems(config), config.rng), config);
	const { practice } = config;
	return {
		config,
		phase: 'countdown',
		resumeTo: null,
		lastEventAt: now,
		countdownLeft: COUNTDOWN_MS,
		sprintLeft: SPRINT_MS,
		itemLeft: itemLimit(config),
		lockoutLeft: 0,
		input: practice ? fallbackInput(config) : 'speech',
		ranked: !practice,
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

function withMissed(missed: readonly string[], id: string): readonly string[] {
	return missed.includes(id) ? missed : [...missed, id];
}

function scoreAndNext(state: SprintState): SprintState {
	const points = state.prompt.kind === 'text' ? state.prompt.points : 1;
	return nextItem({
		...state,
		score: state.score + points,
		counters: recordCorrect(state.counters)
	});
}

/** The tap fallback reveals the answer and locks out for 1.5 s (spec 5.6). */
function lockoutMiss(
	state: SprintState,
	kind: 'wrong' | 'timeouts',
	chosen: string | null
): SprintState {
	return {
		...state,
		phase: 'lockout',
		lockoutLeft: LOCKOUT_MS,
		reveal: { chosen, correct: state.prompt.id },
		counters: recordMiss(state.counters, kind),
		missed: withMissed(state.missed, state.prompt.id)
	};
}

/** A spoken sprint never locks out: a miss moves straight to the next item (spec 5.4). */
function moveOnMiss(state: SprintState, kind: 'wrong' | 'timeouts' | 'skips'): SprintState {
	return nextItem({
		...state,
		counters: recordMiss(state.counters, kind),
		missed: withMissed(state.missed, state.prompt.id)
	});
}

function timeout(state: SprintState): SprintState {
	return state.input === 'choices'
		? lockoutMiss(state, 'timeouts', null)
		: moveOnMiss(state, 'timeouts');
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
			else if (s.itemLeft === 0) s = timeout(s);
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
			if (s.phase !== 'active' || s.input !== 'choices' || s.prompt.kind !== 'letter') return s;
			return event.choice === s.prompt.id ? scoreAndNext(s) : lockoutMiss(s, 'wrong', event.choice);
		}
		case 'matched': {
			const s = advance(state, event.now);
			return s.phase === 'active' && s.input === 'speech' ? scoreAndNext(s) : s;
		}
		case 'skip': {
			const s = advance(state, event.now);
			return s.phase === 'active' && s.input === 'speech' ? moveOnMiss(s, 'skips') : s;
		}
		case 'selfReport': {
			const s = advance(state, event.now);
			if (s.phase !== 'active' || s.input !== 'selfReport') return s;
			return event.correct ? scoreAndNext(s) : moveOnMiss(s, 'wrong');
		}
		case 'speechLost': {
			const s = advance(state, event.now);
			if (s.phase === 'finished' || s.input !== 'speech') return s;
			return { ...s, input: fallbackInput(s.config), ranked: false };
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
	if (next.counters.skips > prev.counters.skips) return 'skip';
	return null;
}
