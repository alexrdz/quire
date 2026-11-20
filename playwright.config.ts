import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
	webServer: baseURL ? undefined : {
		// The server's database is built by the drizzle migrations first (PRODUCTION_PLAN 3.5).
		command: 'pnpm db:migrate && pnpm preview',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		// The built server runs in production mode by default (ADR 0007). The e2e suite
		// exercises the local stand-ins, so it runs the production build in test mode.
		// R2_PUBLIC_URL only feeds the CSP's media origin (security-headers spec);
		// without the R2 keys, uploads stay on local storage.
		env: { NODE_ENV: 'test', R2_PUBLIC_URL: 'https://media.e2e.quire.test' }
	},
	testDir: 'tests/e2e',
	testMatch: /(.+\.)?(test|spec)\.[jt]s/,
	use: {
		baseURL: baseURL ?? 'http://localhost:4173',
		channel: process.env.PLAYWRIGHT_CHANNEL,
		trace: 'on-first-retry'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	]
});
