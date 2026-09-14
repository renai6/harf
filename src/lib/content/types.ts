export type Letter = {
	/** The isolated letter, also used as the letter's id. */
	char: string;
	/** Transliterated name shown on answer buttons. Emphatic letters are capitalized (Haa, Saad). */
	name: string;
	arabicName: string;
	/** Whether the letter connects to the following letter. */
	joins: boolean;
};
