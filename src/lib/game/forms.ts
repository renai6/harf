import type { Letter } from '$lib/content/types';

export type Form = 'isolated' | 'initial' | 'medial' | 'final';

export const ZWJ = '‍';

const JOINING_FORMS: readonly Form[] = ['isolated', 'initial', 'medial', 'final'];
const NON_JOINING_FORMS: readonly Form[] = ['isolated', 'final'];

export function formsFor(letter: Letter): readonly Form[] {
	return letter.joins ? JOINING_FORMS : NON_JOINING_FORMS;
}

export function renderForm(char: string, form: Form): string {
	switch (form) {
		case 'isolated':
			return char;
		case 'initial':
			return char + ZWJ;
		case 'medial':
			return ZWJ + char + ZWJ;
		case 'final':
			return ZWJ + char;
	}
}
