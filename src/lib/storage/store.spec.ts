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
		store.saveRun(newRun(5));
		store.addPlayer('Yusuf');
		store.saveRun(newRun(3));
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
		const first = store.saveRun(newRun(10));
		expect(first).toMatchObject({ saved: true, personalBest: true });
		expect(store.saveRun(newRun(8))).toMatchObject({ saved: true, personalBest: false });
		const better = store.saveRun(newRun(11));
		expect(better).toMatchObject({ saved: true, personalBest: true });
		expect(store.data.runs.map((r) => r.score)).toEqual([11, 8, 10]);
		expect(store.data.bests['letters:normal:isolated']?.['id-1']?.score).toBe(11);
	});

	it('does not save without a current player', () => {
		const { store } = setup();
		expect(store.saveRun(newRun(10))).toEqual({ saved: false });
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
		expect(store.saveRun(newRun(2))).toMatchObject({ saved: true, personalBest: false });
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

	it('keeps playing when a write fails', () => {
		const { store, backend } = setup();
		store.addPlayer('Sara');
		backend.failWrites = true;
		expect(store.saveRun(newRun(10))).toEqual({ saved: false });
		expect(store.notice).toBe('write-failed');
		expect(store.data.runs).toEqual([]);
		expect(store.addPlayer('Yusuf')).toEqual({ error: 'write-failed' });
	});
});

describe('settings', () => {
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
