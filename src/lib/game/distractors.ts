import { confusablesOf } from '$lib/content/confusables';
import { shuffle, type Rng } from './rng';

const MAX_CONFUSABLES = 2;
const DISTRACTOR_COUNT = 3;

export function pickDistractors(target: string, all: readonly string[], rng: Rng): string[] {
	const pool = all.filter((char) => char !== target);
	if (pool.length < DISTRACTOR_COUNT) throw new Error('Need at least 4 letters to build choices');
	const close = shuffle(
		confusablesOf(target).filter((char) => pool.includes(char)),
		rng
	).slice(0, MAX_CONFUSABLES);
	const rest = shuffle(
		pool.filter((char) => !close.includes(char)),
		rng
	).slice(0, DISTRACTOR_COUNT - close.length);
	return [...close, ...rest];
}

export function buildChoices(target: string, all: readonly string[], rng: Rng): string[] {
	return shuffle([target, ...pickDistractors(target, all, rng)], rng);
}
