import { expect, test, type Page } from '@playwright/test';
import { answer, answerButtons, createPlayer, pauseClock, seedPlayer, setHidden } from './helpers';

/**
 * The letters sprint is read aloud, so its answer buttons only appear in unranked practice
 * (spec 5.6). These tests drive them, because they are about the sprint clock and the reveal.
 */
const practiceUrl = (level = 'relaxed', variant = 'isolated') =>
	`/play?mode=letters&level=${level}&variant=${variant}&practice=1`;

async function startPractice(page: Page, url = practiceUrl()) {
	await seedPlayer(page);
	await page.goto(url);
	// The sprint starts once the page mounts; jumping the paused clock before that skips nothing.
	await expect(page.getByText('3', { exact: true })).toBeVisible();
	await page.clock.fastForward(3_000);
	await expect(answerButtons(page)).toHaveCount(4);
}

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
	await startPractice(page);
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
	await startPractice(page);
	const time = page.getByTestId('sprint-time');
	await expect(time).toHaveText('60s');

	await setHidden(page, true);
	const dialog = page.getByRole('dialog', { name: 'Paused' });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole('button', { name: 'Continue' })).toBeFocused();
	await expect(page.locator('header')).toHaveAttribute('inert');
	await expect(page.locator('main')).toHaveAttribute('inert');
	await page.clock.fastForward(20_000);
	await expect(time).toHaveText('60s');

	await setHidden(page, false);
	await dialog.getByRole('button', { name: 'Continue' }).click();
	await expect(dialog).toBeHidden();
	await expect(page.locator('main')).not.toHaveAttribute('inert');
	// Only the time after Continue counts: 2 s, not the 20 s spent paused.
	await page.clock.fastForward(2_000);
	await expect(time).toHaveText('58s');
});

test('starts a sprint from a direct /play link and starts afresh after a reload', async ({
	page
}) => {
	const url = practiceUrl('fast', 'forms');
	await startPractice(page, url);
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

test('fades the answers nobody chose while the correct one is revealed', async ({ page }) => {
	await startPractice(page);

	// The fade is a CSS transition, which runs on real time while the sprint clock is paused.
	const opacities = async () =>
		Promise.all(
			(await answerButtons(page).all()).map((button) =>
				button.evaluate((el) => getComputedStyle(el).opacity)
			)
		);

	await answer(page, false);
	await expect.poll(async () => (await opacities()).filter((o) => o === '0.4')).toHaveLength(2);

	await page.clock.fastForward(1_500);
	await expect(answerButtons(page).first()).toBeEnabled();
	await expect.poll(async () => [...new Set(await opacities())]).toEqual(['1']);
});
