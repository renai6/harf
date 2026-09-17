import { expect, test, type Page } from '@playwright/test';
import { wordCount } from '../../src/lib/speech/match';
import { pauseClock, savedRuns, seedPlayer, setHidden } from './helpers';
import { failSpeech, installFakeSpeech, promptText, say, speechState } from './speech';

const FALLBACK =
	'Speech recognition is not available, so this sprint is now practice and will not be ranked.';

test.beforeEach(async ({ page }) => {
	await pauseClock(page);
	await seedPlayer(page);
});

async function startSprint(page: Page, url: string) {
	await page.goto(url);
	// The sprint starts once the page mounts; jumping the paused clock before that skips nothing.
	await expect(page.getByText('3', { exact: true })).toBeVisible();
	await page.clock.fastForward(3_000);
	await expect(page.getByTestId('prompt')).toBeVisible();
}

test('scores words read aloud, ignores other speech and skips on request', async ({ page }) => {
	await installFakeSpeech(page);
	await startSprint(page, '/play?mode=words&level=normal&variant=quran');
	const score = page.getByTestId('sprint-score');
	const mic = page.getByTestId('mic');
	await expect(mic).toContainText('Listening');

	const first = await promptText(page);
	await say(page, first);
	await expect(score).toHaveText('Score 1');
	await expect(page.getByTestId('prompt')).not.toHaveText(first);

	const second = await promptText(page);
	await say(page, 'hello');
	await expect(mic).toContainText('hello');
	await expect(score).toHaveText('Score 1');

	await page.getByRole('button', { name: 'Skip' }).click();
	await expect(page.getByTestId('prompt')).not.toHaveText(second);
	await expect(score).toHaveText('Score 1');

	await page.clock.fastForward(60_000);
	await expect(page.getByRole('heading', { name: "Time's up!" })).toBeVisible();
	await expect(page.getByText('New personal best')).toBeVisible();
	// Pins the heading a ranked run shows, so the unranked test's hidden assertion means something.
	await expect(page.getByRole('heading', { name: 'Top 3' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Review what you missed' })).toBeVisible();
	expect((await speechState(page)).active).toBe(false);
	expect(await savedRuns(page)).toBe(1);
});

test('scores a sentence at one point per word', async ({ page }) => {
	await installFakeSpeech(page);
	await startSprint(page, '/play?mode=sentences&level=relaxed&variant=quran');
	const sentence = await promptText(page);
	await say(page, sentence);
	await expect(page.getByTestId('sprint-score')).toHaveText(`Score ${wordCount(sentence)}`);
});

test('turns the sprint into unranked practice when speech fails', async ({ page }) => {
	await installFakeSpeech(page);
	await startSprint(page, '/play?mode=words&level=normal&variant=msa');
	const score = page.getByTestId('sprint-score');

	await failSpeech(page, 'network');
	await expect(page.getByText(FALLBACK)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Skip' })).toBeHidden();
	await page.getByRole('button', { name: 'Got it' }).click();
	await expect(score).toHaveText('Score 1');
	await page.getByRole('button', { name: 'Missed' }).click();
	await expect(score).toHaveText('Score 1');

	await page.clock.fastForward(60_000);
	await expect(page.getByText('Practice - not ranked')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Top 3' })).toBeHidden();
	expect(await savedRuns(page)).toBe(0);
});

test('practice links use Got it and Missed and never start the microphone', async ({ page }) => {
	await installFakeSpeech(page);
	await startSprint(page, '/play?mode=words&level=fast&variant=quran&practice=1');
	await expect(page.getByTestId('mic')).toBeHidden();
	await expect(page.getByText(FALLBACK)).toBeHidden();
	await page.getByRole('button', { name: 'Got it' }).click();
	await expect(page.getByTestId('sprint-score')).toHaveText('Score 1');
	expect((await speechState(page)).starts).toBe(0);

	await page.clock.fastForward(60_000);
	await expect(page.getByText('Practice - not ranked')).toBeVisible();
	expect(await savedRuns(page)).toBe(0);
});

test('stops listening while paused and listens again after Continue', async ({ page }) => {
	await installFakeSpeech(page);
	await startSprint(page, '/play?mode=words&level=normal&variant=quran');
	expect((await speechState(page)).active).toBe(true);

	await setHidden(page, true);
	await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
	expect((await speechState(page)).active).toBe(false);

	await setHidden(page, false);
	await page.getByRole('button', { name: 'Continue' }).click();
	await expect(page.getByTestId('mic')).toContainText('Listening');
	expect((await speechState(page)).active).toBe(true);
	await say(page, await promptText(page));
	await expect(page.getByTestId('sprint-score')).toHaveText('Score 1');
});

test('falls back to practice when the browser has no speech recognition', async ({ page }) => {
	await installFakeSpeech(page, { unsupported: true });
	await startSprint(page, '/play?mode=words&level=normal&variant=quran');
	await expect(page.getByText(FALLBACK)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Got it' })).toBeVisible();
});
