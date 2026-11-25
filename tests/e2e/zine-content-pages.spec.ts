import { test, expect, type Page } from '@playwright/test';
import { E2E_MEDIA_ORIGIN, seedZineContentIssue } from './helpers/db';
import { goToPageTitled } from './helpers/story';

/**
 * Z-T05's content pages inside the Stories reader (ADR 0011). What is left here
 * is the photo page in the reader's frame, plus the rules that still apply to
 * every page: no horizontal scroll at 320 px, no decoration covering a control
 * and no CSP problems. The setlist and text pages moved to
 * stories-setlist-text.spec.ts (R-T03), and the audio and video pages to
 * stories-media.spec.ts (R-T02).
 *
 * The ADR 0009 look checks (paper, grain, typewriter faces, tilts and the
 * scroll-driven page turn) are gone with that look; stories-reader.spec.ts
 * covers the new frame.
 */

const TINY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);

/** Unsplash is offline in e2e; the browser still applies the CSP to the real URL. */
async function open(page: Page, width: number, path: string) {
	const problems: string[] = [];
	page.on('console', (msg) => {
		if (/Content Security Policy|Refused to/i.test(msg.text())) problems.push(msg.text());
	});
	page.on('pageerror', (error) => problems.push(error.message));
	await page.setViewportSize({ width, height: 844 });
	await page.route('https://images.unsplash.com/**', (route) =>
		route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG })
	);
	await page.route(`${E2E_MEDIA_ORIGIN}/**/*.webp`, (route) =>
		route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG })
	);
	await page.route(`${E2E_MEDIA_ORIGIN}/**/*.mp3`, (route) => route.fulfill({ status: 404, body: '' }));
	await page.route('https://i.ytimg.com/**', (route) =>
		route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG })
	);
	for (const host of ['https://www.youtube-nocookie.com/**', 'https://player.vimeo.com/**', 'https://bandcamp.com/**']) {
		await page.route(host, (route) =>
			route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>stub</title><p>stub</p>' })
		);
	}
	await page.goto(path);
	await page.evaluate(() => document.fonts.ready);
	return problems;
}

test.describe('content pages', () => {
	const SLUG = `zine-content-${crypto.randomUUID().slice(0, 8)}`;

	test.beforeAll(async ({ request }) => {
		// The first request seeds the sample Artist the Issue belongs to.
		await request.get('/');
		await seedZineContentIssue(SLUG);
	});

	/** The reader frame of the page whose heading is `title`. */
	const pageTitled = (page: Page, title: string) =>
		page.locator('.story-page').filter({ has: page.locator('h1, h2', { hasText: title }) });

	for (const width of [390, 320]) {
		test(`every content kind renders in the Stories frame at ${width} px`, async ({ page }) => {
			const problems = await open(page, width, `/i/${SLUG}`);

			// Photo: a full-screen photo page, its words over the scrim.
			const photo = await goToPageTitled(page, 'Zine Photo');
			// The polaroid stack (B1-T35): the photo on the top card, the page's words under the stack.
			await expect(photo.locator('.polaroid[data-state="top"] img')).toHaveAttribute('src', `${E2E_MEDIA_ORIGIN}/photos/zine.webp`);
			await expect(photo.locator('.story-photo-body')).toHaveText('Caption body');

			// Setlist and text pages: stories-setlist-text.spec.ts (R-T03).
			// Audio and video pages: stories-media.spec.ts (R-T02).

			// No horizontal scroll: not the page, and not any page inside its own frame.
			expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
			const overflowing = await page.locator('.story-page > section').evaluateAll((sections) =>
				sections.filter((s) => s.scrollWidth > s.clientWidth + 1).map((s) => s.id)
			);
			expect(overflowing).toEqual([]);

			// 44 px targets on the audio and video pages: stories-media.spec.ts.

			expect(problems).toEqual([]);
		});
	}
});
