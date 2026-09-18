import type { PackVariant } from '$lib/game/levels';

export type Letter = {
	/** The isolated letter, also used as the letter's id. */
	char: string;
	/** Transliterated name shown on answer buttons. Emphatic letters are capitalized (Haa, Saad). */
	name: string;
	arabicName: string;
	/** Whether the letter connects to the following letter. */
	joins: boolean;
};

/**
 * Transliteration convention for words and sentences: long vowels doubled (aa, ii, uu),
 * emphatic letters capitalized (H, S, D, T, Z), and an apostrophe for both hamza and 'ayn.
 */
export type Word = {
	/** Stable id, stored in saved runs. Prefixed by pack: `q-` or `m-`. */
	id: string;
	/** Fully vowelled Arabic. */
	text: string;
	translit: string;
	meaning: string;
};

export type Sentence = {
	/** Stable id, stored in saved runs. Prefixed by pack: `q-` or `m-`. */
	id: string;
	/** Fully vowelled Arabic, 2 to 6 words. */
	text: string;
	translit: string;
	meaning: string;
	/** `surah:ayah` for Quranic sentences. */
	source?: string;
};

export type Pack = {
	id: PackVariant;
	words: readonly Word[];
	sentences: readonly Sentence[];
};
