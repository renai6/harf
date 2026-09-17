/** Harakat U+064B-U+065F, superscript alef U+0670, Quranic annotation marks U+06D6-U+06ED, tatweel U+0640. */
const MARKS = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const FORMAT = /\p{Cf}/gu;
/** أ إ آ ٱ */
const ALEF_FORMS = /[\u0623\u0625\u0622\u0671]/g;
const TA_MARBUTA = /\u0629/g;
/** ى ئ */
const YA_FORMS = /[\u0649\u0626]/g;
const WAW_HAMZA = /\u0624/g;
const HAMZA = /\u0621/g;
const NOT_WORD = /[^\p{L}\p{N}\s]/gu;

/**
 * Makes vowelled text and recognizer transcripts comparable (spec 8.7).
 * Both sides of a comparison must go through this function.
 */
export function normalizeArabic(text: string): string {
	return text
		.replace(MARKS, '')
		.replace(FORMAT, '')
		.replace(ALEF_FORMS, '\u0627')
		.replace(TA_MARBUTA, '\u0647')
		.replace(YA_FORMS, '\u064A')
		.replace(WAW_HAMZA, '\u0648')
		.replace(HAMZA, '')
		.replace(NOT_WORD, ' ')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

export function tokens(text: string): string[] {
	const normalized = normalizeArabic(text);
	return normalized === '' ? [] : normalized.split(' ');
}
