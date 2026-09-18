import { LETTER_CHARS, letterByChar } from '$lib/content/letters';
import { PACKS } from '$lib/content/packs';
import type { Sentence, Word } from '$lib/content/types';
import { wordCount, type MatchKind } from '$lib/speech/match';
import { buildChoices } from './distractors';
import { formsFor, renderForm, type Form } from './forms';
import type { LetterVariant, PackVariant } from './levels';
import { pick, type Rng } from './rng';

export type TextMode = 'words' | 'sentences';

export type LetterPrompt = {
	kind: 'letter';
	/** The letter character; also the correct choice. */
	id: string;
	form: Form;
	/** Text to render, including zero-width joiners for positional forms. */
	display: string;
	choices: readonly string[];
};

export type TextPrompt = {
	kind: 'text';
	/** The pack item id. */
	id: string;
	/** Fully vowelled Arabic to read aloud. */
	display: string;
	matchKind: MatchKind;
	/** Words score 1; sentences score 1 per word (spec 5.5). */
	points: number;
};

export type Prompt = LetterPrompt | TextPrompt;

export function textItems(mode: TextMode, variant: PackVariant): readonly (Word | Sentence)[] {
	return mode === 'words' ? PACKS[variant].words : PACKS[variant].sentences;
}

export function textItem(mode: TextMode, variant: PackVariant, id: string): Word | Sentence {
	const item = textItems(mode, variant).find((candidate) => candidate.id === id);
	if (!item) throw new Error(`Unknown ${mode} item: ${id}`);
	return item;
}

export function letterPrompt(char: string, variant: LetterVariant, rng: Rng): LetterPrompt {
	const letter = letterByChar(char);
	const form = variant === 'forms' ? pick(formsFor(letter), rng) : 'isolated';
	return {
		kind: 'letter',
		id: letter.char,
		form,
		display: renderForm(letter.char, form),
		choices: buildChoices(letter.char, LETTER_CHARS, rng)
	};
}

export function textPrompt(mode: TextMode, variant: PackVariant, id: string): TextPrompt {
	const item = textItem(mode, variant, id);
	return {
		kind: 'text',
		id: item.id,
		display: item.text,
		matchKind: mode === 'words' ? 'word' : 'sentence',
		points: mode === 'words' ? 1 : wordCount(item.text)
	};
}
