import { tokens } from './normalize';

export type MatchKind = 'word' | 'sentence';

export type MatchResult = { matched: boolean; ratio: number };

export const SENTENCE_THRESHOLD = 0.8;

/**
 * Extra transcript tokens compared beyond the expected length.
 * Chrome can append a new answer to the previous item's still-open result, so only the tail counts.
 */
const TAIL_SLACK = 2;

export function matchTranscript(
	expected: string,
	transcript: string,
	kind: MatchKind
): MatchResult {
	const want = tokens(expected);
	if (want.length === 0) return { matched: false, ratio: 0 };
	const pool = tokens(transcript).slice(-(want.length + TAIL_SLACK));
	let found = 0;
	for (const word of want) {
		const index = pool.indexOf(word);
		if (index === -1) continue;
		pool.splice(index, 1);
		found++;
	}
	const ratio = found / want.length;
	return { matched: kind === 'word' ? ratio === 1 : ratio >= SENTENCE_THRESHOLD, ratio };
}

export function wordCount(text: string): number {
	return tokens(text).length;
}
