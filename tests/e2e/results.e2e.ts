import { expect, test, type Page } from '@playwright/test';
import { pauseClock, sayLetter, seedPlayer } from './helpers';
import { installFakeSpeech } from './speech';

/** A ranked letters sprint: relaxed gives 6 s to read each letter aloud. */
const RANKED = '/play?mode=letters&level=relaxed&variant=isolated';

async function startSprint(page: Page) {
	await page.goto(RANKED);
	// The sprint starts once the page mounts; jumping the paused clock before that skips nothing.
	await expect(page.getByText('3', { exact: true })).toBeVisible();
	await page.clock.fastForward(3_000);
	await expect(page.getByTestId('mic')).toContainText('Listening');
}

test.beforeEach(async ({ page }) => {
	await pauseClock(page);
	await seedPlayer(page);
	await installFakeSpeech(page);
});

test('shows results, saves the run, restarts with Again and persists the best', async ({
	page
}) => {
	await startSprint(page);
	await sayLetter(page, true);
	await expect(page.getByTestId('sprint-score')).toHaveText('Score 1');
	await sayLetter(page, true);
	await sayLetter(page, true);
	await sayLetter(page, false);
	await page.clock.fastForward(61_000);

	await expect(page.getByRole('heading', { name: "Time's up!" })).toBeVisible();
	await expect(page.getByTestId('result-score')).toHaveText('3');
	await expect(page.getByText('New personal best')).toBeVisible();
	const board = page.getByRole('list', { name: 'Leaderboard' });
	await expect(board.locator('li[aria-current="true"]')).toContainText('Sara');
	await expect(page.getByTestId('results-board')).toHaveText('Letters · Relaxed · Isolated');
	await expect(page.getByRole('heading', { name: 'Review what you missed' })).toBeVisible();

	await page.getByRole('button', { name: 'Again' }).click();
	// Again unmounts the button that was focused, so the sprint takes the focus.
	await expect(page.getByRole('main')).toBeFocused();
	await expect(page.getByText('3', { exact: true })).toBeVisible();
	await page.clock.fastForward(3_000);
	await expect(page.getByTestId('mic')).toContainText('Listening');
	await sayLetter(page, false);
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

test('does not congratulate a first run that scored nothing', async ({ page }) => {
	await startSprint(page);
	await sayLetter(page, false);
	await page.clock.fastForward(61_000);

	await expect(page.getByTestId('result-score')).toHaveText('0');
	await expect(page.getByText('New personal best')).toBeHidden();
});

test('shows the first six missed items and reveals the rest on request', async ({ page }) => {
	await startSprint(page);
	await page.clock.fastForward(61_000);

	const review = page.getByRole('list', { name: 'Review what you missed' });
	await expect(review.getByRole('listitem')).toHaveCount(6);

	// Saying nothing for the whole sprint leaves every 6 s letter missed, which is more than six.
	const showAll = page.getByRole('button', { name: /^Show all \(\d+\)$/ });
	const total = Number(((await showAll.textContent()) ?? '').match(/\d+/)?.[0]);
	expect(total).toBeGreaterThan(6);

	await showAll.click();
	await expect(review.getByRole('listitem')).toHaveCount(total);
	await expect(showAll).toBeHidden();
});
