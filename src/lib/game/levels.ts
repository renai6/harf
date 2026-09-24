export const MODES = ['letters', 'words', 'sentences'] as const;
export type Mode = (typeof MODES)[number];

export const LEVELS = ['relaxed', 'normal', 'fast'] as const;
export type Level = (typeof LEVELS)[number];

export const LETTER_VARIANTS = ['isolated', 'forms'] as const;
export type LetterVariant = (typeof LETTER_VARIANTS)[number];

export const PACK_VARIANTS = ['quran', 'msa'] as const;
export type PackVariant = (typeof PACK_VARIANTS)[number];

export type Setup =
	| { mode: 'letters'; level: Level; variant: LetterVariant }
	| { mode: 'words' | 'sentences'; level: Level; variant: PackVariant };

export type BoardKey =
	`letters:${Level}:${LetterVariant}` | `${'words' | 'sentences'}:${Level}:${PackVariant}`;

export const SPRINT_MS = 60_000;
export const COUNTDOWN_MS = 3_000;
export const LOCKOUT_MS = 1_500;

export const ITEM_LIMIT_MS: Record<Mode, Record<Level, number>> = {
	letters: { relaxed: 6_000, normal: 4_000, fast: 2_500 },
	words: { relaxed: 10_000, normal: 6_000, fast: 4_000 },
	sentences: { relaxed: 20_000, normal: 12_000, fast: 8_000 }
};

export const MODE_LABELS: Record<Mode, string> = {
	letters: 'Letters',
	words: 'Words',
	sentences: 'Sentences'
};

export const LEVEL_LABELS: Record<Level, string> = {
	relaxed: 'Relaxed',
	normal: 'Normal',
	fast: 'Fast'
};

export const VARIANT_LABELS: Record<LetterVariant | PackVariant, string> = {
	isolated: 'Isolated',
	forms: 'All forms',
	quran: 'Quranic',
	msa: 'Modern Standard'
};

const includes = <T extends string>(list: readonly T[], value: string): value is T =>
	(list as readonly string[]).includes(value);

export function boardKey(setup: Setup): BoardKey {
	return `${setup.mode}:${setup.level}:${setup.variant}` as BoardKey;
}

export function parseBoardKey(value: string): Setup | null {
	const [mode, level, variant, ...rest] = value.split(':');
	if (rest.length > 0 || level === undefined || variant === undefined) return null;
	if (!includes(LEVELS, level)) return null;
	if (mode === 'letters' && includes(LETTER_VARIANTS, variant)) return { mode, level, variant };
	if ((mode === 'words' || mode === 'sentences') && includes(PACK_VARIANTS, variant)) {
		return { mode, level, variant };
	}
	return null;
}

export function isBoardKey(value: unknown): value is BoardKey {
	return typeof value === 'string' && parseBoardKey(value) !== null;
}

export const ALL_BOARD_KEYS: readonly BoardKey[] = MODES.flatMap((mode) =>
	LEVELS.flatMap((level) =>
		(mode === 'letters' ? LETTER_VARIANTS : PACK_VARIANTS).map(
			(variant) => `${mode}:${level}:${variant}` as BoardKey
		)
	)
);

/** Names a board in prose, for headings that show a board without the controls that pick it. */
export function boardLabel(setup: Setup): string {
	return `${MODE_LABELS[setup.mode]} · ${LEVEL_LABELS[setup.level]} · ${VARIANT_LABELS[setup.variant]}`;
}
