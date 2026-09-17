import { expect, test, type Page } from '@playwright/test';
import { answer, answerButtons, createPlayer, pauseClock } from './helpers';

const VIEWPORTS = [
	{ name: 'phone', width: 390, height: 844 },
	{ name: 'desktop', width: 1280, height: 800 }
];

/** Fails on horizontal scrolling or small tap targets, then saves a full-page screenshot. */
async function capture(page: Page, viewport: string, screen: string) {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth
	);
	expect(overflow, `${screen} scrolls horizontally`).toBeLessThanOrEqual(0);

	const smallTargets = await page.evaluate(() =>
		[...document.querySelectorAll('button, a[href], input')]
			.filter((el) => {
				const box = el.getBoundingClientRect();
				return box.width > 0 && box.height < 48;
			})
			.map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName)
	);
	expect(smallTargets, `${screen} has tap targets under 48px`).toEqual([]);

	// Finishes CSS transitions so a capture never shows a color change halfway through.
	await page.screenshot({
		path: `test-results/screens/${viewport}-${screen}.png`,
		fullPage: true,
		animations: 'disabled'
	});
}

for (const viewport of VIEWPORTS) {
	test.describe(viewport.name, () => {
		test.use({ viewport: { width: viewport.width, height: viewport.height } });

		test.beforeEach(async ({ page }) => {
			await page.emulateMedia({ reducedMotion: 'reduce' });
			// A paused clock keeps timed states such as the wrong-answer reveal on screen while capturing.
			await pauseClock(page);
		});

		test('every screen fits and is captured', async ({ page }) => {
			await page.goto('/');
			await expect(page.getByLabel('Your name')).toBeVisible();
			await capture(page, viewport.name, '1-first-visit');

			await createPlayer(page, 'Sara');
			await createPlayer(page, 'يوسف');
			await page.goto('/');
			await expect(page.getByRole('button', { name: /Sara/ })).toBeVisible();
			await capture(page, viewport.name, '2-pick-player');

			await page.getByRole('button', { name: /Sara/ }).click();
			await expect(page).toHaveURL('/modes');
			await capture(page, viewport.name, '3-modes');

			await page.getByRole('button', { name: 'Relaxed' }).click();
			await page.getByRole('button', { name: 'All forms' }).click();
			await page.getByRole('button', { name: 'Start' }).click();
			await expect(page.getByText('3', { exact: true })).toBeVisible();
			await capture(page, viewport.name, '4-countdown');

			// With the clock paused, frame-stepping runFor would stop a few milliseconds short of the countdown end.
			await page.clock.fastForward(3_000);
			await expect(answerButtons(page)).toHaveCount(4);
			await answer(page, true);
			await capture(page, viewport.name, '5-sprint');

			// Lets the correct-answer flash end so it does not mix with the wrong-answer colors.
			await page.clock.runFor(250);
			await answer(page, false);
			await expect(answerButtons(page).first()).toBeDisabled();
			await capture(page, viewport.name, '6-wrong-answer');

			await page.clock.fastForward(61_000);
			await expect(page.getByRole('heading', { name: "Time's up!" })).toBeVisible();
			await capture(page, viewport.name, '7-results');

			await page.goto('/leaderboard');
			await page.getByRole('button', { name: 'Relaxed' }).click();
			await page.getByRole('button', { name: 'All forms' }).click();
			await expect(page.getByRole('list', { name: 'Leaderboard' })).toContainText('Sara');
			await capture(page, viewport.name, '8-leaderboard');

			await page.goto('/settings');
			await expect(page.getByRole('switch', { name: 'Sound effects' })).toBeVisible();
			await capture(page, viewport.name, '9-settings');
		});

		test('keyboard focus shows a purple ring on the setup screen', async ({ page }) => {
			await createPlayer(page, 'Sara');
			// A full load starts keyboard focus at the top; after a client-side navigation SvelteKit resets focus later.
			await page.goto('/modes');
			const targets = [
				page.getByRole('link', { name: 'Switch player' }),
				page.getByRole('button', { name: /Letters/ }),
				page.getByRole('button', { name: /Words/ }),
				page.getByRole('button', { name: /Sentences/ }),
				page.getByRole('button', { name: 'Relaxed' }),
				page.getByRole('button', { name: 'Normal' }),
				page.getByRole('button', { name: 'Fast' }),
				page.getByRole('button', { name: 'Isolated' }),
				page.getByRole('button', { name: 'All forms' }),
				page.getByRole('button', { name: 'Start' })
			];
			await expect(targets[targets.length - 1]).toBeVisible();
			for (const [index, target] of targets.entries()) {
				await page.keyboard.press('Tab');
				await expect(target).toBeFocused();
				await expect(target).toHaveCSS('outline', 'rgb(123, 63, 178) solid 3px');
				await page.screenshot({
					path: `test-results/screens/${viewport.name}-focus-${index + 1}.png`,
					fullPage: true
				});
			}
		});
	});
}
