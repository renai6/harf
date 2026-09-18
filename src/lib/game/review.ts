import { letterByChar } from '$lib/content/letters';
import { textItem } from './prompts';
import type { SprintConfig } from './sprint';

export type ReviewItem = {
	id: string;
	/** The Arabic that was shown. */
	arabic: string;
	/** The letter's transliterated name, or the item's transliteration. */
	label: string;
	/** The letter's Arabic name, or the item's English meaning. */
	detail: string;
};

export function reviewItems(config: SprintConfig, missed: readonly string[]): ReviewItem[] {
	return missed.map((id) => {
		if (config.mode === 'letters') {
			const letter = letterByChar(id);
			return { id, arabic: letter.char, label: letter.name, detail: letter.arabicName };
		}
		const item = textItem(config.mode, config.variant, id);
		return { id, arabic: item.text, label: item.translit, detail: item.meaning };
	});
}
