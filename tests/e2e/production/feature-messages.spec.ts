import { test, expect } from '@playwright/test';
import { FEATURE_UNAVAILABLE, VIDEO_UPLOADS_UNAVAILABLE } from '../../../src/lib/features';
import { postAction, signInWithPassword } from '../helpers/actions';
import {
	addIssuePage,
	createProductionArtist,
	resetProductionRateLimits,
	sessionCount,
	userExists,
	type ProductionArtist
} from '../helpers/production-db';

/**
 * PRODUCTION_PLAN Phase 5: each missing feature key shows its message (ADR 0007, tier 2).
 *
 * The production server has no Resend, Google or R2 keys, so email, Fan sign-in
 * and uploads are off. Each surface must say so in its own words, refuse the
 * action with a 503 (never a 500), and never fall back to a local stand-in
 * (no sample Fan session, no local file, no fake email).
 */

let artist: ProductionArtist;

test.beforeAll(async () => {
	await resetProductionRateLimits();
	artist = await createProductionArtist({ displayName: 'Feature Check Band', venmoUsername: null });
});

test.describe('Email off', () => {
	test('Artist sign-up shows the email-off message and refuses with 503', async ({ page, baseURL }) => {
		await page.goto('/login?mode=signup');
		const notice = page.locator('.feature-notice[data-feature="email"]');
		await expect(notice).toHaveText(FEATURE_UNAVAILABLE.email);
		await expect(page.locator('button.btn-band-submit')).toBeDisabled();

		const email = `p5-signup-${Date.now()}@example.com`;
		const result = await postAction(page.request, baseURL!, '/login?/signup', {
			name: 'Sneaky Band',
			slug: `sneaky-${Date.now()}`,
			email,
			password: 'a-long-password'
		});
		expect(result).toMatchObject({ type: 'failure', status: 503 });
		expect(result.data).toContain(FEATURE_UNAVAILABLE.email);
		expect(await userExists(email)).toBe(false);
	});

	test('password reset shows the email-off message and refuses with 503', async ({ page, baseURL }) => {
		await page.goto('/login/reset');
		await expect(page.locator('.feature-notice[data-feature="email"]')).toHaveText(FEATURE_UNAVAILABLE.email);
		await expect(page.locator('button.btn-reset-submit')).toBeDisabled();

		const result = await postAction(page.request, baseURL!, '/login/reset?/request', { email: artist.email });
		expect(result).toMatchObject({ type: 'failure', status: 503 });
		expect(result.data).toContain(FEATURE_UNAVAILABLE.email);

		// A bogus reset token is refused as a normal form error, not a crash.
		const confirm = await postAction(page.request, baseURL!, '/login/reset?/confirm', {
			token: 'not-a-real-token',
			newPassword: 'another-long-password'
		});
		expect(confirm.httpStatus).toBeLessThan(500);
		expect(confirm.type).toBe('failure');
	});

	test('the Better Auth email endpoints answer 503 EMAIL_UNAVAILABLE', async ({ request, baseURL }) => {
		for (const path of ['/api/auth/sign-up/email', '/api/auth/request-password-reset', '/api/auth/send-verification-email']) {
			const response = await request.post(path, {
				headers: { origin: baseURL! },
				data: { email: 'p5-auth@example.com', password: 'a-long-password', name: 'P5' }
			});
			expect(response.status(), path).toBe(503);
			expect(await response.json(), path).toEqual({ code: 'EMAIL_UNAVAILABLE', message: FEATURE_UNAVAILABLE.email });
		}
		expect(await userExists('p5-auth@example.com')).toBe(false);
	});
});

test.describe('Fan sign-in off', () => {
	test('the Fan sign-in tab shows the off message and no Google button', async ({ page }) => {
		await page.goto('/login?role=fan');
		await expect(page.locator('.feature-notice[data-feature="fanSignIn"]')).toHaveText(FEATURE_UNAVAILABLE.fanSignIn);
		await expect(page.locator('form[action="?/googleSignIn"]')).toHaveCount(0);
	});

	test('the Issue and Back Page sign-in prompts show the off message', async ({ page }) => {
		for (const path of [`/i/${artist.issueSlug}`, `/a/${artist.slug}`]) {
			const response = await page.goto(path);
			expect(response?.status(), path).toBe(200);
			// The nav's sign-in button opens the drawer that holds the Google button.
			await page.locator('.btn-nav-primary').first().click();
			await expect(page.locator('.feature-notice[data-feature="fanSignIn"]'), path).toHaveText(
				FEATURE_UNAVAILABLE.fanSignIn
			);
			await expect(page.locator('form[action="?/googleAuth"]'), path).toHaveCount(0);
		}
	});

	test('every Google sign-in action refuses with 503 and signs no one in', async ({ page, baseURL }) => {
		const before = await sessionCount();
		for (const path of ['/login?/googleSignIn', `/i/${artist.issueSlug}?/googleAuth`, `/a/${artist.slug}?/googleAuth`]) {
			const result = await postAction(page.request, baseURL!, path, { redirectTo: '/me/stubs' });
			expect(result, path).toMatchObject({ type: 'failure', status: 503 });
			expect(result.data, path).toContain(FEATURE_UNAVAILABLE.fanSignIn);
		}
		// No stand-in: the sample Fan does not exist in production, and no session was made.
		expect(await sessionCount()).toBe(before);
		expect((await page.context().cookies()).some((c) => c.name.includes('session_token'))).toBe(false);
	});

	test('Better Auth has no Google provider to fall back to', async ({ request, baseURL }) => {
		const response = await request.post('/api/auth/sign-in/social', {
			headers: { origin: baseURL! },
			data: { provider: 'google', callbackURL: '/me/stubs' }
		});
		expect(response.status()).toBe(404);
		expect(await response.json()).toMatchObject({ code: 'PROVIDER_NOT_FOUND' });
	});
});

test.describe('Uploads off', () => {
	test('every upload control is disabled and shows the uploads-off message', async ({ page }) => {
		await addIssuePage(artist.issueId, 'photo', { title: 'Photos' });
		await addIssuePage(artist.issueId, 'audio', { title: 'Audio' });
		await signInWithPassword(page, artist.email, artist.password);

		for (const path of ['/dashboard/issues/quick', '/dashboard/template', `/dashboard/bookbinder/${artist.issueId}`]) {
			const response = await page.goto(path);
			expect(response?.status(), path).toBe(200);
			const inputs = page.locator('input[type="file"]');
			const count = await inputs.count();
			expect(count, `${path} has upload controls`).toBeGreaterThan(0);
			for (let i = 0; i < count; i++) await expect(inputs.nth(i), `${path} input ${i}`).toBeDisabled();
			// Photo and audio controls keep the general wording; the video recorder has its own.
			const notices = page.locator('.feature-notice[data-feature="uploads"]:not([data-variant])');
			expect(await notices.count(), path).toBeGreaterThan(0);
			for (let i = 0; i < (await notices.count()); i++) {
				await expect(notices.nth(i), `${path} notice ${i}`).toHaveText(FEATURE_UNAVAILABLE.uploads);
			}
			// Production never shows the Demo's wording.
			await expect(page.locator('.feature-notice'), path).not.toContainText(['Demo']);
		}
	});

	test('the video recorder is off too: no camera, no file picker, a video notice; the video URL still works', async ({ page }) => {
		// A video page with no video yet, so its recorder starts idle.
		const videoPageId = await addIssuePage(artist.issueId, 'video', { title: 'Video' });
		await signInWithPassword(page, artist.email, artist.password);

		async function recorderIsOff(where: string, recorder: ReturnType<typeof page.locator>, wording: string) {
			// Video wording, not the general "paste an image URL" line.
			const notice = recorder.locator('.feature-notice[data-feature="uploads"]');
			await expect(notice, where).toHaveText(wording);
			await expect(notice, where).not.toContainText('image');
			await expect(recorder.getByRole('button', { name: 'Open Camera' }), where).toBeDisabled();
			await expect(recorder.getByRole('button', { name: 'Upload Video File' }), where).toBeDisabled();
			const inputs = recorder.locator('input[type="file"]');
			expect(await inputs.count(), where).toBeGreaterThan(0);
			for (let i = 0; i < (await inputs.count()); i++) await expect(inputs.nth(i), `${where} input ${i}`).toBeDisabled();
		}

		await page.goto('/dashboard/issues/quick');
		// Quick Issue has no video link field, so the notice says where a link can go.
		await recorderIsOff('Quick Issue', page.locator('.video-recorder-root'), VIDEO_UPLOADS_UNAVAILABLE.videoNoLink);

		await page.goto(`/dashboard/bookbinder/${artist.issueId}`);
		// The existing video page's edit form.
		const existing = page.locator('form[action="?/updatePage"]', { has: page.locator(`input[name="pageId"][value="${videoPageId}"]`) });
		await recorderIsOff('Bookbinder video page', existing.locator('.video-recorder-root'), VIDEO_UPLOADS_UNAVAILABLE.video);
		await expect(existing.locator('input[name="videoUrl"]')).toBeEnabled();

		// The new-page form, with the video kind chosen.
		await page.locator('#new-kind').selectOption('video');
		const addForm = page.locator('form[action="?/addPage"]');
		await recorderIsOff('Bookbinder new page', addForm.locator('.video-recorder-root'), VIDEO_UPLOADS_UNAVAILABLE.video);
		await expect(addForm.locator('#new-video-url')).toBeEnabled();
	});
});
