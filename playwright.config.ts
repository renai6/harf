import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '**/*.e2e.ts',
	// Some sprint tests fast-forward two full 60s sprints via page.clock; each virtual frame
	// still runs a real rAF callback, so the default 30s budget is too tight on slower machines.
	timeout: 60_000,
	webServer: { command: 'pnpm build && pnpm preview', port: 4173 },
	use: { baseURL: 'http://localhost:4173' },
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
