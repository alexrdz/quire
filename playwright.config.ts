import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Three local servers on the same production build (`pnpm build` first):
 *
 * - 4173, test mode: the main suite (tests/e2e, minus demo/ and production/).
 * - 4174, Demo mode: tests/e2e/demo.
 * - 4175, production mode: tests/e2e/production.
 *
 * The Demo and production modes need a remote database and real secrets (ADR
 * 0007). Their servers set QUIRE_E2E_LOCAL_PREVIEW=true, which config.ts honors
 * only with a file: DATABASE_URL and no Netlify variables, so they run on their
 * own file database with fixed test secrets. Each database is deleted and rebuilt
 * by the drizzle migrations on every start; the Demo then seeds itself on its
 * first request. No Docker and no network. Details: docs/e2e-local-preview.md.
 *
 * PLAYWRIGHT_BASE_URL (test mode) and DEMO_BASE_URL point a project at an
 * existing server instead, and its local server is not started.
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL;
const demoBaseURL = process.env.DEMO_BASE_URL;

const PORTS = { test: 4173, demo: 4174, production: 4175 } as const;
const PREVIEW_DB_DIR = path.join(os.tmpdir(), 'quire-e2e');

/** A Demo- or production-mode server with the local preview flag and its own fresh file database. */
function previewServer(name: 'demo' | 'production', modeEnv: Record<string, string>) {
	const port = PORTS[name];
	const file = path.join(PREVIEW_DB_DIR, `${name}.db`);
	const quoted = JSON.stringify(file);
	return {
		command: [
			`mkdir -p ${JSON.stringify(PREVIEW_DB_DIR)}`,
			`rm -f ${quoted} ${JSON.stringify(`${file}-wal`)} ${JSON.stringify(`${file}-shm`)}`,
			'pnpm db:migrate',
			`pnpm preview --port ${port} --strictPort`
		].join(' && '),
		port,
		reuseExistingServer: !process.env.CI,
		env: {
			...modeEnv,
			QUIRE_E2E_LOCAL_PREVIEW: 'true',
			DATABASE_URL: `file:${file}`,
			BETTER_AUTH_URL: `http://localhost:${port}`
		}
	};
}

const webServers = [
	...(baseURL
		? []
		: [
				{
					// The server's database is built by the drizzle migrations first (PRODUCTION_PLAN 3.5).
					command: 'pnpm db:migrate && pnpm preview',
					port: PORTS.test,
					reuseExistingServer: !process.env.CI,
					// The built server runs in production mode by default (ADR 0007). The main suite
					// exercises the local stand-ins, so it runs the production build in test mode.
					// R2_PUBLIC_URL only feeds the CSP's media origin (security-headers spec);
					// without the R2 keys, uploads stay on local storage.
					env: { NODE_ENV: 'test', R2_PUBLIC_URL: 'https://media.e2e.quire.test' }
				}
			]),
	...(demoBaseURL ? [] : [previewServer('demo', { DEMO_MODE: 'true' })]),
	previewServer('production', { NODE_ENV: 'production' })
];

export default defineConfig({
	webServer: webServers,
	testDir: 'tests/e2e',
	testMatch: /(.+\.)?(test|spec)\.[jt]s/,
	use: {
		channel: process.env.PLAYWRIGHT_CHANNEL,
		trace: 'on-first-retry'
	},
	projects: [
		{
			name: 'chromium',
			testIgnore: [/[\\/]demo[\\/]/, /[\\/]production[\\/]/],
			use: { ...devices['Desktop Chrome'], baseURL: baseURL ?? `http://localhost:${PORTS.test}` }
		},
		{
			name: 'demo-mode',
			testDir: 'tests/e2e/demo',
			use: { ...devices['Desktop Chrome'], baseURL: demoBaseURL ?? `http://localhost:${PORTS.demo}` }
		},
		{
			name: 'production-mode',
			testDir: 'tests/e2e/production',
			use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${PORTS.production}` }
		}
	]
});
