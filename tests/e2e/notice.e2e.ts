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
