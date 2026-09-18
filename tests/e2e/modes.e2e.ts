import { expect, test } from '@playwright/test';
import { createPlayer, seedPlayer } from './helpers';

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

test('reopens on the last sprint that was started', async ({ page }) => {
	await createPlayer(page, 'Sara');
	await page.getByRole('button', { name: 'Fast' }).click();
	await page.getByRole('button', { name: 'All forms' }).click();
	await page.getByRole('button', { name: 'Start' }).click();
	await expect(page).toHaveURL('/play?mode=letters&level=fast&variant=forms');

	await page.getByRole('link', { name: 'Quit' }).click();
	await expect(page).toHaveURL('/modes');
	await expect(page.getByRole('button', { name: 'Fast' })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByRole('button', { name: 'All forms' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	await page.reload();
	await expect(page.getByRole('button', { name: 'Fast' })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByText('1.5 seconds per letter')).toBeVisible();
});

test('opens on a remembered speech sprint, keeping the other variant on its default', async ({
	page
}) => {
	await seedPlayer(page, 'Sara', 'sentences:relaxed:msa');
	await page.goto('/modes');

	await expect(page.getByRole('button', { name: /Sentences/ })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page.getByRole('button', { name: 'Relaxed' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page.getByRole('button', { name: 'Modern Standard' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	// Letters keeps its own default, because only the sentences variant was remembered.
	await page.getByRole('button', { name: /Letters/ }).click();
	await expect(page.getByRole('button', { name: 'Isolated' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});
