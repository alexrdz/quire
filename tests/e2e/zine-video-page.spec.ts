import { test, expect, type Page, type Locator } from '@playwright/test';
import { seedVideoFileIssue } from './helpers/db';
import { goToPageTitled } from './helpers/story';

/**
 * B1-T20: an uploaded video sits in a taped screen (ADR 0009). The portrait
 * screen is a 9:16 screen, narrower than the page, and at phone widths neither
 * it nor its corner tape may poke past the page edge or scroll the page sideways.
 * Tape must not cover a control, including the native video controls at the
 * bottom of the player.
 */

// Random, so --repeat-each copies in parallel workers never share an Issue.
const SLUG = `zine-video-${crypto.randomUUID().slice(0, 8)}`;

test.beforeAll(async ({ request }) => {
	// The first request seeds the sample Artist the Issue belongs to.
	await request.get('/');
	await seedVideoFileIssue(SLUG);
});

/** The content page whose heading is `title`. */
const pageTitled = (page: Page, title: string) =>
	page.locator('section.content-page-canvas').filter({ has: page.locator('.bespoke-heading', { hasText: title }) });

async function open(page: Page, width: number) {
	await page.setViewportSize({ width, height: 844 });
	// The seeded files are not on disk; an empty player is enough to lay out the screen.
	await page.route('**/uploads/videos/**', (route) => route.fulfill({ status: 404, body: '' }));
	await page.goto(`/i/${SLUG}`);
	await page.evaluate(() => document.fonts.ready);
}

/** Every element of the section that reaches past its left or right edge. */
function pastTheEdge(section: Locator) {
	return section.evaluate((el) => {
		const edge = el.getBoundingClientRect();
		return [...el.querySelectorAll('*')]
			.map((child) => ({ child, r: child.getBoundingClientRect() }))
			.filter(({ r }) => r.width > 0 && (r.left < edge.left - 0.5 || r.right > edge.right + 0.5))
			.map(({ child, r }) => `${child.tagName.toLowerCase()}.${[...child.classList].join('.')} ${r.left.toFixed(1)}..${r.right.toFixed(1)} of ${edge.left.toFixed(1)}..${edge.right.toFixed(1)}`);
	});
}

/** Tape that overlaps a control: links, buttons, inputs, and the bottom control bar of a video. */
function tapeOverControls(section: Locator) {
	return section.evaluate((el) => {
		const controls = [...el.querySelectorAll(':is(a[href], button, input, audio)')].map((c) => ({
			name: c.textContent?.trim() || c.tagName,
			r: c.getBoundingClientRect()
		}));
		for (const video of el.querySelectorAll('video')) {
			const r = video.getBoundingClientRect();
			// Chromium draws the native controls in a bar along the bottom of the player.
			controls.push({ name: 'video controls', r: new DOMRect(r.left, r.bottom - 48, r.width, 48) });
		}
		const hits: string[] = [];
		for (const tape of el.querySelectorAll('.tape')) {
			const a = tape.getBoundingClientRect();
			for (const { name, r: b } of controls) {
				if (!b.width || !b.height) continue;
				const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
				const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
				if (x > 0.5 && y > 0.5) hits.push(name);
			}
		}
		return hits;
	});
}

for (const width of [390, 320]) {
	test(`a portrait video page stays inside the page at ${width} px`, async ({ page }) => {
		await open(page, width);
		await goToPageTitled(page, 'Portrait Clip');
		const portrait = pageTitled(page, 'Portrait Clip');

		// Still a 9:16 screen, taped at both top corners, tilted a little.
		const screen = portrait.locator('.video-screen.is-portrait');
		await expect(screen.locator('.tape')).toHaveCount(2);
		const frame = await portrait.locator('.video-frame').evaluate((el) => ({
			w: (el as HTMLElement).offsetWidth,
			h: (el as HTMLElement).offsetHeight
		}));
		expect(frame.w / frame.h).toBeCloseTo(9 / 16, 2);
		const screenBox = await screen.evaluate((el) => ({
			screen: (el as HTMLElement).offsetWidth,
			page: (el.closest('section') as HTMLElement).clientWidth,
			tilt: getComputedStyle(el).transform
		}));
		// Narrower than the page, so it reads as a phone screen taped on, not a full-width panel.
		expect(screenBox.screen).toBeLessThan(screenBox.page);
		expect(screenBox.tilt).not.toBe('none');

		expect(await pastTheEdge(portrait)).toEqual([]);
		expect(await portrait.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
		expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
		expect(await tapeOverControls(portrait)).toEqual([]);
	});

	test(`a landscape video page is still a full-width 16:9 screen at ${width} px`, async ({ page }) => {
		await open(page, width);
		await goToPageTitled(page, 'Landscape Clip');
		const landscape = pageTitled(page, 'Landscape Clip');

		const screen = landscape.locator('.video-screen');
		await expect(screen).not.toHaveClass(/is-portrait/);
		await expect(screen.locator('.tape')).toHaveCount(2);
		const frame = await landscape.locator('.video-frame').evaluate((el) => ({
			w: (el as HTMLElement).offsetWidth,
			h: (el as HTMLElement).offsetHeight
		}));
		expect(frame.w / frame.h).toBeCloseTo(16 / 9, 1);

		expect(await pastTheEdge(landscape)).toEqual([]);
		expect(await landscape.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
		expect(await tapeOverControls(landscape)).toEqual([]);
	});
}
