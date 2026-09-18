import { expect, test } from '@playwright/test';
import { createPlayer } from './helpers';

test('creates a player and remembers them after a reload', async ({ page }) => {
	await createPlayer(page, '  Sara  ');
	await page.goto('/');
	await page.reload();
	await expect(page).toHaveTitle('Harf Sprint');
	const card = page.getByRole('button', { name: /Sara/ });
	await expect(card).toContainText('No scores yet');
	await card.click();
	await expect(page).toHaveURL('/modes');
});

test('rejects a duplicate name ignoring case, and an empty name', async ({ page }) => {
	await createPlayer(page, 'Sara');
	await page.goto('/');
	await page.getByRole('button', { name: 'New player' }).click();
	const input = page.getByLabel('Your name');

	await input.fill('  sara ');
	await page.getByRole('button', { name: "Let's go" }).click();
	await expect(page.getByText('That name is already taken.')).toBeVisible();
	await expect(input).toHaveAttribute('aria-invalid', 'true');

	await input.fill('   ');
	await page.getByRole('button', { name: "Let's go" }).click();
	await expect(page.getByText('Enter a name.')).toBeVisible();
	await expect(page).toHaveURL('/');
});

test('cancelling the new player form gives focus back to the button', async ({ page }) => {
	await createPlayer(page, 'Sara');
	await page.goto('/');
	await page.getByRole('button', { name: 'New player' }).click();
	await page.getByRole('button', { name: 'Cancel' }).click();
	await expect(page.getByRole('button', { name: 'New player' })).toBeFocused();
});
