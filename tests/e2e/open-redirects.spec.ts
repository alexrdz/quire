import { test, expect } from '@playwright/test';
import { postAction } from './helpers/actions';
import { OPEN_REDIRECT_PAYLOADS, expectSameOrigin } from './helpers/redirects';

/**
 * Open-redirect payloads on the redirect params that only work outside
 * production (PRODUCTION_PLAN 2.1 and Phase 5): the sample-login /demo route
 * and the stand-in Fan sign-in. In production /demo is 404 and Fan sign-in is
 * off without Google keys (tests/e2e/production/logout-and-redirects.spec.ts);
 * the Demo site serves both, so they are checked here on the same code.
 */

const ISSUE_SLUG = 'neon-velvet-philly-2026-10-15';

test('/demo?redirect= falls back to the dashboard or the Fan stubs', async ({ playwright, baseURL }) => {
	for (const payload of OPEN_REDIRECT_PAYLOADS) {
		for (const [role, fallback] of [
			['artist', '/dashboard'],
			['fan', '/me/stubs']
		] as const) {
			const request = await playwright.request.newContext({ baseURL });
			const response = await request.get(`/demo?role=${role}&redirect=${encodeURIComponent(payload)}`, { maxRedirects: 0 });
			const label = `/demo ${role} ${payload}`;
			expect(response.status(), label).toBe(303);
			expect(expectSameOrigin(response.headers()['location'], baseURL!, label).pathname).toBe(fallback);
			await request.dispose();
		}
	}
});

test('the stand-in Google sign-in falls back to /me/stubs', async ({ playwright, baseURL }) => {
	for (const payload of OPEN_REDIRECT_PAYLOADS) {
		for (const [path, fields] of [
			['/login?/googleSignIn', { redirectTo: payload }],
			[`/login?/googleSignIn&redirect=${encodeURIComponent(payload)}`, {}]
		] as const) {
			const request = await playwright.request.newContext({ baseURL });
			const result = await postAction(request, baseURL!, path, fields);
			const label = `${path} ${payload}`;
			expect(result.type, label).toBe('redirect');
			expect(expectSameOrigin(result.location, baseURL!, label).pathname).toBe('/me/stubs');
			await request.dispose();
		}
	}
});

test("an Issue's sign-in keeps the Fan on that Issue, whatever the hash", async ({ playwright, baseURL }) => {
	for (const payload of [...OPEN_REDIRECT_PAYLOADS, '#page-wall']) {
		const request = await playwright.request.newContext({ baseURL });
		const result = await postAction(request, baseURL!, `/i/${ISSUE_SLUG}?/googleAuth`, { targetHash: payload });
		const label = `googleAuth targetHash ${payload}`;
		if (result.type === 'redirect') {
			const target = expectSameOrigin(result.location, baseURL!, label);
			expect(target.pathname.startsWith(`/i/${ISSUE_SLUG}`), `${label} -> ${result.location}`).toBe(true);
		} else {
			// A hash SvelteKit cannot put in a Location (a newline) is refused, never followed.
			expect(result.httpStatus, label).toBeLessThan(500);
		}
		await request.dispose();
	}
});
