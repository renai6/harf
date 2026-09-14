import { expect, test } from '@playwright/test';
import { answer, answerButtons, createPlayer, pauseClock, setHidden } from './helpers';

test.beforeEach(async ({ page }) => {
	await pauseClock(page);
});

test('redirects without a player or with an invalid setup', async ({ page }) => {
	await page.goto('/play?mode=letters&level=normal&variant=isolated');
	await expect(page).toHaveURL('/');
	await createPlayer(page, 'Sara');
	await page.goto('/play?mode=letters&level=turbo&variant=isolated');
	await expect(page).toHaveURL('/modes');
});

test('counts down, scores correct answers, locks out wrong ones and ends', async ({ page }) => {
	await createPlayer(page, 'Sara');
	await page.getByRole('button', { name: 'Relaxed' }).click();
	await page.getByRole('button', { name: 'Start' }).click();

	await expect(page.getByText('3', { exact: true })).toBeVisible();
	await page.clock.fastForward(3_000);
	await expect(answerButtons(page)).toHaveCount(4);
	await expect(page.getByTestId('sprint-time')).toHaveText('60s');

	await answer(page, true);
	await answer(page, true);
	await expect(page.getByTestId('sprint-score')).toHaveText('Score 2');

	await answer(page, false);
	await expect(answerButtons(page).first()).toBeDisabled();
	await page.clock.fastForward(1_500);
	await expect(answerButtons(page).first()).toBeEnabled();
	await expect(page.getByTestId('sprint-score')).toHaveText('Score 2');

	await page.clock.fastForward(60_000);
	await expect(page.getByRole('heading', { name: "Time's up!" })).toBeVisible();
});

test('pauses while the page is hidden and resumes on Continue', async ({ page }) => {
	await createPlayer(page, 'Sara');
	await page.getByRole('button', { name: 'Start' }).click();
	// The sprint starts once the page mounts; jumping the paused clock before that skips nothing.
	await expect(page.getByText('3', { exact: true })).toBeVisible();
	await page.clock.fastForward(3_000);
	await expect(answerButtons(page)).toHaveCount(4);
	const time = page.getByTestId('sprint-time');
	await expect(time).toHaveText('60s');

	await setHidden(page, true);
	const dialog = page.getByRole('dialog', { name: 'Paused' });
	await expect(dialog).toBeVisible();
	await page.clock.fastForward(20_000);
	await expect(time).toHaveText('60s');

	await setHidden(page, false);
	await dialog.getByRole('button', { name: 'Continue' }).click();
	await expect(dialog).toBeHidden();
	// Only the time after Continue counts: 2 s, not the 20 s spent paused.
	await page.clock.fastForward(2_000);
	await expect(time).toHaveText('58s');
});

test('starts a sprint from a direct /play link and starts afresh after a reload', async ({
	page
}) => {
	await page.addInitScript(() => {
		const player = { id: 'p1', name: 'Sara', createdAt: '2026-09-14T08:00:00.000Z' };
		const data = {
			version: 1,
			players: [player],
			lastPlayerId: player.id,
			runs: [],
			bests: {},
			settings: { sound: false }
		};
		localStorage.setItem('harf-sprint:v1', JSON.stringify(data));
	});
	const url = '/play?mode=letters&level=fast&variant=forms';
	await page.goto(url);
	await expect(page.getByText('3', { exact: true })).toBeVisible();
	await page.clock.fastForward(3_000);
	await expect(answerButtons(page)).toHaveCount(4);
	await answer(page, true);
	await expect(page.getByTestId('sprint-score')).toHaveText('Score 1');

	await page.reload();
	await expect(page).toHaveURL(url);
	await expect(page.getByText('3', { exact: true })).toBeVisible();
	await expect(page.getByTestId('sprint-score')).toHaveText('Score 0');
	await page.clock.fastForward(3_000);
	await expect(answerButtons(page)).toHaveCount(4);
	await expect(page.getByTestId('sprint-time')).toHaveText('60s');
});
