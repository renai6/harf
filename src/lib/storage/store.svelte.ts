import type { BoardKey } from '$lib/game/levels';
import { compareRuns } from '$lib/game/scoring';
import {
	CORRUPT_KEY_PREFIX,
	RUN_CAP,
	STORAGE_KEY,
	emptyData,
	normalizeName,
	parseData,
	validateName,
	type NameError,
	type Player,
	type Run,
	type StoredData
} from './schema';

export type Backend = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type Notice = 'corrupt-reset' | 'write-failed' | 'newer-version';
export type NewRun = Omit<Run, 'id' | 'playerId' | 'finishedAt'>;
export type SaveResult = { saved: false } | { saved: true; run: Run; personalBest: boolean };

type Deps = { now?: () => Date; uuid?: () => string };

export function createStore(
	backend: Backend,
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- plain Date, never held in reactive state
	{ now = () => new Date(), uuid = () => crypto.randomUUID() }: Deps = {}
) {
	let data = $state.raw<StoredData>(emptyData());
	let notice = $state<Notice | null>(null);
	/** Set while the stored data comes from a newer version of the game: play, but never overwrite it. */
	let readOnly = $state(false);

	function readRaw(): string | null {
		try {
			return backend.getItem(STORAGE_KEY);
		} catch {
			return null;
		}
	}

	function load(): void {
		const raw = readRaw();
		const result = parseData(raw);
		readOnly = result.newer;
		if (result.newer) {
			notice = 'newer-version';
		} else if (result.corrupt && raw !== null) {
			try {
				backend.setItem(CORRUPT_KEY_PREFIX + now().getTime(), raw);
			} catch {
				// The backup is best effort; the reset still happens.
			}
			try {
				backend.removeItem(STORAGE_KEY);
			} catch {
				// Ignored: the next successful write replaces the corrupt value.
			}
			notice = 'corrupt-reset';
		}
		data = result.data;
	}

	/**
	 * Reads the latest stored object, applies `change`, and writes the whole object back.
	 * `change` returns null to skip the write, which then counts as not saved.
	 */
	function commit(change: (latest: StoredData) => StoredData | null): boolean {
		if (readOnly) return false;
		const latest = parseData(readRaw());
		const next = change(latest.corrupt ? data : latest.data);
		if (next === null) return false;
		try {
			backend.setItem(STORAGE_KEY, JSON.stringify(next));
		} catch {
			notice = 'write-failed';
			return false;
		}
		data = next;
		return true;
	}

	function latestPlayers(): Player[] {
		const latest = parseData(readRaw());
		return latest.corrupt ? data.players : latest.data.players;
	}

	load();

	return {
		get data() {
			return data;
		},
		get notice() {
			return notice;
		},
		get currentPlayer(): Player | null {
			return data.players.find((p) => p.id === data.lastPlayerId) ?? null;
		},
		reload: load,
		dismissNotice() {
			notice = null;
		},
		addPlayer(name: string): { player: Player } | { error: NameError | 'write-failed' } {
			const error = validateName(name, latestPlayers());
			if (error) return { error };
			const player: Player = {
				id: uuid(),
				name: normalizeName(name),
				createdAt: now().toISOString()
			};
			const ok = commit((d) => ({
				...d,
				players: [...d.players, player],
				lastPlayerId: player.id
			}));
			return ok ? { player } : { error: 'write-failed' };
		},
		selectPlayer(id: string): boolean {
			return commit((d) => ({ ...d, lastPlayerId: id }));
		},
		renamePlayer(id: string, name: string): NameError | 'write-failed' | null {
			const error = validateName(name, latestPlayers(), id);
			if (error) return error;
			const players = (d: StoredData) =>
				d.players.map((p) => (p.id === id ? { ...p, name: normalizeName(name) } : p));
			return commit((d) => ({ ...d, players: players(d) })) ? null : 'write-failed';
		},
		deletePlayer(id: string): boolean {
			return commit((d) => ({
				...d,
				players: d.players.filter((p) => p.id !== id),
				lastPlayerId: d.lastPlayerId === id ? null : d.lastPlayerId,
				runs: d.runs.filter((r) => r.playerId !== id),
				bests: Object.fromEntries(
					Object.entries(d.bests).map(([board, byPlayer]) => [
						board,
						Object.fromEntries(
							Object.entries(byPlayer ?? {}).filter(([playerId]) => playerId !== id)
						)
					])
				)
			}));
		},
		/** Saves a run for the player who started the round, unless another tab has deleted them since. */
		saveRun(playerId: string, input: NewRun): SaveResult {
			const run: Run = { ...input, id: uuid(), playerId, finishedAt: now().toISOString() };
			let personalBest = false;
			const ok = commit((d) => {
				if (!d.players.some((p) => p.id === playerId)) return null;
				const board = d.bests[run.board] ?? {};
				const previous = board[playerId];
				personalBest = !previous || compareRuns(run, previous) < 0;
				return {
					...d,
					runs: [run, ...d.runs].slice(0, RUN_CAP),
					bests: personalBest ? { ...d.bests, [run.board]: { ...board, [playerId]: run } } : d.bests
				};
			});
			return ok ? { saved: true, run, personalBest } : { saved: false };
		},
		setSound(sound: boolean): boolean {
			return commit((d) => ({ ...d, settings: { ...d.settings, sound } }));
		},
		/** Remembers the sprint the player just set up. A failure here is silent; it only costs a default. */
		setLastSetup(lastSetup: BoardKey): void {
			commit((d) =>
				d.settings.lastSetup === lastSetup ? null : { ...d, settings: { ...d.settings, lastSetup } }
			);
		},
		/** The one write allowed on newer data: the player explicitly throws it away to use this build. */
		resetAll(): boolean {
			try {
				backend.removeItem(STORAGE_KEY);
			} catch {
				notice = 'write-failed';
				return false;
			}
			readOnly = false;
			if (notice === 'newer-version') notice = null;
			data = emptyData();
			return true;
		}
	};
}

export type Store = ReturnType<typeof createStore>;
