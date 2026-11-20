import { test, expect, request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import { CORE_MISSING_URL } from '../helpers/production-db';

/**
 * PRODUCTION_PLAN Phase 5: a missing core key returns 503 (ADR 0007, tier 1).
 *
 * playwright.config.ts starts a production-mode server on CORE_MISSING_URL with
 * the local-preview flag and a file database but no BETTER_AUTH_URL, so core
 * config is invalid. Every request except /healthz must get the static 503
 * page, with the security headers and without naming or leaking any secret.
 */

/** Names and values that must never reach a response body. */
const SECRET_STRINGS = [
	'BETTER_AUTH_URL',
	'BETTER_AUTH_SECRET',
	'COOKIE_SECRET',
	'DATABASE_URL',
	'DATABASE_AUTH_TOKEN',
	'PUBLIC_APP_URL',
	'QUIRE_E2E_LOCAL_PREVIEW',
	'quire_e2e_local_preview',
	'core-missing.db',
	'STRIPE_',
	'RESEND_',
	'R2_'
];

let api: APIRequestContext;

test.beforeAll(async () => {
	api = await playwrightRequest.newContext({ baseURL: CORE_MISSING_URL });
});

test.afterAll(async () => {
	await api.dispose();
});

function expectSecurityHeaders(headers: Record<string, string>, label: string) {
	expect(headers['content-security-policy'], label).toContain("default-src 'self'");
	// Issues may be framed by Quire itself (the dashboard's live preview); nothing else may be.
	const ancestors = label.startsWith('/i/') ? "frame-ancestors 'self'" : "frame-ancestors 'none'";
	expect(headers['content-security-policy'], label).toContain(ancestors);
	expect(headers['x-content-type-options'], label).toBe('nosniff');
	expect(headers['referrer-policy'], label).toBe('strict-origin-when-cross-origin');
}

function expectNoSecrets(body: string, label: string) {
	for (const secret of SECRET_STRINGS) expect(body, `${label} mentions ${secret}`).not.toContain(secret);
}

test.describe('Production with a missing core key (503 everywhere)', () => {
	for (const [method, path] of [
		['GET', '/'],
		['GET', '/a/x'],
		['GET', '/i/x'],
		['GET', '/login'],
		['GET', '/dashboard'],
		['GET', '/api/auth/session'],
		['GET', '/api/auth/get-session'],
		['POST', '/api/auth/sign-in/email'],
		['POST', '/api/tip-tap'],
		['POST', '/logout']
	] as const) {
		test(`${method} ${path} returns the 503 unavailable page`, async () => {
			const response = await api.fetch(path, {
				method,
				maxRedirects: 0,
				headers: { origin: CORE_MISSING_URL },
				...(method === 'POST' ? { data: {} } : {})
			});
			expect(response.status()).toBe(503);
			const headers = response.headers();
			expect(headers['content-type']).toContain('text/html');
			expect(headers['retry-after']).toBe('300');
			expect(headers['cache-control']).toBe('no-store');
			expectSecurityHeaders(headers, path);

			const body = await response.text();
			expect(body).toContain('Quire is temporarily unavailable');
			expectNoSecrets(body, path);
			// The static page: no app shell, no scripts.
			expect(body).not.toContain('<script');
			expect(body).not.toContain('__sveltekit');
		});
	}

	test('/healthz reports core invalid with 503, and nothing secret', async () => {
		const response = await api.get('/healthz');
		expect(response.status()).toBe(503);
		expectSecurityHeaders(response.headers(), '/healthz');
		const text = await response.text();
		expect(JSON.parse(text)).toMatchObject({ ok: false, mode: 'production', core: 'invalid', db: 'down' });
		expectNoSecrets(text, '/healthz');
	});

	test('the page renders in a browser with no app requests', async ({ browser }) => {
		const context = await browser.newContext({ baseURL: CORE_MISSING_URL });
		const page = await context.newPage();
		const requests: string[] = [];
		page.on('request', (req) => requests.push(new URL(req.url()).pathname));
		const response = await page.goto('/a/x');
		expect(response?.status()).toBe(503);
		await expect(page.getByRole('heading', { name: 'Quire is temporarily unavailable' })).toBeVisible();
		expect(requests).toEqual(['/a/x']);
		await context.close();
	});
});
