import { expect, test } from '@playwright/test';
import { answer, answerButtons, createPlayer, setHidden } from './helpers';

test.beforeEach(async ({ page }) => {
	await page.clock.install();
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
	await page.clock.runFor(3_000);
	await expect(answerButtons(page)).toHaveCount(4);
	await expect(page.getByTestId('sprint-time')).toHaveText('60s');

	await answer(page, true);
	await answer(page, true);
	await expect(page.getByTestId('sprint-score')).toHaveText('Score 2');

	await answer(page, false);
	await expect(answerButtons(page).first()).toBeDisabled();
	await page.clock.runFor(1_500);
	await expect(answerButtons(page).first()).toBeEnabled();
	await expect(page.getByTestId('sprint-score')).toHaveText('Score 2');

	await page.clock.runFor(60_000);
	await expect(page.getByRole('heading', { name: "Time's up!" })).toBeVisible();
});

test('pauses while the page is hidden and resumes on Continue', async ({ page }) => {
	await createPlayer(page, 'Sara');
	await page.getByRole('button', { name: 'Start' }).click();
	await page.clock.runFor(3_000);
	await expect(answerButtons(page)).toHaveCount(4);

	await setHidden(page, true);
	const dialog = page.getByRole('dialog', { name: 'Paused' });
	await expect(dialog).toBeVisible();
	const time = page.getByTestId('sprint-time');
	const frozen = (await time.textContent()) ?? '';
	await page.clock.runFor(20_000);
	await expect(time).toHaveText(frozen);

	await setHidden(page, false);
	await dialog.getByRole('button', { name: 'Continue' }).click();
	await expect(dialog).toBeHidden();
	await page.clock.runFor(2_000);
	await expect(time).not.toHaveText(frozen);
});
