import { tokens } from './normalize';

export type MatchKind = 'word' | 'sentence';

/** Shortest sentence that may still count with one of its words missing. */
export const SENTENCE_FORGIVENESS_MIN_WORDS = 3;

/**
 * Extra transcript tokens compared beyond the expected length.
 * Chrome can append a new answer to the previous item's still-open result, so only the tail counts.
 */
const TAIL_SLACK = 2;

/**
 * Matches expected text against a transcript window per spec 8.7. Callers must pass only
 * the transcript for the current item, taken from the listener's `markItemBoundary()` onward.
 * `TAIL_SLACK` exists solely to absorb Chrome's one-result overlap, where a new answer is
 * appended to the previous item's still-open result; it is not licence to pass the whole
 * session transcript, since a previous item's leftover words would then help pay for a short sentence.
 *
 * A sentence of `SENTENCE_FORGIVENESS_MIN_WORDS` or more words may miss one word, but only once
 * `isFinal` says the recognizer has closed the result: in an interim transcript a missing word
 * usually means "not said yet" rather than "not recognized", and forgiving it would score the
 * reader before they reach the end of the sentence.
 */
export function matchTranscript(
	expected: string,
	transcript: string,
	kind: MatchKind,
	isFinal = false
): boolean {
	const want = tokens(expected);
	if (want.length === 0) return false;
	const pool = tokens(transcript).slice(-(want.length + TAIL_SLACK));
	let found = 0;
	for (const word of want) {
		const index = pool.indexOf(word);
		if (index === -1) continue;
		pool.splice(index, 1);
		found++;
	}
	const forgiving = kind === 'sentence' && isFinal && want.length >= SENTENCE_FORGIVENESS_MIN_WORDS;
	return found >= want.length - (forgiving ? 1 : 0);
}

/**
 * True when the transcript matches any accepted spelling of the current item. Letters accept
 * their Arabic name or the bare letter; words and sentences accept only their own text.
 */
export function matchAny(
	accepted: readonly string[],
	transcript: string,
	kind: MatchKind,
	isFinal = false
): boolean {
	return accepted.some((expected) => matchTranscript(expected, transcript, kind, isFinal));
}

export function wordCount(text: string): number {
	return tokens(text).length;
}
