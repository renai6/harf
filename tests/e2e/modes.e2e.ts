import { expect, test } from '@playwright/test';
import { createPlayer } from './helpers';

test('redirects to the pick player screen without a current player', async ({ page }) => {
	await page.goto('/modes');
	await expect(page).toHaveURL('/');
});

test('sets up a letters sprint', async ({ page }) => {
	await createPlayer(page, 'Sara');
	await expect(page.getByRole('heading', { name: 'Pick a sprint' })).toBeVisible();
	await expect(page.getByText('Playing as')).toBeVisible();
	await expect(page.getByRole('button', { name: /Words/ })).toBeEnabled();
	await expect(page.getByRole('button', { name: /Sentences/ })).toBeEnabled();
	await expect(page.getByText('3 seconds per letter')).toBeVisible();

	await page.getByRole('button', { name: 'Fast' }).click();
	await expect(page.getByText('1.5 seconds per letter')).toBeVisible();
	await page.getByRole('button', { name: 'All forms' }).click();
	await expect(page.getByRole('button', { name: 'All forms' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	await page.getByRole('button', { name: 'Start' }).click();
	await expect(page).toHaveURL('/play?mode=letters&level=fast&variant=forms');
});
