import type { BoardKey } from '$lib/game/levels';
import { compareRuns } from '$lib/game/scoring';
import type { Player, Run, StoredData } from './schema';

export type BoardRow = { rank: number; player: Player; run: Run };

export function boardRows(data: StoredData, board: BoardKey): BoardRow[] {
	const byPlayer = data.bests[board] ?? {};
	return data.players
		.flatMap((player) => {
			const run = byPlayer[player.id];
			return run ? [{ player, run }] : [];
		})
		.sort((a, b) => compareRuns(a.run, b.run))
		.map((row, index) => ({ ...row, rank: index + 1 }));
}

export function playerBest(
	data: StoredData,
	board: BoardKey,
	playerId: string
): BoardRow | undefined {
	return boardRows(data, board).find((row) => row.player.id === playerId);
}

export function bestScore(data: StoredData, playerId: string): number | null {
	const scores = Object.values(data.bests).flatMap((byPlayer) => {
		const run = byPlayer?.[playerId];
		return run ? [run.score] : [];
	});
	return scores.length > 0 ? Math.max(...scores) : null;
}
