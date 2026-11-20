import { test, expect } from '@playwright/test';
import { postAction, signInWithPassword } from '../helpers/actions';
import { createProductionArtist, resetProductionRateLimits, type ProductionArtist } from '../helpers/production-db';
import { OPEN_REDIRECT_PAYLOADS, expectSameOrigin } from '../helpers/redirects';

/**
 * PRODUCTION_PLAN Phase 5: GET /logout is 405 and open-redirect payloads are
 * rejected, on the production-mode server.
 *
 * Every place a visitor can choose where they go next is tried with every
 * payload: /login?redirect= (page and action), /logout?redirect= and its
 * redirectTo field, /demo?redirect= (404 here), and Better Auth's callbackURL.
 * Each must land on a same-origin fallback or be refused outright.
 */

let artist: ProductionArtist;

test.beforeAll(async () => {
	await resetProductionRateLimits();
	artist = await createProductionArtist({ displayName: 'Redirect Check Band', venmoUsername: null });
});

test.describe('Sign out', () => {
	test('GET /logout is 405 and signs no one out', async ({ page }) => {
		await signInWithPassword(page, artist.email, artist.password);
		const response = await page.request.get('/logout?redirect=//evil.com', { maxRedirects: 0 });
		expect(response.status()).toBe(405);
		expect(response.headers()['location']).toBeUndefined();
		await page.goto('/dashboard');
		await expect(page).toHaveURL(/\/dashboard/);
	});

	test('POST /logout from the dashboard button signs out', async ({ page }) => {
		await signInWithPassword(page, artist.email, artist.password);
		await page.getByRole('button', { name: 'Sign Out' }).click();
		await expect(page).toHaveURL(/\/$/);
		expect((await page.context().cookies()).some((c) => c.name.includes('session_token') && c.value)).toBe(false);
		await page.goto('/dashboard');
		await expect(page).toHaveURL(/\/login\?redirect=\/dashboard$/);
	});
});

test.describe('Open-redirect payloads', () => {
	test('signing in from /login?redirect=<payload> lands on /dashboard', async ({ page, context, baseURL }) => {
		for (const payload of OPEN_REDIRECT_PAYLOADS) {
			await context.clearCookies();
			await page.goto(`/login?redirect=${encodeURIComponent(payload)}`);
			// An unsafe redirect is dropped: the form carries no redirect at all.
			await expect(page.locator('input[type="hidden"][name="redirectTo"]'), payload).toHaveCount(0);
			await page.locator('#email').fill(artist.email);
			await page.locator('#password').fill(artist.password);
			await page.locator('button.btn-band-submit').click();
			await expect(page, payload).toHaveURL(`${baseURL}/dashboard`);
			await resetProductionRateLimits();
		}
	});

	test('/login?redirect= sends a signed-in Artist to /dashboard, not the payload', async ({ page, baseURL }) => {
		await signInWithPassword(page, artist.email, artist.password);
		for (const payload of OPEN_REDIRECT_PAYLOADS) {
			const response = await page.request.get(`/login?redirect=${encodeURIComponent(payload)}`, { maxRedirects: 0 });
			expect(response.status(), payload).toBe(303);
			const target = expectSameOrigin(response.headers()['location'], baseURL!, payload);
			expect(target.pathname, payload).toBe('/dashboard');
		}
	});

	test('the login action refuses a payload redirect or falls back on this origin', async ({ playwright, baseURL }) => {
		for (const payload of OPEN_REDIRECT_PAYLOADS) {
			// A fresh, signed-out client for each try, so every sign-in really runs.
			const request = await playwright.request.newContext({ baseURL });
			for (const [path, fields] of [
				['/login?/login', { email: artist.email, password: artist.password, redirectTo: payload }],
				[`/login?/login&redirect=${encodeURIComponent(payload)}`, { email: artist.email, password: artist.password }]
			] as const) {
				const result = await postAction(request, baseURL!, path, fields);
				const label = `${path} ${payload}`;
				expect(result.httpStatus, label).toBeLessThan(500);
				if (result.type === 'redirect') {
					expect(expectSameOrigin(result.location, baseURL!, label).pathname).toBe('/dashboard');
				} else {
					expect(result, label).toMatchObject({ type: 'failure', status: 400 });
				}
			}
			await request.dispose();
			await resetProductionRateLimits();
		}
	});

	test('POST /logout falls back to / for a payload in the query or the form', async ({ request, baseURL }) => {
		for (const payload of OPEN_REDIRECT_PAYLOADS) {
			const viaQuery = await request.post(`/logout?redirect=${encodeURIComponent(payload)}`, {
				headers: { origin: baseURL! },
				maxRedirects: 0
			});
			expect(viaQuery.status(), payload).toBe(303);
			expect(expectSameOrigin(viaQuery.headers()['location'], baseURL!, payload).pathname).toBe('/');

			const viaForm = await request.post('/logout', {
				headers: { origin: baseURL! },
				form: { redirectTo: payload },
				maxRedirects: 0
			});
			expect(viaForm.status(), payload).toBe(303);
			expect(expectSameOrigin(viaForm.headers()['location'], baseURL!, payload).pathname).toBe('/');
		}
	});

	test('/demo?redirect= is 404 in production, payload or not', async ({ request }) => {
		for (const payload of OPEN_REDIRECT_PAYLOADS) {
			const response = await request.get(`/demo?redirect=${encodeURIComponent(payload)}`, { maxRedirects: 0 });
			expect(response.status(), payload).toBe(404);
			expect(response.headers()['location'], payload).toBeUndefined();
		}
	});

	test('Better Auth never redirects off-site for a payload callbackURL', async ({ request, baseURL }) => {
		for (const payload of OPEN_REDIRECT_PAYLOADS) {
			// sign-in/* is rate limited per address, and every e2e request shares one.
			await resetProductionRateLimits();
			const social = await request.post('/api/auth/sign-in/social', {
				headers: { origin: baseURL! },
				data: { provider: 'google', callbackURL: payload },
				maxRedirects: 0
			});
			// 403 INVALID_CALLBACK_URL, or (for a payload that is really a same-origin
			// path, like the double-encoded /%255Cevil.com) accepted and then 404 for
			// the missing Google provider.
			expect([403, 404], `sign-in/social ${payload}`).toContain(social.status());

			const verify = await request.get(
				`/api/auth/verify-email?token=bogus&callbackURL=${encodeURIComponent(payload)}`,
				{ maxRedirects: 0 }
			);
			if (verify.status() === 403) {
				expect(verify.headers()['location'], payload).toBeUndefined();
			} else {
				expect(verify.status(), `verify-email ${payload}`).toBe(302);
				expectSameOrigin(verify.headers()['location'], baseURL!, `verify-email ${payload}`);
			}
		}
		// The control: a same-origin callbackURL passes the check and stays here.
		const safe = await request.get('/api/auth/verify-email?token=bogus&callbackURL=%2Fme%2Fstubs', { maxRedirects: 0 });
		expect(safe.status()).toBe(302);
		expect(expectSameOrigin(safe.headers()['location'], baseURL!, 'safe callbackURL').pathname).toBe('/me/stubs');
	});
});
