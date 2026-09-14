import { expect, type Page } from '@playwright/test';

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
