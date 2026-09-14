import type { Letter } from './types';

export const LETTERS: readonly Letter[] = [
	{ char: 'ا', name: 'alif', arabicName: 'ألف', joins: false },
	{ char: 'ب', name: 'baa', arabicName: 'باء', joins: true },
	{ char: 'ت', name: 'taa', arabicName: 'تاء', joins: true },
	{ char: 'ث', name: 'thaa', arabicName: 'ثاء', joins: true },
	{ char: 'ج', name: 'jeem', arabicName: 'جيم', joins: true },
	{ char: 'ح', name: 'Haa', arabicName: 'حاء', joins: true },
	{ char: 'خ', name: 'khaa', arabicName: 'خاء', joins: true },
	{ char: 'د', name: 'daal', arabicName: 'دال', joins: false },
	{ char: 'ذ', name: 'dhaal', arabicName: 'ذال', joins: false },
	{ char: 'ر', name: 'raa', arabicName: 'راء', joins: false },
	{ char: 'ز', name: 'zaay', arabicName: 'زاي', joins: false },
	{ char: 'س', name: 'seen', arabicName: 'سين', joins: true },
	{ char: 'ش', name: 'sheen', arabicName: 'شين', joins: true },
	{ char: 'ص', name: 'Saad', arabicName: 'صاد', joins: true },
	{ char: 'ض', name: 'Daad', arabicName: 'ضاد', joins: true },
	{ char: 'ط', name: 'Taa', arabicName: 'طاء', joins: true },
	{ char: 'ظ', name: 'Zaa', arabicName: 'ظاء', joins: true },
	{ char: 'ع', name: 'ayn', arabicName: 'عين', joins: true },
	{ char: 'غ', name: 'ghayn', arabicName: 'غين', joins: true },
	{ char: 'ف', name: 'faa', arabicName: 'فاء', joins: true },
	{ char: 'ق', name: 'qaaf', arabicName: 'قاف', joins: true },
	{ char: 'ك', name: 'kaaf', arabicName: 'كاف', joins: true },
	{ char: 'ل', name: 'laam', arabicName: 'لام', joins: true },
	{ char: 'م', name: 'meem', arabicName: 'ميم', joins: true },
	{ char: 'ن', name: 'noon', arabicName: 'نون', joins: true },
	{ char: 'ه', name: 'haa', arabicName: 'هاء', joins: true },
	{ char: 'و', name: 'waaw', arabicName: 'واو', joins: false },
	{ char: 'ي', name: 'yaa', arabicName: 'ياء', joins: true }
];

export const LETTER_CHARS: readonly string[] = LETTERS.map((letter) => letter.char);

export function letterByChar(char: string): Letter {
	const letter = LETTERS.find((l) => l.char === char);
	if (!letter) throw new Error(`Unknown letter: ${char}`);
	return letter;
}
