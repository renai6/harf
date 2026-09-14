import { expect, test } from '@playwright/test';
import { answer, answerButtons, createPlayer, pauseClock } from './helpers';

test.beforeEach(async ({ page }) => {
	await pauseClock(page);
});

test('shows results, saves the run, restarts with Again and persists the best', async ({
	page
}) => {
	await createPlayer(page, 'Sara');
	await page.getByRole('button', { name: 'Relaxed' }).click();
	await page.getByRole('button', { name: 'Start' }).click();
	// The sprint starts once the page mounts; jumping the paused clock before that skips nothing.
	await expect(page.getByText('3', { exact: true })).toBeVisible();
	await page.clock.fastForward(3_000);
	await expect(answerButtons(page)).toHaveCount(4);
	await answer(page, true);
	await answer(page, true);
	await answer(page, true);
	await answer(page, false);
	await page.clock.fastForward(61_000);

	await expect(page.getByRole('heading', { name: "Time's up!" })).toBeVisible();
	await expect(page.getByTestId('result-score')).toHaveText('3');
	await expect(page.getByText('New personal best')).toBeVisible();
	const board = page.getByRole('list', { name: 'Leaderboard' });
	await expect(board.locator('li[aria-current="true"]')).toContainText('Sara');
	await expect(page.getByRole('heading', { name: 'Review what you missed' })).toBeVisible();

	await page.getByRole('button', { name: 'Again' }).click();
	await expect(page.getByText('3', { exact: true })).toBeVisible();
	await page.clock.fastForward(3_000);
	await expect(answerButtons(page)).toHaveCount(4);
	await answer(page, false);
	await page.clock.fastForward(61_000);
	await expect(page.getByTestId('result-score')).toHaveText('0');
	await expect(page.getByText('New personal best')).toBeHidden();

	await page.getByRole('link', { name: 'Home' }).click();
	// SvelteKit lets the browser paint before a link navigation, waiting at most a 100 ms timer.
	await page.clock.runFor(100);
	await expect(page.getByRole('button', { name: /Sara/ })).toContainText('Best 3');
	await page.reload();
	await expect(page.getByRole('button', { name: /Sara/ })).toContainText('Best 3');
});
