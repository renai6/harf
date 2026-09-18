import { isBoardKey, type BoardKey } from '$lib/game/levels';

export const DATA_VERSION = 1;
export const STORAGE_KEY = 'harf-sprint:v1';
export const CORRUPT_KEY_PREFIX = 'harf-sprint:corrupt:';
export const RUN_CAP = 1000;
export const NAME_MAX = 20;

export type Player = { id: string; name: string; createdAt: string };

export type Run = {
	id: string;
	playerId: string;
	board: BoardKey;
	score: number;
	correct: number;
	attempts: number;
	bestStreak: number;
	/** Item ids (letter characters in Letters mode). */
	missed: string[];
	finishedAt: string;
};

export type StoredData = {
	version: 1;
	players: Player[];
	lastPlayerId: string | null;
	/** Newest first, capped at RUN_CAP. */
	runs: Run[];
	/** Best run per board per player id. Kept separately so the run cap never loses bests. */
	bests: Partial<Record<BoardKey, Record<string, Run>>>;
	settings: {
		sound: boolean;
		/** The sprint the player set up last, so the setup screen reopens on it. */
		lastSetup?: BoardKey;
	};
};

export function emptyData(): StoredData {
	return {
		version: DATA_VERSION,
		players: [],
		lastPlayerId: null,
		runs: [],
		bests: {},
		settings: { sound: true }
	};
}

const isObject = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

function isPlayer(v: unknown): v is Player {
	return isObject(v) && isString(v.id) && isString(v.name) && isString(v.createdAt);
}

function isRun(v: unknown): v is Run {
	if (!isObject(v)) return false;
	const { missed } = v;
	return (
		isString(v.id) &&
		isString(v.playerId) &&
		isBoardKey(v.board) &&
		isCount(v.score) &&
		isCount(v.correct) &&
		isCount(v.attempts) &&
		isCount(v.bestStreak) &&
		Array.isArray(missed) &&
		missed.every(isString) &&
		isString(v.finishedAt)
	);
}

export function isStoredData(value: unknown): value is StoredData {
	if (!isObject(value) || value.version !== DATA_VERSION) return false;
	const { players, lastPlayerId, runs, bests, settings } = value;
	return (
		Array.isArray(players) &&
		players.every(isPlayer) &&
		(lastPlayerId === null || isString(lastPlayerId)) &&
		Array.isArray(runs) &&
		runs.every(isRun) &&
		isObject(bests) &&
		Object.entries(bests).every(
			([key, byPlayer]) =>
				isBoardKey(key) && isObject(byPlayer) && Object.values(byPlayer).every(isRun)
		) &&
		isObject(settings) &&
		typeof settings.sound === 'boolean' &&
		(settings.lastSetup === undefined || isBoardKey(settings.lastSetup))
	);
}

/** Upgrades older stored shapes by `version`. Version 1 is the first, so this is the identity for now. */
export function migrate(value: unknown): unknown {
	return value;
}

/** True for data written by a future version of the game, which this build must not rewrite. */
function isNewer(value: unknown): boolean {
	return isObject(value) && typeof value.version === 'number' && value.version > DATA_VERSION;
}

export type ParseResult = {
	data: StoredData;
	/** Unreadable data: the caller backs it up and starts fresh. */
	corrupt: boolean;
	/** Data from a future version: the caller keeps it and stops writing. */
	newer: boolean;
};

export function parseData(raw: string | null): ParseResult {
	if (raw === null) return { data: emptyData(), corrupt: false, newer: false };
	try {
		const parsed = JSON.parse(raw);
		if (isNewer(parsed)) return { data: emptyData(), corrupt: false, newer: true };
		const value = migrate(parsed);
		if (isStoredData(value)) return { data: value, corrupt: false, newer: false };
	} catch {
		// Unparseable JSON is handled as corrupt below.
	}
	return { data: emptyData(), corrupt: true, newer: false };
}

export type NameError = 'empty' | 'too-long' | 'taken';

/**
 * Invisible control and format characters. Whitespace is kept for the collapsing below, and
 * zero-width joiners stay only between two letters or marks, where they shape Arabic-script text.
 */
const INVISIBLE =
	/(?<![\p{L}\p{M}])[\u200c\u200d]|[\u200c\u200d](?![\p{L}\p{M}])|(?![\s\u200c\u200d])[\p{Cc}\p{Cf}]/gu;

export function normalizeName(name: string): string {
	return name.replace(INVISIBLE, '').trim().replace(/\s+/g, ' ');
}

export function validateName(
	name: string,
	players: readonly Player[],
	ignoreId?: string
): NameError | null {
	const normalized = normalizeName(name);
	if (!/\p{L}/u.test(normalized)) return 'empty';
	if ([...normalized].length > NAME_MAX) return 'too-long';
	const lower = normalized.toLocaleLowerCase();
	const taken = players.some(
		(p) => p.id !== ignoreId && normalizeName(p.name).toLocaleLowerCase() === lower
	);
	return taken ? 'taken' : null;
}
