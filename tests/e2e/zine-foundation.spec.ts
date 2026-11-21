import { test, expect, type Page } from '@playwright/test';
import { E2E_MEDIA_ORIGIN, seedZineContentIssue } from './helpers/db';

/**
 * ADR 0009 foundation (Z-T04): the Issue reader is cut-and-paste on dark.
 * These check the Rules, not the pixels: grain on every page, the accent
 * faces loaded from 'self', tape and stamps never covering a control, text
 * tilted at most about 2 degrees, 44 px tip targets, 320 px without
 * horizontal scroll, and a fade instead of a page turn under reduced motion.
 * Z-T05 extends them to the content pages: setlist sheet, cassette, taped
 * screen, and text and caption scraps.
 */

const ISSUE = '/i/neon-velvet-brooklyn-2026-10-12';
const TINY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);

/** Unsplash is offline in e2e; the browser still applies the CSP to the real URL. */
async function open(page: Page, width: number, path = ISSUE) {
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

/** True when an element's transform is at rest (none or the identity matrix). */
function isFlat(page: Page, selector: string) {
	return page.locator(selector).evaluate((el) => {
		const t = getComputedStyle(el).transform;
		return t === 'none' || new DOMMatrixReadOnly(t).isIdentity;
	});
}

/** The rotation, in degrees, an element's own transform applies. */
function rotationOf(page: Page, selector: string) {
	return page.locator(selector).evaluateAll((els) =>
		els.map((el) => {
			const m = new DOMMatrixReadOnly(getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform);
			return Math.abs((Math.atan2(m.b, m.a) * 180) / Math.PI);
		})
	);
}

for (const width of [390, 320]) {
	test(`the reader is cut-and-paste on dark at ${width} px`, async ({ page }) => {
		const problems = await open(page, width);

		// No horizontal page scroll (the book scrolls sideways inside its own container).
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow).toBeLessThanOrEqual(0);

		// Every page is dark paper with the grain, not glass.
		const sections = page.locator('.book-container > section');
		const count = await sections.count();
		expect(count).toBeGreaterThan(3);
		for (let i = 0; i < count; i++) {
			const section = sections.nth(i);
			await expect(section, `page ${i}`).toHaveClass(/zine-paper/);
			expect(await section.evaluate((el) => getComputedStyle(el).backgroundImage), `page ${i} grain`).toContain(
				'feTurbulence'
			);
		}

		// The accent faces come from 'self' and are in use.
		expect(await page.evaluate(() => document.fonts.check("16px 'Special Elite'"))).toBe(true);
		await expect(page.locator('#page-cover .type-label').first()).toHaveCSS('font-family', /Special Elite/);

		// The Cover: a taped, tilted print; typed labels; the cover note on a typed slip.
		const print = page.locator('#page-cover .cover-print');
		await expect(print).toBeVisible();
		await expect(print.locator('.tape')).toHaveCount(2);
		const [printTilt] = await rotationOf(page, '#page-cover .cover-print');
		expect(printTilt).toBeGreaterThan(1);
		await expect(page.locator('#page-cover .type-label')).toHaveText([/2026-10-12/, /Brooklyn/i, /Baby's All Right/i]);

		// Text never tilts beyond about 2 degrees.
		for (const tilt of await rotationOf(page, '.scrap, .type-label')) {
			expect(tilt).toBeLessThanOrEqual(2.05);
		}

		// Tape and stamps never cover a control. Each box is clipped to the scroll areas
		// around it: a Wall note scrolled out of its list is hidden, so it covers nothing.
		const overlaps = await page.evaluate(() => {
			const visibleBox = (el: Element) => {
				const r = el.getBoundingClientRect();
				let { left, top, right, bottom } = r;
				for (let p = el.parentElement; p; p = p.parentElement) {
					const s = getComputedStyle(p);
					if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
					const c = p.getBoundingClientRect();
					if (s.overflowX !== 'visible') {
						left = Math.max(left, c.left);
						right = Math.min(right, c.right);
					}
					if (s.overflowY !== 'visible') {
						top = Math.max(top, c.top);
						bottom = Math.min(bottom, c.bottom);
					}
				}
				return { left, top, right, bottom, width: right - left, height: bottom - top };
			};
			const deco = [...document.querySelectorAll('.tape, .stamp, .cover-print')];
			const controls = [...document.querySelectorAll('a[href], button, input, textarea, select')];
			const hits: string[] = [];
			for (const d of deco) {
				const a = visibleBox(d);
				if (a.width <= 0 || a.height <= 0) continue;
				for (const c of controls) {
					if (d.contains(c)) continue;
					const b = visibleBox(c);
					if (b.width <= 0 || b.height <= 0) continue;
					const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
					const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
					if (x > 0.5 && y > 0.5) hits.push(`${d.className} over ${c.textContent?.trim() || c.tagName}`);
				}
			}
			return hits;
		});
		expect(overlaps).toEqual([]);

		// The Venmo tip stays obvious and easy to tap.
		const panel = page.locator('#page-cover .venmo-tip-panel');
		await expect(panel).toBeVisible();
		for (const target of await panel.locator('.venmo-tip-preset, .venmo-tip-go').all()) {
			const box = (await target.boundingBox())!;
			expect(box.height, await target.innerText()).toBeGreaterThanOrEqual(44);
			expect(box.width, await target.innerText()).toBeGreaterThanOrEqual(44);
		}
		const [panelTilt] = await rotationOf(page, '#page-cover .venmo-tip-panel');
		expect(panelTilt).toBe(0);

		// The page shell: typed labels and a typed page number.
		const shell = page.locator('#page-content-0');
		await expect(shell.locator('.type-label')).toHaveCount(2);
		await expect(shell.locator('.subtext-page')).toHaveCSS('font-family', /Special Elite/);

		expect(problems).toEqual([]);
	});
}

test('pages turn as they are swiped, and sit flat when snapped', async ({ page }) => {
	await open(page, 390);
	const inner = page.locator('#page-cover > .page-inner');
	await expect(inner).toHaveCSS('animation-name', 'zine-page-turn');
	// Snapped: the turn is at rest, so nothing is skewed while reading.
	expect(await isFlat(page, '#page-cover > .page-inner')).toBe(true);

	// Half a page into a swipe, the next page is mid-turn.
	await page.locator('.book-container').evaluate((el) => el.scrollTo({ left: el.clientWidth / 2 }));
	await expect.poll(() => isFlat(page, '#page-content-0 > .page-inner')).toBe(false);
});

test('with reduced motion the page turn is only a fade', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await open(page, 390);
	const inner = page.locator('#page-cover > .page-inner');
	await expect(inner).toHaveCSS('animation-name', 'zine-page-fade');
	await page.locator('.book-container').evaluate((el) => el.scrollTo({ left: el.clientWidth / 2 }));
	const next = page.locator('#page-content-0 > .page-inner');
	await expect.poll(() => next.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeLessThan(1);
	expect(await isFlat(page, '#page-content-0 > .page-inner')).toBe(true);
});

/* ---------------------------------------------------------------------------
   Z-T05: the content pages
   --------------------------------------------------------------------------- */

test.describe('content pages', () => {
	const SLUG = `zine-content-${Date.now().toString(36)}`;

	test.beforeAll(async ({ request }) => {
		// The first request seeds the sample Artist the Issue belongs to.
		await request.get('/');
		await seedZineContentIssue(SLUG);
	});

	/** The content page whose heading is `title`. */
	const pageTitled = (page: Page, title: string) =>
		page.locator('section.content-page-canvas').filter({ has: page.locator('.bespoke-heading', { hasText: title }) });

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
		test(`every content kind is a paste-up at ${width} px`, async ({ page }) => {
			const problems = await open(page, width, `/i/${SLUG}`);

			// No page scrolls sideways, not even inside its own scroll box (corner tape at 320 px).
			const overflowing = await page.locator('.book-container > section').evaluateAll((sections) =>
				sections.filter((s) => s.scrollWidth > s.clientWidth + 1).map((s) => s.id)
			);
			expect(overflowing).toEqual([]);

			// Setlist: a typed sheet, taped, the last song underlined in marker.
			const setlist = pageTitled(page, 'Zine Setlist');
			await expect(setlist.locator('.setlist-sheet .tape')).toHaveCount(1);
			await expect(setlist.locator('.song-row')).toHaveCount(3);
			await expect(setlist.locator('.song-row').first()).toHaveCSS('font-family', /Special Elite/);
			const underline = await setlist
				.locator('.song-row.is-last .song-title')
				.evaluate((el) => getComputedStyle(el, '::after').borderBottomStyle);
			expect(underline).toBe('solid');
			await expect(setlist.locator('.song-row.is-last')).toContainText('Encore Song');

			// Photo: the title and words are a typed caption slip.
			const photo = pageTitled(page, 'Zine Photo');
			await expect(photo.locator('.photo-caption h2.bespoke-heading')).toHaveCSS('font-family', /Special Elite/);
			await expect(photo.locator('.photo-caption p.bespoke-body-text')).toHaveText('Caption body');

			// Text: the words are on a paper scrap.
			await expect(pageTitled(page, 'Zine Text').locator('.text-scrap p.bespoke-body-text')).toHaveText(
				'Words on a scrap.'
			);

			// Audio: a cassette with reels; the real track keeps the standard player.
			const demo = pageTitled(page, 'Zine Demo');
			await expect(demo.locator('.cassette .cassette-reel')).toHaveCount(2);
			await expect(pageTitled(page, 'Zine Track').locator('.cassette audio[controls]')).toHaveAttribute(
				'src',
				`${E2E_MEDIA_ORIGIN}/audio/zine.mp3`
			);

			// Video: each embed sits in a taped screen; a link out is a taped scrap.
			for (const title of ['Zine YouTube', 'Zine Vimeo', 'Zine Bandcamp']) {
				await expect(pageTitled(page, title).locator('.video-screen .tape'), title).toHaveCount(2);
			}
			await expect(pageTitled(page, 'Zine Link').locator('.video-link-card a.btn-action-highlight')).toBeVisible();

			// Text tilts at most about 2 degrees; the screen less than that.
			for (const tilt of await rotationOf(page, '.setlist-sheet, .cassette, .video-screen, .text-scrap, .photo-caption')) {
				expect(tilt).toBeLessThanOrEqual(2.05);
			}

			// AA contrast for the text on every new surface.
			for (const ratio of await contrastOf(
				page,
				'.song-title, .song-num, .song-tag, .cassette-title, .cassette-length, .text-scrap p, .photo-caption h2, .photo-caption p, .video-link-title'
			)) {
				expect(ratio).toBeGreaterThanOrEqual(4.5);
			}

			// Tape never covers a control on these pages either.
			const overlaps = await page.evaluate(() => {
				const hits: string[] = [];
				const controls = [...document.querySelectorAll('section.content-page-canvas :is(a[href], button, audio, input)')];
				for (const tape of document.querySelectorAll('section.content-page-canvas .tape')) {
					const a = tape.getBoundingClientRect();
					for (const c of controls) {
						const b = c.getBoundingClientRect();
						if (!b.width || !b.height) continue;
						const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
						const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
						if (x > 0.5 && y > 0.5) hits.push(c.textContent?.trim() || c.tagName);
					}
				}
				return hits;
			});
			expect(overlaps).toEqual([]);

			// Targets stay at least 44 px.
			for (const target of [
				demo.locator('button.audio-play-btn'),
				pageTitled(page, 'Zine YouTube').locator('button.video-facade-play'),
				pageTitled(page, 'Zine Vimeo').locator('button.video-facade-play')
			]) {
				const box = (await target.boundingBox())!;
				expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
			}

			expect(problems).toEqual([]);
		});
	}

	test('the mock cassette plays, and its reels turn', async ({ page }) => {
		await open(page, 390, `/i/${SLUG}`);
		const demo = pageTitled(page, 'Zine Demo');
		await demo.locator('button.audio-play-btn').click();
		await expect(demo.locator('button.audio-play-btn')).toHaveAttribute('aria-label', 'Pause track');
		// Svelte scopes the keyframes name with the component hash.
		await expect(demo.locator('.cassette-reel').first()).toHaveCSS('animation-name', /cassette-spin$/);
		await demo.locator('button.audio-play-btn').click();
		await expect(demo.locator('.cassette-reel').first()).toHaveCSS('animation-name', 'none');
	});

	test('with reduced motion the reels stay still', async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await open(page, 390, `/i/${SLUG}`);
		const demo = pageTitled(page, 'Zine Demo');
		await demo.locator('button.audio-play-btn').click();
		await expect(demo.locator('button.audio-play-btn')).toHaveAttribute('aria-label', 'Pause track');
		await expect(demo.locator('.cassette-reel').first()).toHaveCSS('animation-name', 'none');
	});

	test('videos in their screens still load only when tapped', async ({ page }) => {
		const problems = await open(page, 390, `/i/${SLUG}`);
		const youtube = pageTitled(page, 'Zine YouTube');
		await expect(youtube.locator('iframe')).toHaveCount(0);
		await expect(youtube.locator('img.video-poster-img')).toHaveAttribute(
			'src',
			'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
		);
		await youtube.locator('button[aria-label="Play Zine YouTube"]').click();
		await expect(youtube.locator('.video-screen iframe')).toHaveAttribute(
			'src',
			'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1'
		);

		const vimeo = pageTitled(page, 'Zine Vimeo');
		await expect(vimeo.locator('iframe')).toHaveCount(0);
		await vimeo.locator('button[aria-label="Play Zine Vimeo"]').click();
		await expect(vimeo.locator('.video-screen iframe')).toHaveAttribute(
			'src',
			'https://player.vimeo.com/video/76979871?autoplay=1'
		);

		await expect(pageTitled(page, 'Zine Bandcamp').locator('.video-screen iframe.bandcamp-iframe')).toBeAttached();
		expect(problems).toEqual([]);
	});
});

