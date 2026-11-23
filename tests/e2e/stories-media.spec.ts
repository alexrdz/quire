import { test, expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { E2E_MEDIA_ORIGIN, seedVideoFileIssue, seedZineContentIssue } from './helpers/db';
import { currentStoryPage, goToPageTitled } from './helpers/story';

/**
 * R-T02 (ADR 0011): the Stories reader's Video and Audio pages.
 *
 * - An uploaded clip fills the page (portrait cropped to fill, landscape whole on
 *   black), plays muted and inline when its page opens and pauses when the Fan
 *   leaves, with a 44 px unmute button. Its native controls, and taps inside an
 *   embed's iframe, never page the reader.
 * - YouTube and Vimeo stay a tap-to-load facade; Bandcamp is centred; a link out
 *   is a card with a button.
 * - The audio page: cover art, the title, and a player (56 px play button, scrubber,
 *   time) that works from the keyboard and pauses when its page is left.
 *
 * Moved here from zine-content-pages.spec.ts (B1-T27): the facade buttons and their
 * labels, the embeds' src after a tap, Bandcamp, the link card, and the audio title,
 * length and source.
 */

// One real clip (a 1 s, 180x320 VP9 WebM) stands in for every uploaded file the seeds name.
const CLIP = readFileSync(path.resolve('tests/e2e/fixtures/portrait-clip.webm'));
const TINY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);

const VIDEO_SLUG = `stories-video-${crypto.randomUUID().slice(0, 8)}`;
const MEDIA_SLUG = `stories-media-${crypto.randomUUID().slice(0, 8)}`;

test.beforeAll(async ({ request }) => {
	// The first request seeds the sample Artist the Issues belong to.
	await request.get('/');
	await seedVideoFileIssue(VIDEO_SLUG);
	await seedZineContentIssue(MEDIA_SLUG);
});

/** Opens an Issue with every outside service stubbed; returns the CSP problems and page errors seen. */
async function open(page: Page, width: number, slug: string): Promise<string[]> {
	const problems: string[] = [];
	page.on('console', (msg) => {
		if (/Content Security Policy|Refused to/i.test(msg.text())) problems.push(msg.text());
	});
	page.on('pageerror', (error) => problems.push(error.message));
	await page.setViewportSize({ width, height: 844 });
	const clip = (contentType: string) => (route: import('@playwright/test').Route) =>
		route.fulfill({ status: 200, contentType, body: CLIP });
	await page.route('**/uploads/videos/**', clip('video/webm'));
	await page.route(`${E2E_MEDIA_ORIGIN}/**/*.mp3`, clip('audio/webm'));
	for (const pattern of ['https://images.unsplash.com/**', `${E2E_MEDIA_ORIGIN}/**/*.webp`, 'https://i.ytimg.com/**']) {
		await page.route(pattern, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG }));
	}
	for (const host of ['https://www.youtube-nocookie.com/**', 'https://player.vimeo.com/**', 'https://bandcamp.com/**']) {
		await page.route(host, (route) =>
			route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>stub</title><p>stub</p>' })
		);
	}
	await page.goto(`/i/${slug}`);
	return problems;
}

const playing = (video: Locator) =>
	video.evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0);

/** WCAG contrast of each element's text against the first opaque background behind it. */
function contrastOf(scope: Locator, selector: string) {
	return scope.locator(selector).evaluateAll((els) =>
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
				const parts = rgb(getComputedStyle(node).backgroundColor);
				if (parts.length >= 3 && (parts.length < 4 || parts[3] === 1)) {
					background = getComputedStyle(node).backgroundColor;
					break;
				}
				node = node.parentElement;
			}
			const [a, b] = [lum(rgb(getComputedStyle(el).color)), lum(rgb(background))].sort((x, y) => y - x);
			return { text: el.textContent?.trim().slice(0, 30), ratio: (a + 0.05) / (b + 0.05) };
		})
	);
}

/** Layout size (ignores the page's slide). */
const sizeOf = (target: Locator) =>
	target.evaluate((el) => ({ w: (el as HTMLElement).offsetWidth, h: (el as HTMLElement).offsetHeight }));

async function noSidewaysScroll(page: Page) {
	expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
	const overflowing = await page
		.locator('.story-page > section')
		.evaluateAll((sections) => sections.filter((s) => s.scrollWidth > s.clientWidth + 1).map((s) => s.id));
	expect(overflowing).toEqual([]);
}

for (const width of [320, 390]) {
	test(`an uploaded clip fills the page, plays when its page opens, pauses on leaving, and unmutes (${width} px)`, async ({ page }) => {
		const problems = await open(page, width, VIDEO_SLUG);

		const portraitPage = await goToPageTitled(page, 'Portrait Clip');
		const portrait = portraitPage.locator('video.story-video-clip');
		// Fills the page: full width, from the top down to the bottom bar, cropped to fill.
		const box = await portrait.evaluate((v) => {
			const r = v.getBoundingClientRect();
			const section = v.closest('section')!.getBoundingClientRect();
			return { w: r.width, sw: section.width, top: r.top - section.top, h: r.height, sh: section.height, fit: getComputedStyle(v).objectFit };
		});
		expect(box.w).toBeCloseTo(box.sw, 0);
		expect(box.top).toBeCloseTo(0, 0);
		expect(box.h).toBeGreaterThan(box.sh * 0.75);
		expect(box.fit).toBe('cover');
		await expect(portrait).toHaveAttribute('playsinline', '');

		// Plays muted when its page opens.
		await expect.poll(() => playing(portrait), { message: 'the portrait clip plays' }).toBe(true);
		expect(await portrait.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);

		// Unmute, then mute again: one clear 44 px button.
		const mute = portraitPage.getByRole('button', { name: 'Unmute video' });
		const size = await sizeOf(mute);
		expect(Math.min(size.w, size.h)).toBeGreaterThanOrEqual(44);
		await mute.click();
		expect(await portrait.evaluate((v: HTMLVideoElement) => v.muted)).toBe(false);
		await expect(portraitPage.getByRole('button', { name: 'Mute video' })).toHaveAttribute('aria-pressed', 'true');
		await portraitPage.getByRole('button', { name: 'Mute video' }).click();
		expect(await portrait.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);

		// Leaving the page pauses it; the next clip plays, whole on black.
		const landscapePage = await goToPageTitled(page, 'Landscape Clip');
		await expect.poll(() => portrait.evaluate((v: HTMLVideoElement) => v.paused), { message: 'the portrait clip pauses' }).toBe(true);
		const landscape = landscapePage.locator('video.story-video-clip');
		await expect(landscape).toHaveCSS('object-fit', 'contain');
		await expect(landscape).toHaveCSS('background-color', 'rgb(0, 0, 0)');
		await expect.poll(() => playing(landscape), { message: 'the landscape clip plays' }).toBe(true);

		// AA text over the scrim.
		for (const { text, ratio } of await contrastOf(landscapePage, '.story-media-title, .story-media-body')) {
			expect(ratio, text).toBeGreaterThanOrEqual(4.5);
		}
		await noSidewaysScroll(page);
		expect(problems).toEqual([]);
	});
}

test("taps on a clip's native controls never page the reader", async ({ page }) => {
	await open(page, 390, VIDEO_SLUG);
	const frame = await goToPageTitled(page, 'Portrait Clip');
	const id = await frame.getAttribute('data-page-id');
	const video = frame.locator('video.story-video-clip');
	const r = (await video.boundingBox())!;
	// The control bar along the bottom of the player (right two-thirds: a "forward" tap anywhere else),
	// and the middle of the picture.
	for (const [x, y] of [
		[r.x + r.width * 0.85, r.y + r.height - 20],
		[r.x + r.width * 0.5, r.y + r.height - 20],
		[r.x + r.width * 0.8, r.y + r.height * 0.4]
	]) {
		await page.mouse.click(x, y);
		await page.waitForTimeout(350);
		await expect(currentStoryPage(page)).toHaveAttribute('data-page-id', id!);
	}
	// The same tap on the caption, which is not a control, does page forward: the check above can see paging.
	const caption = (await frame.locator('.story-video-caption').boundingBox())!;
	await page.mouse.click(caption.x + caption.width * 0.8, caption.y + caption.height / 2);
	await expect(currentStoryPage(page)).not.toHaveAttribute('data-page-id', id!);
});

for (const width of [320, 390]) {
	test(`embeds and the link out: facades, centred players, a link card, and taps inside never page (${width} px)`, async ({ page }) => {
		const problems = await open(page, width, MEDIA_SLUG);

		// YouTube: a facade (poster and a labelled play button) until tapped, then the no-cookie player.
		const youtube = await goToPageTitled(page, 'Zine YouTube');
		await expect(youtube.locator('iframe')).toHaveCount(0);
		await expect(youtube.locator('img.story-embed-poster')).toHaveAttribute('src', 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
		const ytPlay = youtube.getByRole('button', { name: 'Play Zine YouTube' });
		expect(Math.min(...Object.values(await sizeOf(ytPlay)))).toBeGreaterThanOrEqual(44);
		await ytPlay.click();
		const ytFrame = youtube.locator('.story-embed iframe');
		await expect(ytFrame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1');
		// Centred at 16:9 on black.
		const embed = await youtube.locator('.story-embed').evaluate((el) => {
			const r = el.getBoundingClientRect();
			const s = el.closest('section')!.getBoundingClientRect();
			return { ratio: r.width / r.height, left: r.left - s.left, right: s.right - r.right };
		});
		expect(embed.ratio).toBeCloseTo(16 / 9, 1);
		expect(Math.abs(embed.left - embed.right)).toBeLessThanOrEqual(1);
		// A tap inside the player stays in the player.
		const id = await youtube.getAttribute('data-page-id');
		const f = (await ytFrame.boundingBox())!;
		await page.mouse.click(f.x + f.width * 0.8, f.y + f.height / 2);
		await page.waitForTimeout(350);
		await expect(currentStoryPage(page)).toHaveAttribute('data-page-id', id!);

		// Vimeo: the same facade.
		const vimeo = await goToPageTitled(page, 'Zine Vimeo');
		await expect(vimeo.locator('iframe')).toHaveCount(0);
		const vPlay = vimeo.getByRole('button', { name: 'Play Zine Vimeo' });
		expect(Math.min(...Object.values(await sizeOf(vPlay)))).toBeGreaterThanOrEqual(44);
		await vPlay.click();
		await expect(vimeo.locator('.story-embed iframe')).toHaveAttribute('src', 'https://player.vimeo.com/video/76979871?autoplay=1');

		// Bandcamp: its player, centred.
		const bandcamp = await goToPageTitled(page, 'Zine Bandcamp');
		await expect(bandcamp.locator('iframe.story-bandcamp')).toBeAttached();

		// A link out: a clean card with one 44 px button.
		const link = await goToPageTitled(page, 'Zine Link');
		const button = link.locator('.story-link-card a.story-link-button');
		await expect(button).toHaveAttribute('href', 'https://example.com/watch');
		expect((await sizeOf(button)).h).toBeGreaterThanOrEqual(44);
		for (const { text, ratio } of await contrastOf(link, '.story-link-kind, .story-media-title, .story-link-button')) {
			expect(ratio, text).toBeGreaterThanOrEqual(4.5);
		}

		await noSidewaysScroll(page);
		expect(problems).toEqual([]);
	});

	test(`the audio page: cover art, title, length, and a keyboard player that pauses on leaving (${width} px)`, async ({ page }) => {
		const problems = await open(page, width, MEDIA_SLUG);

		// The demo preview (no file): title, length, and a 56 px play button the keyboard drives.
		const demo = await goToPageTitled(page, 'Zine Demo');
		await expect(demo.locator('.story-audio-art')).toBeVisible();
		await expect(demo.locator('.story-time')).toContainText('3:42');
		const play = demo.getByRole('button', { name: 'Play Zine Demo' });
		const size = await sizeOf(play);
		expect(size.w).toBeGreaterThanOrEqual(56);
		expect(size.h).toBeGreaterThanOrEqual(56);
		await play.focus();
		await page.keyboard.press('Enter');
		await expect(demo.getByRole('button', { name: 'Pause Zine Demo' })).toBeFocused();
		await page.keyboard.press('Space');
		await expect(demo.getByRole('button', { name: 'Play Zine Demo' })).toBeVisible();
		// The scrubber moves with the arrow keys and says where it is.
		const scrubber = demo.getByRole('slider', { name: 'Seek in Zine Demo' });
		expect((await sizeOf(scrubber)).h).toBeGreaterThanOrEqual(44);
		await scrubber.focus();
		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('ArrowRight');
		await expect(scrubber).toHaveAttribute('aria-valuetext', '0:02 of 3:42');
		await expect(currentStoryPage(page)).toHaveAttribute('data-page-id', (await demo.getAttribute('data-page-id'))!);

		// A real track: its source, its length, and play and pause from the keyboard.
		const track = await goToPageTitled(page, 'Zine Track');
		const audio = track.locator('audio');
		await expect(audio).toHaveAttribute('src', `${E2E_MEDIA_ORIGIN}/audio/zine.mp3`);
		await expect(track.locator('.story-time')).toContainText(/\d:\d\d/);
		// The stand-in file is 1 s long: loop it, so it is still playing when the Fan leaves.
		await audio.evaluate((a: HTMLAudioElement) => (a.loop = true));
		await track.getByRole('button', { name: 'Play Zine Track' }).focus();
		await page.keyboard.press('Enter');
		await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => !a.paused)).toBe(true);
		await expect(track.getByRole('button', { name: 'Pause Zine Track' })).toBeVisible();
		await page.waitForTimeout(1500);
		expect(await audio.evaluate((a: HTMLAudioElement) => !a.paused), 'still playing before leaving').toBe(true);

		// Leaving the page pauses it.
		await goToPageTitled(page, 'Zine YouTube');
		await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.paused), { message: 'the track pauses' }).toBe(true);

		for (const { text, ratio } of await contrastOf(track, '.story-audio-title, .story-audio-artist, .story-time span')) {
			expect(ratio, text).toBeGreaterThanOrEqual(4.5);
		}
		await noSidewaysScroll(page);
		expect(problems).toEqual([]);
	});
}
