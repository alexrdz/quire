import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: ['fluid-tokens.spec.ts', 'fluid-landing.spec.ts'],
	use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHANNEL },
	projects: [{ name: 'chromium' }]
});
