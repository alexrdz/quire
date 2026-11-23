import { test, expect, type Page } from '@playwright/test';
import { E2E_MEDIA_ORIGIN, seedZineContentIssue } from './helpers/db';
import { goToPageTitled } from './helpers/story';

/**
 * Z-T05's content pages inside the Stories reader (ADR 0011). R-T02 and R-T03
 * restyle them; until then each renders its current component in the reader's
 * full-screen frame. This checks what the pages hold and do, each while it is
 * the page on screen: the setlist, a photo and a text page. (The audio and video
 * pages moved to stories-media.spec.ts with R-T02.) It also
 * keeps the rules that still apply: no horizontal scroll at 320 px, no
 * decoration covering a control, 44 px targets, AA text and no CSP problems.
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

	/** WCAG contrast of an element's text against the first opaque background behind it. */
	function contrastOf(page: Page, selector: string) {
		return page.locator(selector).evaluateAll((els) =>
			els.map((el) => {
				const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
				const lum = ([r, g, b]: number[]) =>
					[r, g, b]
						.map((v) => v / 255)
						.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
						.reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
				let node: Element | null = el;
				let background = 'rgb(0, 0, 0)';
				while (node) {
					const c = getComputedStyle(node).backgroundColor;
					const parts = rgb(c);
					if (parts.length >= 3 && (parts.length < 4 || parts[3] === 1)) {
						background = c;
						break;
					}
					node = node.parentElement;
				}
				const [a, b] = [lum(rgb(getComputedStyle(el).color)), lum(rgb(background))].sort((x, y) => y - x);
				return (a + 0.05) / (b + 0.05);
			})
		);
	}

	for (const width of [390, 320]) {
		test(`every content kind renders in the Stories frame at ${width} px`, async ({ page }) => {
			const problems = await open(page, width, `/i/${SLUG}`);

			// Setlist: the songs in order, the last one marked.
			const setlist = await goToPageTitled(page, 'Zine Setlist');
			await expect(setlist.locator('.song-row')).toHaveCount(3);
			await expect(setlist.locator('.song-row.is-last')).toContainText('Encore Song');
			await expect(setlist.locator('.song-row').first()).toBeVisible();

			// Photo: a full-screen photo page, its words over the scrim.
			const photo = await goToPageTitled(page, 'Zine Photo');
			await expect(photo.locator('img.story-photo-img.is-current')).toHaveAttribute('src', `${E2E_MEDIA_ORIGIN}/photos/zine.webp`);
			await expect(photo.locator('.story-photo-body')).toHaveText('Caption body');

			// Text: the words are on the page.
			const text = await goToPageTitled(page, 'Zine Text');
			await expect(text.locator('p.bespoke-body-text')).toHaveText('Words on a scrap.');

			// Audio and video pages: stories-media.spec.ts (R-T02).

			// No horizontal scroll: not the page, and not any page inside its own frame (corner tape at 320 px).
			expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
			const overflowing = await page.locator('.story-page > section').evaluateAll((sections) =>
				sections.filter((s) => s.scrollWidth > s.clientWidth + 1).map((s) => s.id)
			);
			expect(overflowing).toEqual([]);

			// AA contrast for the text on these pages.
			for (const ratio of await contrastOf(
				page,
				'.song-title, .song-num, .song-tag, .text-scrap p'
			)) {
				expect(ratio).toBeGreaterThanOrEqual(4.5);
			}

			// Tape never covers a control. Every page shares one frame, and a page's
			// tape and controls move together, so this holds for pages off screen too.
			const overlaps = await page.evaluate(() => {
				const hits: string[] = [];
				for (const section of document.querySelectorAll('.story-page > section')) {
					const controls = [...section.querySelectorAll(':is(a[href], button, audio, input)')];
					for (const tape of section.querySelectorAll('.tape')) {
						const a = tape.getBoundingClientRect();
						for (const c of controls) {
							const b = c.getBoundingClientRect();
							if (!b.width || !b.height) continue;
							const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
							const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
							if (x > 0.5 && y > 0.5) hits.push(c.textContent?.trim() || c.tagName);
						}
					}
				}
				return hits;
			});
			expect(overlaps).toEqual([]);

			// 44 px targets on the audio and video pages: stories-media.spec.ts.

			expect(problems).toEqual([]);
		});
	}
});
