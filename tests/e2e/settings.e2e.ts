import { expect, test } from '@playwright/test';
import { createPlayer } from './helpers';

test('toggles sound, renames and deletes players, and resets all data', async ({ page }) => {
	await createPlayer(page, 'Sara');
	await createPlayer(page, 'Yusuf');
	await page.goto('/settings');

	const sound = page.getByRole('switch', { name: 'Sound effects' });
	await expect(sound).toHaveAttribute('aria-checked', 'true');
	await sound.click();
	await page.reload();
	await expect(sound).toHaveAttribute('aria-checked', 'false');

	await page.getByRole('button', { name: 'Rename Sara' }).click();
	const input = page.getByLabel('Rename Sara');
	await input.fill('yusuf');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('That name is already taken.')).toBeVisible();
	await input.fill('Sara Ali');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('button', { name: 'Rename Sara Ali' })).toBeVisible();

	await page.getByRole('button', { name: 'Delete Yusuf' }).click();
	await page.getByRole('button', { name: 'Cancel' }).click();
	await page.getByRole('button', { name: 'Delete Yusuf' }).click();
	await page
		.getByRole('group', { name: 'Confirm' })
		.getByRole('button', { name: 'Delete' })
		.click();
	await expect(page.getByText('Yusuf')).toBeHidden();

	await page.getByRole('button', { name: 'Reset all data' }).click();
	await page.getByRole('button', { name: 'Reset', exact: true }).click();
	await expect(page).toHaveURL('/');
	await expect(page.getByLabel('Your name')).toBeVisible();
});

test('a player deleted in another tab is sent back to the pick player screen', async ({
	page,
	context
}) => {
	await createPlayer(page, 'Sara');
	const other = await context.newPage();
	await other.goto('/settings');
	await other.getByRole('button', { name: 'Delete Sara' }).click();
	await other
		.getByRole('group', { name: 'Confirm' })
		.getByRole('button', { name: 'Delete' })
		.click();
	await expect(page).toHaveURL('/');
});

test('keyboard focus returns to the list after every panel closes', async ({ page }) => {
	await createPlayer(page, 'Sara');
	await createPlayer(page, 'Yusuf');
	await page.goto('/settings');
	const confirm = page.getByRole('group', { name: 'Confirm' });

	await page.getByRole('button', { name: 'Rename Sara' }).click();
	await page.getByRole('button', { name: 'Cancel' }).click();
	await expect(page.getByRole('button', { name: 'Rename Sara' })).toBeFocused();

	await page.getByRole('button', { name: 'Rename Sara' }).click();
	await page.getByLabel('Rename Sara').fill('Sara Ali');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('button', { name: 'Rename Sara Ali' })).toBeFocused();

	await page.getByRole('button', { name: 'Delete Yusuf' }).click();
	await confirm.getByRole('button', { name: 'Cancel' }).click();
	await expect(page.getByRole('button', { name: 'Delete Yusuf' })).toBeFocused();

	// Yusuf's buttons go with him, so focus lands on the heading above the list.
	await page.getByRole('button', { name: 'Delete Yusuf' }).click();
	await confirm.getByRole('button', { name: 'Delete' }).click();
	await expect(page.getByRole('heading', { name: 'Players' })).toBeFocused();

	await page.getByRole('button', { name: 'Reset all data' }).click();
	await confirm.getByRole('button', { name: 'Cancel' }).click();
	await expect(page.getByRole('button', { name: 'Reset all data' })).toBeFocused();
});
