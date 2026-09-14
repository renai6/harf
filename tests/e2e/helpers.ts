import { expect, type Page } from '@playwright/test';
import { LETTERS } from '../../src/lib/content/letters';

/** Creates a player from the pick player screen and waits for the setup screen. */
export async function createPlayer(page: Page, name: string) {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Harf Sprint' })).toBeVisible();
	const add = page.getByRole('button', { name: 'New player' });
	if (await add.isVisible()) await add.click();
	await page.getByLabel('Your name').fill(name);
	await page.getByRole('button', { name: "Let's go" }).click();
	await expect(page).toHaveURL('/modes');
}

export function answerButtons(page: Page) {
	return page.getByRole('group', { name: 'Answers' }).getByRole('button');
}

/** Answers the current letter with the keyboard, correctly or with a wrong choice. */
export async function answer(page: Page, correct: boolean) {
	const prompt = page.getByTestId('prompt');
	const shown = (await prompt.textContent()) ?? '';
	const letter = LETTERS.find((l) => l.char === shown.replace(/‍/g, ''));
	if (!letter) throw new Error(`Unknown prompt: ${shown}`);
	const labels = await answerButtons(page).allTextContents();
	const index = labels.findIndex((label) => label.includes(letter.arabicName) === correct);
	await page.keyboard.press(String(index + 1));
	if (correct) await expect(prompt).not.toHaveText(shown);
}

/** Simulates the tab being hidden or shown again. */
export async function setHidden(page: Page, hidden: boolean) {
	await page.evaluate((value) => {
		Object.defineProperty(document, 'hidden', { configurable: true, get: () => value });
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => (value ? 'hidden' : 'visible')
		});
		document.dispatchEvent(new Event('visibilitychange'));
	}, hidden);
}
