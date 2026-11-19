import { chromium, test, expect, type Page } from '@playwright/test';
import { E2E_MEDIA_ORIGIN, seedEmbedIssue } from './helpers/db';

/**
 * PRODUCTION_PLAN 3.4: security headers on real responses from the production
 * build, and no CSP violations on the pages that load third-party content.
 * Third-party hosts are stubbed with page.route, so nothing leaves the machine.
 * The browser checks the CSP before a request reaches the route, so a blocked
 * source still shows up as a violation.
 */

const TINY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);

function expectSecurityHeaders(headers: Record<string, string>) {
	const csp = headers['content-security-policy'] ?? '';
	expect(csp).toContain("default-src 'self'");
	expect(csp).toMatch(/frame-ancestors '(none|self)'/);
	expect(csp).toContain("object-src 'none'");
	expect(csp).toContain("base-uri 'self'");
	expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
	expect(headers['x-content-type-options']).toBe('nosniff');
	expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
	return csp;
}

/** Collects CSP violations from the console and from securitypolicyviolation events. */
async function watchCsp(page: Page): Promise<() => Promise<string[]>> {
	const fromConsole: string[] = [];
	page.on('console', (msg) => {
		const text = msg.text();
		if (/Content Security Policy|Refused to/i.test(text)) fromConsole.push(text);
	});
	await page.addInitScript(() => {
		const list: string[] = [];
		(window as unknown as { __csp: string[] }).__csp = list;
		document.addEventListener('securitypolicyviolation', (e) => {
			list.push(`${e.violatedDirective} ${e.blockedURI}`);
		});
	});
	return async () => {
		const fromEvents = await page
			.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? [])
			.catch(() => []);
		return [...fromConsole, ...fromEvents];
	};
}

async function stubThirdParties(page: Page) {
	const html = (title: string) => ({
		status: 200,
		contentType: 'text/html',
		body: `<!doctype html><title>${title}</title><p>${title} stub</p>`
	});
	await page.route(`${E2E_MEDIA_ORIGIN}/**/*.webp`, (r) =>
		r.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG })
	);
	await page.route(`${E2E_MEDIA_ORIGIN}/**/*.mp3`, (r) =>
		r.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.alloc(0) })
	);
	await page.route('https://i.ytimg.com/**', (r) =>
		r.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG })
	);
	await page.route('https://images.unsplash.com/**', (r) =>
		r.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG })
	);
	await page.route('https://www.youtube-nocookie.com/**', (r) => r.fulfill(html('YouTube')));
	await page.route('https://player.vimeo.com/**', (r) => r.fulfill(html('Vimeo')));
	await page.route('https://bandcamp.com/**', (r) => r.fulfill(html('Bandcamp')));
}

test.describe('Security headers', () => {
	test('a normal page has the CSP with a SvelteKit nonce and the other headers', async ({ request }) => {
		const res = await request.get('/');
		expect(res.status()).toBe(200);
		const csp = expectSecurityHeaders(res.headers());
		expect(csp).toContain("frame-ancestors 'none'");
		expect(csp).toMatch(/script-src 'self' 'nonce-[^']+'/);
		expect(csp).toContain("style-src 'self' 'unsafe-inline'");
		expect(csp).toContain('form-action \'self\' https://accounts.google.com');
		expect(csp).toContain(`img-src 'self' data: blob: ${E2E_MEDIA_ORIGIN}`);
	});

	test('an /api/auth response has the headers', async ({ request }) => {
		const res = await request.get('/api/auth/get-session');
		expect(res.status()).toBeLessThan(500);
		const csp = expectSecurityHeaders(res.headers());
		expect(csp).toContain("script-src 'self';");
	});

	test('/healthz reports a healthy database with the headers', async ({ request }) => {
		const res = await request.get('/healthz');
		expect(res.status()).toBe(200);
		expect(res.headers()['cache-control']).toBe('no-store');
		expect(await res.json()).toMatchObject({ ok: true, mode: 'test', db: 'ok' });
		expectSecurityHeaders(res.headers());
	});

	test('the reader renders R2 media and YouTube, Vimeo and Bandcamp embeds with no CSP violations', async ({
		page,
		request
	}) => {
		// The first request seeds the sample Artist the Issue belongs to.
		await request.get('/');
		const slug = await seedEmbedIssue();

		const violations = await watchCsp(page);
		await stubThirdParties(page);

		const loaded: string[] = [];
		page.on('requestfinished', (req) => loaded.push(req.url()));

		const res = await page.goto(`/i/${slug}`);
		expect(res?.status()).toBe(200);
		await page.waitForLoadState('networkidle');

		const poster = page.locator('img.video-poster-img');
		await poster.scrollIntoViewIfNeeded();
		await expect.poll(() => loaded.some((url) => url.startsWith('https://i.ytimg.com/'))).toBe(true);

		await page.locator('button[aria-label="Play YouTube Clip"]').click();
		await page.locator('button[aria-label="Play Vimeo Clip"]').click();

		for (const title of ['YouTube Clip', 'Vimeo Clip', 'Bandcamp Player']) {
			const frame = page.locator(`iframe[title="${title}"]`);
			await frame.scrollIntoViewIfNeeded();
			await expect(frame).toBeVisible();
		}
		await expect(page.frameLocator('iframe[title="YouTube Clip"]').locator('p')).toHaveText('YouTube stub');
		await expect(page.frameLocator('iframe[title="Vimeo Clip"]').locator('p')).toHaveText('Vimeo stub');
		await expect(page.frameLocator('iframe[title="Bandcamp Player"]').locator('p')).toHaveText(
			'Bandcamp stub'
		);

		await expect
			.poll(() => loaded.some((url) => url.startsWith(`${E2E_MEDIA_ORIGIN}/photos/`)))
			.toBe(true);

		expect(await violations()).toEqual([]);
	});

	test('the main pages render with no CSP violations', async ({ page }) => {
		const violations = await watchCsp(page);
		await stubThirdParties(page);

		for (const path of ['/', '/login', '/a/the-neon-velvet', '/i/neon-velvet-brooklyn-2026-10-12', '/faq']) {
			const res = await page.goto(path);
			expect(res?.status(), path).toBe(200);
			await page.waitForLoadState('networkidle');
		}

		// Signed in as the sample Artist: dashboard, settings, Quick Issue and Bookbinder.
		await page.goto('/demo');
		await expect(page).toHaveURL(/\/dashboard/);
		for (const path of ['/dashboard', '/dashboard/settings', '/dashboard/template', '/dashboard/issues/quick']) {
			const res = await page.goto(path);
			expect(res?.status(), path).toBe(200);
			await page.waitForLoadState('networkidle');
		}
		const bookbinderLink = page.locator('a[href^="/dashboard/bookbinder/"]').first();
		await page.goto('/dashboard');
		await bookbinderLink.click();
		await page.waitForLoadState('networkidle');
		// The live reader preview frames /i/<slug>: frame-src and frame-ancestors 'self'.
		const preview = page.frameLocator('iframe[title="Live Issue Mobile Preview"]');
		await expect(preview.locator('#page-cover')).toBeAttached();

		expect(await violations()).toEqual([]);
	});

	test('the Google sign-in redirect is not blocked by form-action', async ({ browserName, baseURL }) => {
		test.skip(browserName !== 'chromium', 'Chrome is the browser that applies form-action to redirects.');
		// Playwright can't intercept a redirect that follows a fulfilled response, so
		// this browser resolves accounts.google.com to this machine: the request is
		// made (proof that form-action allowed it) and then fails locally.
		const browser = await chromium.launch({
			args: ['--host-resolver-rules=MAP accounts.google.com 127.0.0.1']
		});
		// No JavaScript: a native form POST, the case where Chrome applies
		// form-action to the 303 that sends the Fan on to Google.
		const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
		const page = await context.newPage();
		const consoleViolations: string[] = [];
		page.on('console', (msg) => {
			if (/Content Security Policy|Refused to/i.test(msg.text())) consoleViolations.push(msg.text());
		});
		const googleRequests: string[] = [];
		page.on('request', (req) => {
			if (req.url().startsWith('https://accounts.google.com/')) googleRequests.push(req.url());
		});

		const googleUrl = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=e2e&state=e2e';
		// The real action answers with Better Auth's Google URL only when Google
		// keys are set; test mode uses the stand-in. The redirect is the same.
		await page.route(/\/login\?\/googleSignIn/, (r) =>
			r.request().method() === 'POST'
				? r.fulfill({ status: 303, headers: { location: googleUrl } })
				: r.continue()
		);

		await page.goto('/login?role=fan');
		await page.locator('form[action="?/googleSignIn"] button[type="submit"]').click();

		await expect.poll(() => googleRequests).toEqual([googleUrl]);
		expect(consoleViolations).toEqual([]);
		await browser.close();
	});
});
