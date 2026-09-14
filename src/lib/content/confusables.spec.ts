import { describe, expect, it } from 'vitest';
import { CONFUSION_GROUPS, confusablesOf } from './confusables';
import { LETTER_CHARS } from './letters';

describe('confusables', () => {
	it('only references known letters', () => {
		for (const group of CONFUSION_GROUPS) {
			for (const char of group) expect(LETTER_CHARS).toContain(char);
		}
	});

	it('merges shape and sound groups without the letter itself', () => {
		expect(confusablesOf('ب').sort()).toEqual(['ت', 'ث', 'ن', 'ي'].sort());
		expect(confusablesOf('س').sort()).toEqual(['ث', 'ش', 'ص'].sort());
		expect(confusablesOf('ت').sort()).toEqual(['ب', 'ث', 'ط', 'ن', 'ي'].sort());
	});

	it('returns nothing for letters in no group', () => {
		expect(confusablesOf('ل')).toEqual([]);
	});
});
