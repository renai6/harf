import { describe, expect, it } from 'vitest';
import { CORRUPT_KEY_PREFIX, RUN_CAP, STORAGE_KEY, type Run, type StoredData } from './schema';
import { createStore, type Backend, type NewRun } from './store.svelte';

class MemoryBackend implements Backend {
	items = new Map<string, string>();
	failWrites = false;
	getItem(key: string) {
		return this.items.get(key) ?? null;
	}
	setItem(key: string, value: string) {
		if (this.failWrites) throw new Error('QuotaExceededError');
		this.items.set(key, value);
	}
	removeItem(key: string) {
		this.items.delete(key);
	}
}

function setup(backend = new MemoryBackend()) {
	let clock = Date.parse('2026-09-14T10:00:00.000Z');
	let ids = 0;
	const deps = { now: () => new Date((clock += 1_000)), uuid: () => `id-${++ids}` };
	return { backend, store: createStore(backend, deps), reopen: () => createStore(backend, deps) };
}

const newRun = (score: number, correct = score, attempts = score): NewRun => ({
	board: 'letters:normal:isolated',
	score,
	correct,
	attempts,
	bestStreak: 1,
	missed: []
});

describe('players', () => {
	it('adds, selects and persists a normalized player', () => {
		const { store, reopen } = setup();
		const result = store.addPlayer('  Sara  ');
		expect(result).toEqual({
			player: { id: 'id-1', name: 'Sara', createdAt: '2026-09-14T10:00:01.000Z' }
		});
		expect(store.currentPlayer?.name).toBe('Sara');
		expect(reopen().data.players.map((p) => p.name)).toEqual(['Sara']);
		expect(reopen().notice).toBeNull();
	});

	it('rejects duplicate names ignoring case', () => {
		const { store } = setup();
		store.addPlayer('Sara');
		expect(store.addPlayer('SARA')).toEqual({ error: 'taken' });
		expect(store.data.players).toHaveLength(1);
	});

	it('renames while keeping the id', () => {
		const { store } = setup();
		store.addPlayer('Sara');
		store.addPlayer('Yusuf');
		expect(store.renamePlayer('id-1', 'Yusuf')).toBe('taken');
		expect(store.renamePlayer('id-1', 'sara')).toBeNull();
		expect(store.data.players[0]).toMatchObject({ id: 'id-1', name: 'sara' });
	});

	it('deletes a player with their runs and bests', () => {
		const { store } = setup();
		store.addPlayer('Sara');
		store.saveRun('id-1', newRun(5));
		store.addPlayer('Yusuf');
		store.saveRun('id-3', newRun(3));
		expect(store.deletePlayer('id-3')).toBe(true);
		expect(store.data.players.map((p) => p.name)).toEqual(['Sara']);
		expect(store.data.lastPlayerId).toBeNull();
		expect(store.data.runs.every((r) => r.playerId === 'id-1')).toBe(true);
		expect(Object.keys(store.data.bests['letters:normal:isolated'] ?? {})).toEqual(['id-1']);
	});

	it('merges writes from another tab instead of overwriting them', () => {
		const { store: tabA, reopen } = setup();
		const tabB = reopen();
		tabA.addPlayer('Sara');
		tabB.addPlayer('Yusuf');
		expect(tabB.data.players.map((p) => p.name)).toEqual(['Sara', 'Yusuf']);
		expect(tabA.data.players).toHaveLength(1);
		tabA.reload();
		expect(tabA.data.players).toHaveLength(2);
	});
});

describe('runs', () => {
	it('saves runs and tracks personal bests', () => {
		const { store } = setup();
		store.addPlayer('Sara');
		const first = store.saveRun('id-1', newRun(10));
		expect(first).toMatchObject({ saved: true, personalBest: true });
		expect(store.saveRun('id-1', newRun(8))).toMatchObject({ saved: true, personalBest: false });
		const better = store.saveRun('id-1', newRun(11));
		expect(better).toMatchObject({ saved: true, personalBest: true });
		expect(store.data.runs.map((r) => r.score)).toEqual([11, 8, 10]);
		expect(store.data.bests['letters:normal:isolated']?.['id-1']?.score).toBe(11);
	});

	it('saves under the player who started the round after another tab switches player', () => {
		const { store: tabA, reopen } = setup();
		tabA.addPlayer('Sara');
		const tabB = reopen();
		tabB.addPlayer('Yusuf');
		tabA.reload();
		expect(tabA.data.lastPlayerId).toBe('id-2');
		expect(tabA.saveRun('id-1', newRun(10))).toMatchObject({ saved: true, personalBest: true });
		const saved = reopen().data;
		expect(saved.runs.map((r) => r.playerId)).toEqual(['id-1']);
		expect(Object.keys(saved.bests['letters:normal:isolated'] ?? {})).toEqual(['id-1']);
	});

	it('does not save for a player deleted in another tab', () => {
		const { store: tabA, reopen } = setup();
		tabA.addPlayer('Sara');
		reopen().deletePlayer('id-1');
		expect(tabA.saveRun('id-1', newRun(10))).toEqual({ saved: false });
		expect(tabA.notice).toBeNull();
		const saved = reopen().data;
		expect(saved.runs).toEqual([]);
		expect(saved.bests).toEqual({});
	});

	it('caps runs without losing bests', () => {
		const backend = new MemoryBackend();
		const best: Run = {
			...newRun(99),
			id: 'old-best',
			playerId: 'p1',
			finishedAt: '2026-01-01T00:00:00.000Z'
		};
		const filler: Run[] = Array.from({ length: RUN_CAP }, (_, i) => ({
			...newRun(1),
			id: `run-${i}`,
			playerId: 'p1',
			finishedAt: '2026-02-01T00:00:00.000Z'
		}));
		const seeded: StoredData = {
			version: 1,
			players: [{ id: 'p1', name: 'Sara', createdAt: '2026-01-01T00:00:00.000Z' }],
			lastPlayerId: 'p1',
			runs: [...filler.slice(0, RUN_CAP - 1), best],
			bests: { 'letters:normal:isolated': { p1: best } },
			settings: { sound: true }
		};
		backend.setItem(STORAGE_KEY, JSON.stringify(seeded));
		const { store } = setup(backend);
		expect(store.saveRun('p1', newRun(2))).toMatchObject({ saved: true, personalBest: false });
		expect(store.data.runs).toHaveLength(RUN_CAP);
		expect(store.data.runs[0].score).toBe(2);
		expect(store.data.runs.some((r) => r.id === 'old-best')).toBe(false);
		expect(store.data.bests['letters:normal:isolated']?.p1?.id).toBe('old-best');
	});
});

describe('failures', () => {
	it('backs up corrupt data, starts fresh and shows a notice', () => {
		const backend = new MemoryBackend();
		backend.setItem(STORAGE_KEY, '{broken');
		const { store } = setup(backend);
		expect(store.data.players).toEqual([]);
		expect(store.notice).toBe('corrupt-reset');
		expect(backend.getItem(STORAGE_KEY)).toBeNull();
		const backups = [...backend.items.entries()].filter(([k]) => k.startsWith(CORRUPT_KEY_PREFIX));
		expect(backups.map(([, v]) => v)).toEqual(['{broken']);
		store.dismissNotice();
		expect(store.notice).toBeNull();
	});

	it('plays but never writes over data from a newer version', () => {
		const backend = new MemoryBackend();
		const future = JSON.stringify({ version: 2, players: [{ id: 'p9' }], whatever: true });
		backend.setItem(STORAGE_KEY, future);
		const { store, reopen } = setup(backend);
		expect(store.notice).toBe('newer-version');
		expect(store.data.players).toEqual([]);
		expect(store.addPlayer('Sara')).toEqual({ error: 'write-failed' });
		expect(store.saveRun('id-1', newRun(10))).toEqual({ saved: false });
		expect(store.setSound(false)).toBe(false);
		expect(backend.getItem(STORAGE_KEY)).toBe(future);

		// Resetting is the player's way out, and it clears the block.
		expect(store.resetAll()).toBe(true);
		expect(store.notice).toBeNull();
		expect(store.addPlayer('Sara')).toHaveProperty('player.name', 'Sara');
		expect(reopen().data.players.map((p) => p.name)).toEqual(['Sara']);
	});

	it('keeps playing when a write fails', () => {
		const { store, backend } = setup();
		store.addPlayer('Sara');
		backend.failWrites = true;
		expect(store.saveRun('id-1', newRun(10))).toEqual({ saved: false });
		expect(store.notice).toBe('write-failed');
		expect(store.data.runs).toEqual([]);
		expect(store.addPlayer('Yusuf')).toEqual({ error: 'write-failed' });
	});
});

describe('settings', () => {
	it('remembers the last setup and skips the write when it is unchanged', () => {
		const { store, backend, reopen } = setup();
		expect(store.data.settings.lastSetup).toBeUndefined();
		store.setLastSetup('sentences:fast:msa');
		expect(reopen().data.settings.lastSetup).toBe('sentences:fast:msa');

		backend.failWrites = true;
		store.setLastSetup('sentences:fast:msa');
		expect(store.notice).toBeNull();
	});

	it('toggles sound and resets all data', () => {
		const { store, reopen } = setup();
		store.addPlayer('Sara');
		store.setSound(false);
		expect(reopen().data.settings.sound).toBe(false);
		expect(store.resetAll()).toBe(true);
		expect(store.data.players).toEqual([]);
		expect(reopen().data.settings.sound).toBe(true);
	});
});
