import { test, expect } from '@playwright/test';
import { resetRateLimits } from './helpers/db';

/**
 * P4L-T05: the session cookie is HttpOnly so scripts cannot read its token.
 * The rendered HTML and `__data.json` must not hand that token back.
 */
test.describe('The session token stays out of page data (P4L-T05)', () => {
	test.beforeAll(async () => {
		await resetRateLimits();
	});

	test('a signed-in Artist gets no token in HTML or __data.json', async ({ page, context }) => {
		await page.goto('/login');
		await page.locator('#email').fill('demo@neonvelvet.band');
		await page.locator('#password').fill('neonvelvet123');
		await page.locator('button.btn-band-submit').click();
		await expect(page).toHaveURL(/\/dashboard/);

		const cookie = (await context.cookies()).find((c) => c.name.endsWith('session_token'));
		expect(cookie, 'session cookie').toBeDefined();
		const token = decodeURIComponent(cookie!.value).split('.')[0]!;
		expect(token.length).toBeGreaterThan(10);

		for (const path of ['/a/the-neon-velvet', '/i/neon-velvet-philly-2026-10-15', '/dashboard', '/dashboard/settings']) {
			for (const url of [path, `${path}/__data.json`]) {
				const res = await page.request.get(url);
				expect(res.status(), url).toBe(200);
				const body = await res.text();
				expect(body.includes(token), `${url} contains the session token`).toBe(false);
				expect(body, url).not.toMatch(/ipAddress|userAgent/);
			}
		}
	});
});
