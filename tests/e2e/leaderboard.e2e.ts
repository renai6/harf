import { expect, test } from '@playwright/test';

function seedData() {
	const players = Array.from({ length: 12 }, (_, i) => ({
		id: `p${i}`,
		name: `Player ${i + 1}`,
		createdAt: '2026-09-14T09:00:00.000Z'
	}));
	const run = (playerId: string, score: number, board: string) => ({
		id: `${playerId}-${board}`,
		playerId,
		board,
		score,
		correct: score,
		attempts: score + 1,
		bestStreak: 3,
		missed: [],
		finishedAt: '2026-09-14T10:00:00.000Z'
	});
	return {
		version: 1,
		players,
		lastPlayerId: 'p11',
		runs: [],
		bests: {
			'letters:normal:isolated': Object.fromEntries(
				players.map((p, i) => [p.id, run(p.id, 40 - i, 'letters:normal:isolated')])
			),
			'words:normal:quran': { p0: run('p0', 12, 'words:normal:quran') },
			'letters:fast:forms': { p3: run('p3', 17, 'letters:fast:forms') }
		},
		settings: { sound: false }
	};
}

test('shows the top 10 per board with the current player highlighted', async ({ page }) => {
	await page.addInitScript((data) => {
		localStorage.setItem('harf-sprint:v1', JSON.stringify(data));
	}, seedData());
	await page.goto('/leaderboard');

	await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible();

	const board = page.getByRole('list', { name: 'Leaderboard' });
	const rows = board.getByRole('listitem');
	await expect(rows).toHaveCount(11);
	await expect(rows.first()).toContainText('Player 1');
	await expect(rows.first()).toContainText('40');
	const mine = board.locator('li[aria-current="true"]');
	await expect(mine).toContainText('Player 12');
	await expect(mine).toContainText('29');

	await page.getByRole('button', { name: 'Fast' }).click();
	await expect(page.getByText('No scores yet. Be the first!')).toBeVisible();
	await page.getByRole('button', { name: 'All forms' }).click();
	await expect(rows).toHaveCount(1);
	await expect(rows.first()).toContainText('Player 4');

	await page.getByRole('button', { name: 'Words' }).click();
	await page.getByRole('button', { name: 'Normal' }).click();
	await expect(page.getByRole('group', { name: 'Content' })).toBeVisible();
	await expect(rows).toHaveCount(1);
	await expect(rows.first()).toContainText('Player 1');
	await expect(rows.first()).toContainText('12');
	await page.getByRole('button', { name: 'Modern Standard' }).click();
	await expect(page.getByText('No scores yet. Be the first!')).toBeVisible();
});
