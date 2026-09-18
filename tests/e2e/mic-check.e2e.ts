import { expect, test, type Page } from '@playwright/test';
import { createPlayer, pauseClock } from './helpers';
import { failSpeech, installFakeSpeech, say, speechState } from './speech';

const micCheck = (page: Page) => page.getByRole('region', { name: 'Microphone check' });
const focusedInMicCheck = (page: Page) => micCheck(page).locator(':focus');

test('a passed mic check starts the speech sprint and is not asked again this session', async ({
	page
}) => {
	await installFakeSpeech(page);
	await createPlayer(page, 'Sara');
	await page.getByRole('button', { name: /Words/ }).click();
	await expect(page.getByRole('group', { name: 'Content' })).toBeVisible();
	await expect(page.getByText('6 seconds per word')).toBeVisible();
	await page.getByRole('button', { name: 'Modern Standard' }).click();
	await page.getByRole('button', { name: 'Start' }).click();

	await expect(micCheck(page)).toContainText('Chrome sends your voice to Google');
	await micCheck(page).getByRole('button', { name: 'Start check' }).click();
	await expect(micCheck(page).getByTestId('mic')).toContainText('Listening');
	await say(page, 'بسم الله');
	await expect(page).toHaveURL('/play?mode=words&level=normal&variant=msa');

	await page.getByRole('link', { name: 'Quit' }).click();
	await expect(page).toHaveURL('/modes');
	expect((await speechState(page)).active).toBe(false);
	await page.getByRole('button', { name: /Sentences/ }).click();
	await page.getByRole('button', { name: 'Start' }).click();
	// Modern Standard carries over: the setup screen reopens on the last sprint that was started.
	await expect(page).toHaveURL('/play?mode=sentences&level=normal&variant=msa');
});

test('a blocked microphone explains how to allow it and offers practice', async ({ page }) => {
	await installFakeSpeech(page, { denied: true });
	await createPlayer(page, 'Sara');
	await page.getByRole('button', { name: /Words/ }).click();
	await page.getByRole('button', { name: 'Start' }).click();
	await micCheck(page).getByRole('button', { name: 'Start check' }).click();
	await expect(micCheck(page).getByRole('alert')).toContainText('The microphone is blocked');
	await micCheck(page).getByRole('button', { name: 'Practice' }).click();
	await expect(page).toHaveURL('/play?mode=words&level=normal&variant=quran&practice=1');
});

test('a check that hears nothing times out and can be retried', async ({ page }) => {
	await pauseClock(page);
	await installFakeSpeech(page);
	await createPlayer(page, 'Sara');
	await page.getByRole('button', { name: /Sentences/ }).click();
	await page.getByRole('button', { name: 'Start' }).click();
	await micCheck(page).getByRole('button', { name: 'Start check' }).click();
	await expect(micCheck(page).getByTestId('mic')).toContainText('Listening');
	await page.clock.fastForward(8_000);
	await expect(micCheck(page).getByRole('alert')).toContainText('We did not hear it');
	await micCheck(page).getByRole('button', { name: 'Try again' }).click();
	await say(page, 'بسم الله');
	await expect(page).toHaveURL('/play?mode=sentences&level=normal&variant=quran');
});

test('a browser without speech recognition offers practice only', async ({ page }) => {
	await installFakeSpeech(page, { unsupported: true });
	await createPlayer(page, 'Sara');
	await page.getByRole('button', { name: /Words/ }).click();
	await page.getByRole('button', { name: 'Start' }).click();
	await expect(micCheck(page).getByRole('alert')).toContainText(
		'This browser cannot recognize speech'
	);
	await expect(micCheck(page).getByRole('button', { name: 'Try again' })).toBeHidden();
	await micCheck(page).getByRole('button', { name: 'Practice' }).click();
	await expect(page).toHaveURL('/play?mode=words&level=normal&variant=quran&practice=1');
});

test('Cancel closes the mic check', async ({ page }) => {
	await installFakeSpeech(page);
	await createPlayer(page, 'Sara');
	await page.getByRole('button', { name: /Words/ }).click();
	await page.getByRole('button', { name: 'Start' }).click();
	await micCheck(page).getByRole('button', { name: 'Cancel' }).click();
	await expect(micCheck(page)).toBeHidden();
	await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
});

test('keyboard focus stays inside the mic check panel through every state', async ({ page }) => {
	await installFakeSpeech(page);
	await createPlayer(page, 'Sara');
	await page.getByRole('button', { name: /Words/ }).click();
	await page.getByRole('button', { name: 'Start' }).click();

	// The intro panel replaces Start, so focus must not fall back to <body>.
	await expect(focusedInMicCheck(page)).toHaveCount(1);

	await micCheck(page).getByRole('button', { name: 'Start check' }).click();
	await expect(micCheck(page).getByTestId('mic')).toContainText('Listening');
	await expect(focusedInMicCheck(page)).toHaveCount(1);

	await failSpeech(page, 'other');
	await expect(micCheck(page).getByRole('alert')).toContainText('stopped unexpectedly');
	await expect(focusedInMicCheck(page)).toHaveCount(1);
});
