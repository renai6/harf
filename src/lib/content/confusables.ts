/** Letters that look alike (same base shape, different dots). */
const SHAPE_GROUPS = ['بتثني', 'جحخ', 'دذ', 'رز', 'سش', 'صض', 'طظ', 'عغ', 'فق'];

/** Letters that sound alike to learners. */
const SOUND_GROUPS = ['تط', 'دض', 'سص', 'ثس', 'ذزظ', 'حه', 'كق', 'عا'];

export const CONFUSION_GROUPS: readonly (readonly string[])[] = [
	...SHAPE_GROUPS,
	...SOUND_GROUPS
].map((group) => [...group]);

export function confusablesOf(char: string): string[] {
	const found = new Set<string>();
	for (const group of CONFUSION_GROUPS) {
		if (!group.includes(char)) continue;
		for (const other of group) if (other !== char) found.add(other);
	}
	return [...found];
}
