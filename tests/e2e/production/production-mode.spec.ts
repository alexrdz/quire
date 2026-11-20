import { test, expect } from '@playwright/test';

/**
 * The local production-mode server (playwright.config.ts, P4L-T03): the real
 * production rules on a fresh file database built by the migrations, through the
 * guarded QUIRE_E2E_LOCAL_PREVIEW flag. Phase 5's production-mode suite (503 on a
 * missing core key, feature messages, open redirects, uploads, the Venmo link)
 * builds on this project. These checks show the server really is production.
 */

test('reports production mode, healthy, on the local preview', async ({ request }) => {
	const response = await request.get('/healthz');
	expect(response.status()).toBe(200);
	const body = await response.json();
	expect(body).toMatchObject({ ok: true, mode: 'production', core: 'ok', db: 'ok' });
	expect(body.features).toMatchObject({ mode: 'production', tipsOpenVenmo: true });
	// No keys are set, so production switches these features off instead of using stand-ins.
	expect(body.features).toMatchObject({ email: false, fanSignIn: false, uploads: false, payments: false });
});

test('/demo is 404 and nothing is seeded', async ({ page, request }) => {
	expect((await request.get('/demo', { maxRedirects: 0 })).status()).toBe(404);
	// Production never auto-seeds, so the sample Artist does not exist.
	expect((await request.get('/a/the-neon-velvet')).status()).toBe(404);
	await page.goto('/');
	await expect(page.locator('body')).toBeVisible();
	await expect(page.locator('[data-testid="demo-banner"]')).toHaveCount(0);
});

test('pages carry the production security headers', async ({ request }) => {
	const response = await request.get('/login');
	expect(response.status()).toBe(200);
	expect(response.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
	expect(response.headers()['x-content-type-options']).toBe('nosniff');
});
