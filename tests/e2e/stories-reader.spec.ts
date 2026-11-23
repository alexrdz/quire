import { test, expect, type Browser, type Locator, type Page } from '@playwright/test';
import { resetRateLimits, seedVideoFileIssue } from './helpers/db';
import { createProductionArtist, PRODUCTION_URL, resetProductionRateLimits, tipTapsFor } from './helpers/production-db';
import { announcement, currentStoryPage, expectCurrent, goToStoryPage, openStoryAt, openTipSheet, storyPage } from './helpers/story';

/**
 * R-T01 (ADR 0011): the Stories reader. One full-screen page at a time; a tap
 * on the right two-thirds goes forward and on the left third back; swipes and
 * the arrow keys do the same; taps on controls never page; the place is kept
 * in the URL hash; the chrome is at least 44 px, its text passes AA over any
 * image, and reduced motion makes page changes instant. Checked at 320 px,
 * 390 px and a 1280 px desktop, where the reader is a centred column.
 */

const BROOKLYN = '/i/neon-velvet-brooklyn-2026-10-12';
const VIEWPORTS = [
	{ width: 320, height: 640 },
	{ width: 390, height: 844 },
	{ width: 1280, height: 800 }
] as const;

const TINY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);

test.beforeAll(async ({ request }) => {
	// The first request seeds the sample data on a fresh database.
	await request.get(BROOKLYN);
	await resetRateLimits();
});

/** A page at this size, with photos stubbed (the e2e suite never uses the network) and problems collected. */
async function readerAt(browser: Browser, baseURL: string | undefined, viewport: { width: number; height: number }) {
	const context = await browser.newContext({ baseURL, viewport });
	const page = await context.newPage();
	const problems: string[] = [];
	page.on('pageerror', (error) => problems.push(error.message));
	page.on('console', (msg) => {
		if (msg.type() === 'error' || /Content Security Policy|Refused to/i.test(msg.text())) problems.push(msg.text());
	});
	await page.route('https://images.unsplash.com/**', (route) =>
		route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG })
	);
	return { page, problems, close: () => context.close() };
}

/** The ids of the reader's pages, in order. */
function pageIds(page: Page): Promise<string[]> {
	return page.locator('.story-page').evaluateAll((els) => els.map((el) => el.getAttribute('data-page-id')!));
}

/** Clicks the reader column at a fraction of its width, at 40% of its height (clear of the header and bottom bar). */
async function tapAt(page: Page, fraction: number) {
	const box = (await page.locator('.story-column').boundingBox())!;
	await page.mouse.click(box.x + box.width * fraction, box.y + box.height * 0.4);
}

/** A horizontal mouse drag across the middle of the column. */
async function swipe(page: Page, direction: 'left' | 'right') {
	const box = (await page.locator('.story-column').boundingBox())!;
	const y = box.y + box.height * 0.4;
	const [from, to] = direction === 'left' ? [0.8, 0.2] : [0.2, 0.8];
	await page.mouse.move(box.x + box.width * from, y);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width * to, y, { steps: 8 });
	await page.mouse.up();
}

async function noHorizontalScroll(page: Page, label: string) {
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
	expect(overflow, `${label}: no horizontal scroll`).toBeLessThanOrEqual(0);
}

/** Every rendered control in `scope` smaller than 44 by 44 px (layout size, which ignores the slide transform). */
function smallControls(scope: Locator) {
	return scope.evaluateAll((roots) =>
		roots.flatMap((root) =>
			[...root.querySelectorAll('a[href], button, input, select, textarea')]
				.filter((el) => getComputedStyle(el).display !== 'none' && !el.closest('.visually-hidden'))
				.map((el) => ({
					name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim() || el.tagName,
					w: (el as HTMLElement).offsetWidth,
					h: (el as HTMLElement).offsetHeight
				}))
				.filter((c) => c.w < 44 || c.h < 44)
		)
	);
}

/**
 * The worst WCAG contrast of each piece of text in `selector`, over any image:
 * the backgrounds between the text and the page are composited over pure white
 * and over pure black (the two extremes a photo can be), and the lower ratio
 * is kept. A gradient counts as its least opaque visible stop.
 */
function worstContrast(page: Page, selector: string) {
	return page.locator(selector).evaluateAll((els) => {
		type RGBA = [number, number, number, number];
		const parse = (c: string): RGBA => {
			const n = (c.match(/[\d.]+/g) ?? []).map(Number);
			return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n.length >= 4 ? n[3]! : 1];
		};
		const over = (top: RGBA, below: [number, number, number]): [number, number, number] =>
			[0, 1, 2].map((i) => top[i]! * top[3] + below[i]! * (1 - top[3])) as [number, number, number];
		const lum = (rgb: [number, number, number]) =>
			rgb
				.map((v) => v / 255)
				.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
				.reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
		const ratio = (a: [number, number, number], b: [number, number, number]) => {
			const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
			return (x! + 0.05) / (y! + 0.05);
		};
		return els.map((el) => {
			// The layers under the text, outermost first, down to the image: the
			// Cover or photo section holds the image, so its own background is under it.
			const layers: RGBA[] = [];
			for (let node: Element | null = el; node && !node.matches('.story-column, .story-cover, .story-photo'); node = node.parentElement) {
				const style = getComputedStyle(node);
				const stops = (style.backgroundImage.match(/rgba?\([^)]*\)/g) ?? []).map(parse).filter((s) => s[3] > 0);
				if (stops.length) layers.unshift(stops.reduce((min, s) => (s[3] < min[3] ? s : min)));
				const color = parse(style.backgroundColor);
				if (color[3] > 0) layers.unshift(color);
			}
			const text = parse(getComputedStyle(el).color);
			const worst = ([255, 0] as const).map((base) => {
				const bg = layers.reduce<[number, number, number]>((below, layer) => over(layer, below), [base, base, base]);
				return ratio(over(text, bg), bg);
			});
			return { text: (el.textContent ?? '').trim().slice(0, 40), ratio: Math.min(...worst) };
		});
	});
}

for (const viewport of VIEWPORTS) {
	test.describe(`at ${viewport.width} px`, () => {
		test('taps page forward on the right two-thirds and back on the left third; no auto-advance', async ({ browser, baseURL }) => {
			const { page, problems, close } = await readerAt(browser, baseURL, viewport);
			await page.goto(BROOKLYN);
			const ids = await pageIds(page);
			await expectCurrent(page, 'page-cover');

			// Nothing moves on its own.
			await page.waitForTimeout(1500);
			await expectCurrent(page, 'page-cover');

			await tapAt(page, 0.5);
			await expectCurrent(page, ids[1]!);
			await expect(page).toHaveURL(new RegExp(`#${ids[1]}$`));
			await expect(announcement(page)).toHaveText(`Page 2 of ${ids.length}`);
			// Focus moves to the new page's heading, for screen readers.
			await expect
				.poll(() => page.evaluate(() => document.activeElement?.closest('.story-page')?.getAttribute('data-place')))
				.toBe('current');
			expect(await page.evaluate(() => document.activeElement?.tagName)).toMatch(/^H[12]$/);

			await tapAt(page, 0.9);
			await expectCurrent(page, ids[2]!);
			await tapAt(page, 0.2);
			await expectCurrent(page, ids[1]!);
			await tapAt(page, 0.05);
			await expectCurrent(page, 'page-cover');
			// At the start, back does nothing.
			await tapAt(page, 0.05);
			await expectCurrent(page, 'page-cover');

			await noHorizontalScroll(page, 'paging');
			expect(problems).toEqual([]);
			await close();
		});

		test('a swipe and the arrow keys page too; a vertical drag does not', async ({ browser, baseURL }) => {
			const { page, close } = await readerAt(browser, baseURL, viewport);
			await page.goto(BROOKLYN);
			const ids = await pageIds(page);
			await expectCurrent(page, 'page-cover');

			await swipe(page, 'left');
			await expectCurrent(page, ids[1]!);
			await swipe(page, 'right');
			await expectCurrent(page, 'page-cover');

			const box = (await page.locator('.story-column').boundingBox())!;
			await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.3);
			await page.mouse.down();
			await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, { steps: 8 });
			await page.mouse.up();
			await expectCurrent(page, 'page-cover');

			await page.keyboard.press('ArrowRight');
			await expectCurrent(page, ids[1]!);
			await page.keyboard.press('ArrowRight');
			await expectCurrent(page, ids[2]!);
			await page.keyboard.press('ArrowLeft');
			await expectCurrent(page, ids[1]!);
			await close();
		});

		test('taps on the Tip pill, links, inputs and sheets never page', async ({ browser, baseURL }) => {
			const { page, close } = await readerAt(browser, baseURL, viewport);
			// Links are tapped for real, but kept from navigating, so the page under them can be checked.
			await page.addInitScript(() =>
				document.addEventListener('click', (e) => (e.target as Element).closest?.('a') && e.preventDefault(), true)
			);
			await page.goto(BROOKLYN);
			const ids = await pageIds(page);

			// A Cover tip pill is a Venmo button (test mode: the tap is recorded and the Demo message shows).
			const tap = page.waitForRequest((req) => req.url().endsWith('/api/tip-tap'));
			await page.locator('#page-cover .story-tip-pill', { hasText: '$5' }).click();
			await tap;
			await expect(page.locator('#page-cover').getByTestId('venmo-demo-message')).toBeVisible();
			await expectCurrent(page, 'page-cover');

			// "Other amount" opens the tip sheet; a tap inside the sheet doesn't page.
			const panel = await openTipSheet(page);
			await panel.locator('.venmo-tip-input').click();
			await panel.locator('.venmo-tip-hint').first().click();
			await page.keyboard.press('Escape');
			await expect(page.locator('dialog[open]')).toHaveCount(0);
			await expectCurrent(page, 'page-cover');

			// The header's Close link.
			await page.locator('.story-close').click();
			await expectCurrent(page, 'page-cover');

			// The bottom bar's Tip pill, on a content page.
			await goToStoryPage(page, ids[1]!);
			await page.locator('.story-bar .story-tip').click();
			await expect(page.locator('dialog[open] .venmo-tip-panel')).toBeVisible();
			await page.keyboard.press('Escape');
			await expectCurrent(page, ids[1]!);

			// The Wall's note field.
			await goToStoryPage(page, 'page-wall');
			await page.locator('#page-wall textarea').click();
			await page.keyboard.type('Hi');
			await page.keyboard.press('ArrowLeft');
			await expectCurrent(page, 'page-wall');
			await close();
		});

		test('the place survives a refresh, and an old hash opens the Cover', async ({ browser, baseURL }) => {
			const { page, close } = await readerAt(browser, baseURL, viewport);
			await page.goto(BROOKLYN);
			const photoId = await page
				.locator('.story-page')
				.filter({ has: page.locator('section.story-photo') })
				.first()
				.getAttribute('data-page-id');
			await page.goto(`${BROOKLYN}#${photoId}-photo-2`);
			await expectCurrent(page, photoId!);
			await expect(page.locator(`#${photoId} .story-photo-count`)).toHaveText(/^2 \//);
			await page.reload();
			await expectCurrent(page, photoId!);
			await expect(page.locator(`#${photoId} .story-photo-count`)).toHaveText(/^2 \//);
			await expect(page).toHaveURL(new RegExp(`#${photoId}-photo-2$`));

			// Back still leaves the Issue: paging replaces the history entry instead of adding one.
			const length = await page.evaluate(() => history.length);
			await tapAt(page, 0.8);
			await tapAt(page, 0.8);
			expect(await page.evaluate(() => history.length)).toBe(length);

			// Opening a link with an unknown hash (the old reader's #tip) starts at the Cover.
			await page.goto('about:blank');
			await page.goto(`${BROOKLYN}#tip`);
			await expectCurrent(page, 'page-cover');
			await close();
		});

		test('every control is 44 px or more, with no horizontal scroll', async ({ browser, baseURL }) => {
			const { page, close } = await readerAt(browser, baseURL, viewport);
			await page.goto(BROOKLYN);
			const ids = await pageIds(page);

			await expectCurrent(page, 'page-cover');
			expect(await smallControls(page.locator('.story-header, #page-cover')), 'Cover').toEqual([]);
			await noHorizontalScroll(page, 'Cover');

			for (const id of ids.slice(1)) {
				await goToStoryPage(page, id);
				await noHorizontalScroll(page, id);
			}
			const photoFrame = page.locator('.story-page').filter({ has: page.locator('section.story-photo') }).first();
			await goToStoryPage(page, (await photoFrame.getAttribute('data-page-id'))!);
			expect(await smallControls(page.locator('.story-bar, .story-header, section.story-photo')), 'bars').toEqual([]);
			const sides = await page.locator('.story-side').evaluateAll((els) =>
				els
					.filter((el) => getComputedStyle(el).display !== 'none')
					.map((el) => Math.min((el as HTMLElement).offsetWidth, (el as HTMLElement).offsetHeight))
			);
			for (const size of sides) expect(size, 'Prev or Next').toBeGreaterThanOrEqual(44);

			await openTipSheet(page);
			expect(await smallControls(page.locator('dialog[open]')), 'tip sheet').toEqual([]);
			await noHorizontalScroll(page, 'tip sheet');
			await close();
		});

		test('text over the Cover art and photos passes AA over any image', async ({ browser, baseURL }) => {
			const { page, close } = await readerAt(browser, baseURL, viewport);
			await page.goto(BROOKLYN);
			const text =
				'.story-header-name, .story-header-meta, [data-scrim] :is(h1, h2, p, span, time), .story-bar .story-pill';
			const cover = await worstContrast(
				page,
				`#page-cover :is(${text}, .story-tip-pill, .story-tip-other, .story-open), .story-header :is(${text})`
			);
			expect(cover.length).toBeGreaterThan(4);
			for (const { text: words, ratio } of cover) expect(ratio, `Cover: "${words}"`).toBeGreaterThanOrEqual(4.5);

			const photoFrame = page.locator('.story-page').filter({ has: page.locator('section.story-photo') }).first();
			await goToStoryPage(page, (await photoFrame.getAttribute('data-page-id'))!);
			const photo = await worstContrast(page, `section.story-photo :is(${text}), .story-bar .story-pill`);
			expect(photo.length).toBeGreaterThan(3);
			for (const { text: words, ratio } of photo) expect(ratio, `Photo: "${words}"`).toBeGreaterThanOrEqual(4.5);
			await close();
		});
	});
}

test('on a desktop the reader is a centred column of at most 480 px, with Prev and Next beside it', async ({ browser, baseURL }) => {
	const { page, close } = await readerAt(browser, baseURL, { width: 1280, height: 800 });
	await page.goto(BROOKLYN);
	const ids = await pageIds(page);
	const column = (await page.locator('.story-column').boundingBox())!;
	expect(column.width).toBeLessThanOrEqual(480);
	expect(Math.abs(column.x + column.width / 2 - 640)).toBeLessThanOrEqual(1);

	const prev = page.getByRole('button', { name: 'Previous page' });
	const next = page.getByRole('button', { name: 'Next page' });
	await expect(prev).toBeDisabled();
	expect((await prev.boundingBox())!.x + (await prev.boundingBox())!.width).toBeLessThanOrEqual(column.x);
	expect((await next.boundingBox())!.x).toBeGreaterThanOrEqual(column.x + column.width);
	await next.click();
	await expectCurrent(page, ids[1]!);
	await prev.click();
	await expectCurrent(page, 'page-cover');
	await close();
});

test('on a phone Prev appears only when the keyboard reaches it, and Next is in the bottom bar', async ({ browser, baseURL }) => {
	const { page, close } = await readerAt(browser, baseURL, { width: 390, height: 844 });
	await page.goto(BROOKLYN);
	const ids = await pageIds(page);
	await expectCurrent(page, 'page-cover');
	// A keyboard Fan pages on with the arrow keys; focus lands on each page's heading.
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await expectCurrent(page, ids[2]!);

	const prev = page.getByRole('button', { name: 'Previous page' });
	await expect(prev).toHaveCSS('opacity', '0');
	// Back from the heading: the header's Close, then Prev.
	await page.keyboard.press('Shift+Tab');
	await expect(page.locator('.story-close')).toBeFocused();
	await page.keyboard.press('Shift+Tab');
	await expect(prev).toBeFocused();
	await expect(prev).toHaveCSS('opacity', '1');
	await page.keyboard.press('Enter');
	await expectCurrent(page, ids[1]!);

	await page.locator('.story-bar').getByRole('button', { name: 'Next' }).click();
	await expectCurrent(page, ids[2]!);
	// The last page has nothing to go on to.
	await goToStoryPage(page, 'page-endpaper');
	await expect(page.locator('.story-bar').getByRole('button', { name: 'Next' })).toHaveCount(0);
	await close();
});

test('with reduced motion a page change is instant; otherwise it takes at most 250 ms', async ({ browser, baseURL }) => {
	for (const reducedMotion of ['reduce', 'no-preference'] as const) {
		const { page, close } = await readerAt(browser, baseURL, { width: 390, height: 844 });
		await page.emulateMedia({ reducedMotion });
		await page.goto(BROOKLYN);
		const ids = await pageIds(page);
		await expectCurrent(page, 'page-cover');
		await tapAt(page, 0.8);
		const frame = storyPage(page, ids[1]!);
		const timing = await frame.evaluate((el) => ({
			opacity: Number(getComputedStyle(el).opacity),
			durations: getComputedStyle(el)
				.transitionDuration.split(',')
				.map((d) => parseFloat(d) * (d.trim().endsWith('ms') ? 1 : 1000))
		}));
		if (reducedMotion === 'reduce') {
			// No transition at all: the new page is fully there at once.
			expect(timing.durations.every((d) => d === 0), `durations ${timing.durations}`).toBe(true);
			expect(timing.opacity).toBe(1);
		} else {
			expect(Math.max(...timing.durations)).toBeGreaterThan(0);
			expect(Math.max(...timing.durations)).toBeLessThanOrEqual(250);
		}
		await close();
	}
});

test('the tip and Wall sheets: grab handle, Escape, tap outside and swipe down close them, focus returns', async ({ browser, baseURL }) => {
	const { page, close } = await readerAt(browser, baseURL, { width: 390, height: 844 });
	await page.goto(BROOKLYN);
	const ids = await pageIds(page);
	await goToStoryPage(page, ids[1]!);
	const tip = page.locator('.story-bar .story-tip');
	const dialog = page.locator('dialog[open]');

	// Escape, and focus goes back to the Tip pill.
	await tip.click();
	await expect(dialog).toBeVisible();
	await expect(dialog.locator('.sheet-handle')).toBeVisible();
	await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(true);
	await page.keyboard.press('Escape');
	await expect(dialog).toHaveCount(0);
	await expect(tip).toBeFocused();

	// A tap outside the sheet.
	await tip.click();
	await expect(dialog).toBeVisible();
	await page.mouse.click(195, 40);
	await expect(dialog).toHaveCount(0);

	// A swipe down on the handle, once the sheet has finished sliding up.
	await tip.click();
	await dialog.locator('.sheet').evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
	const handle = (await dialog.locator('.sheet-grab').boundingBox())!;
	await page.mouse.move(handle.x + handle.width / 2, handle.y + 10);
	await page.mouse.down();
	await page.mouse.move(handle.x + handle.width / 2, handle.y + 200, { steps: 10 });
	await page.mouse.up();
	await expect(dialog).toHaveCount(0);

	// Focus stays in the sheet while it is open.
	await tip.click();
	for (let i = 0; i < 12; i++) {
		await page.keyboard.press('Tab');
		expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')) || document.activeElement === document.body)).toBe(true);
	}
	await page.keyboard.press('Escape');

	// The Wall button opens the Wall sheet with the note count, which leads to the Wall page.
	const wall = page.locator('.story-bar .story-wall');
	await expect(wall).toHaveAccessibleName(/^The Wall, \d+ notes?$/);
	await wall.click();
	await expect(dialog.getByRole('heading', { name: 'The Wall' })).toBeVisible();
	await dialog.getByRole('button', { name: 'Open the Wall' }).click();
	await expect(dialog).toHaveCount(0);
	await expectCurrent(page, 'page-wall');
	await expect(currentStoryPage(page)).toHaveAttribute('data-page-id', 'page-wall');
	await close();
});

test('taps on video controls never page', async ({ browser, baseURL, request }) => {
	const slug = `stories-video-${crypto.randomUUID().slice(0, 8)}`;
	await request.get('/');
	await seedVideoFileIssue(slug);
	const { page, close } = await readerAt(browser, baseURL, { width: 390, height: 844 });
	await page.route('**/uploads/videos/**', (route) => route.fulfill({ status: 404, body: '' }));
	await openStoryAt(page, `/i/${slug}`, 'page-content-0');
	const video = page.locator('#page-content-0 video');
	const box = (await video.boundingBox())!;
	// The native control bar along the bottom, and the middle of the player.
	await page.mouse.click(box.x + box.width * 0.8, box.y + box.height - 16);
	await page.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2);
	await expectCurrent(page, 'page-content-0');
	await close();
});

test('in production the tip sheet opens the exact Venmo link and records a Tip Tap', async ({ browser }) => {
	await resetProductionRateLimits();
	const artist = await createProductionArtist({ displayName: 'The Stories Tip Band', venmoUsername: 'Stories-Tip-Band', tipPresets: [3, 5, 10] });
	const context = await browser.newContext({ baseURL: PRODUCTION_URL, viewport: { width: 390, height: 844 } });
	const page = await context.newPage();
	const opened: string[] = [];
	await page.route(/^https:\/\/([a-z]+\.)?venmo\.com\//, (route) => {
		opened.push(route.request().url());
		return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Venmo stand-in</title>' });
	});
	const expected = 'https://venmo.com/Stories-Tip-Band?txn=pay&amount=5.00&note=Tip%20for%20The%20Stories%20Tip%20Band%20via%20Quire';

	await page.goto(`/i/${artist.issueSlug}`);
	// From a content page's bottom bar, as a Fan mid-read would.
	await page.keyboard.press('ArrowRight');
	const panel = await openTipSheet(page);
	const preset = panel.locator('a.venmo-tip-preset', { hasText: '$5' });
	await expect(preset).toHaveAttribute('href', expected);
	const tap = page.waitForRequest((req) => req.url().endsWith('/api/tip-tap') && req.method() === 'POST');
	await preset.click();
	await tap;
	await expect(page).toHaveURL(expected);
	expect(opened).toEqual([expected]);
	await expect
		.poll(async () => tipTapsFor(artist.artistId))
		.toContainEqual({ issueId: artist.issueId, amountSelectedCents: 500 });
	await context.close();
});
