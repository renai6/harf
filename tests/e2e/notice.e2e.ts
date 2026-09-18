import { expect, test } from '@playwright/test';

test('corrupt saved data shows a dismissible notice and keeps a backup', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('harf-sprint:v1', '{broken'));
	await page.goto('/');

	const notice = page.getByRole('status').filter({ hasText: 'could not be read' });
	await expect(notice).toBeVisible();
	await notice.getByRole('button', { name: 'Dismiss' }).click();
	await expect(notice).toBeHidden();

	const hasBackup = await page.evaluate(() =>
		Object.keys(localStorage).some((key) => key.startsWith('harf-sprint:corrupt:'))
	);
	expect(hasBackup).toBe(true);
});

test('data from a newer version is kept, not overwritten', async ({ page }) => {
	const future = JSON.stringify({ version: 99, players: [{ id: 'p9', name: 'Future' }] });
	await page.addInitScript((raw) => localStorage.setItem('harf-sprint:v1', raw), future);
	await page.goto('/');

	await expect(page.getByRole('status').filter({ hasText: 'newer version' })).toBeVisible();
	await page.getByLabel('Your name').fill('Sara');
	await page.getByRole('button', { name: "Let's go" }).click();
	await expect(page.getByText('Could not save. Please try again.')).toBeVisible();
	expect(await page.evaluate(() => localStorage.getItem('harf-sprint:v1'))).toBe(future);
});
