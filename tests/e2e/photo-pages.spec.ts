import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { postAction } from './helpers/actions';
import { issueForCity, latestPhotoUrlForCity } from './helpers/db';
import { LOCAL_UPLOADS_DIR, TINY_PNG } from './helpers/upload-files';
import { currentStoryPage, goToPageTitled } from './helpers/story';

/**
 * Photo pages in the Stories reader with the polaroid stack back (B1-T35, amending
 * ADR 0011). A photo page is one segment of the progress bar, whatever its photos;
 * the stack handles them inside it. A tap or drag that starts on the stack tosses or
 * flips it and never changes the page; a tap outside it, a swipe outside it, Next and
 * the arrow keys still page. The pages are made here through the real actions.
 */

// Unique per run, so no cleanup write is needed.
const CITY = `Photoville ${Date.now().toString(36)}`;
const CAPTION = 'Front row, second encore';
const CAPTIONED_TITLE = 'One Captioned Photo';
const PAIR_TITLE = 'Two Photos';

let issueSlug: string;
let photoUrl: string;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser, baseURL }) => {
	const page = await browser.newPage({ baseURL });
	await page.goto('/demo');
	await expect(page).toHaveURL(/\/dashboard/);

	const quick = await postAction(page.request, baseURL!, '/dashboard/issues/quick', {
		city: CITY,
		venue: 'The Single Print',
		date: '2026-11-20',
		timezone: 'America/New_York',
		saveMode: 'published',
		photoFile: { name: 'photo.png', mimeType: 'image/png', buffer: TINY_PNG }
	});
	expect(quick.type, 'Quick Issue publishes').toBe('success');

	const issue = await issueForCity(CITY);
	const url = await latestPhotoUrlForCity(CITY);
	expect(issue).not.toBeNull();
	expect(url).toMatch(/^\/uploads\/.+\.webp$/);
	issueSlug = issue!.slug;
	photoUrl = url!;

	for (const [title, photos] of [
		[CAPTIONED_TITLE, [{ url: photoUrl, caption: CAPTION }]],
		[PAIR_TITLE, [{ url: photoUrl, caption: '' }, { url: photoUrl, caption: '' }]]
	] as const) {
		const added = await postAction(page.request, baseURL!, `/dashboard/bookbinder/${issue!.id}?/addPage`, {
			kind: 'photo',
			title,
			keepPhotoUrl: photos.map((p) => p.url),
			keepPhotoCaption: photos.map((p) => p.caption)
		});
		expect(added.type, `${title} is added`).toBe('success');
	}
	await page.close();
});

test.afterAll(() => {
	if (photoUrl) fs.rmSync(path.join(LOCAL_UPLOADS_DIR, path.basename(photoUrl)), { force: true });
});

/** The id of the page on screen. */
const currentId = (page: Page) => currentStoryPage(page).getAttribute('data-page-id');

async function noSidewaysScroll(page: Page) {
	expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
	const overflowing = await page
		.locator('.story-page > section, .story-photo-stage')
		.evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.id || el.className));
	expect(overflowing).toEqual([]);
}

test('a photo page is one segment of the progress bar, whatever its photos', async ({ page }) => {
	await page.goto(`/i/${issueSlug}`);
	await goToPageTitled(page, PAIR_TITLE);
	// The Cover, three photo pages (Quick Issue, the captioned single, the pair), the Wall and the Endpaper.
	const pages = await page.locator('.story-page').count();
	await expect(page.locator('.story-progress-bar')).toHaveCount(pages);
	// No per-photo place in the URL.
	expect(new URL(page.url()).hash).not.toMatch(/-photo-\d+$/);
});

for (const width of [320, 390]) {
	test(`the stack owns its gestures: a drag tosses and a tap flips, and neither pages (${width} px)`, async ({ page }) => {
		await page.setViewportSize({ width, height: 844 });
		await page.goto(`/i/${issueSlug}`);
		const frame = await goToPageTitled(page, PAIR_TITLE);
		const here = await currentId(page);
		const counter = frame.locator('.pile-counter');
		await expect(counter).toHaveText('01 / 02');

		// A drag across the top card tosses it.
		const top = frame.locator('.polaroid[data-state="top"] .polaroid-body');
		const box = (await top.boundingBox())!;
		await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width * 0.5 + 160, box.y + box.height * 0.5, { steps: 10 });
		await page.mouse.up();
		await expect(counter).toHaveText('02 / 02');
		await page.waitForTimeout(350);
		expect(await currentId(page), 'a drag on the stack does not page').toBe(here);

		// A tap on the last (uncaptioned) card tosses it to the end of the pile, still on this page.
		await frame.locator('.polaroid[data-state="top"] .polaroid-body').click();
		await expect(frame.locator('.pile-empty')).toBeVisible();
		await page.waitForTimeout(350);
		expect(await currentId(page), 'a tap on the stack does not page').toBe(here);
		await frame.locator('.pile-controls').getByRole('button', { name: 'Restack', exact: true }).click();
		await expect(counter).toHaveText('01 / 02');

		// The captioned single flips on a tap, and stays.
		const single = await goToPageTitled(page, CAPTIONED_TITLE);
		const singleId = await currentId(page);
		const card = single.locator('button.polaroid-body');
		await card.click();
		await expect(card).toHaveAttribute('data-side', 'back');
		await expect(single.locator('.polaroid-note')).toHaveText(CAPTION);
		await page.waitForTimeout(350);
		expect(await currentId(page), 'a flip does not page').toBe(singleId);

		// 44 px targets: the stack's buttons.
		const pair = await goToPageTitled(page, PAIR_TITLE);
		for (const button of await pair.locator('.pile-controls button').all()) {
			const size = await button.evaluate((el) => ({ w: (el as HTMLElement).offsetWidth, h: (el as HTMLElement).offsetHeight }));
			expect(Math.min(size.w, size.h), (await button.textContent()) ?? "a pile button").toBeGreaterThanOrEqual(44);
		}
		await noSidewaysScroll(page);
	});
}

test('outside the stack the page still pages: a tap, a swipe, Next and the arrow keys', async ({ page }) => {
	await page.goto(`/i/${issueSlug}`);
	const frame = await goToPageTitled(page, PAIR_TITLE);
	const pairId = (await currentId(page))!;

	// A tap on the right of the page, on the title under the stack (not part of it), goes forward.
	const column = (await page.locator('.story-column').boundingBox())!;
	const title = (await frame.locator('h2.story-photo-title').boundingBox())!;
	await page.mouse.click(column.x + column.width * 0.85, title.y + title.height / 2);
	await expect.poll(() => currentId(page)).not.toBe(pairId);

	// The left arrow comes back; the right arrow goes on; Next goes on.
	await page.keyboard.press('ArrowLeft');
	await expect.poll(() => currentId(page)).toBe(pairId);
	await page.keyboard.press('ArrowRight');
	await expect.poll(() => currentId(page)).not.toBe(pairId);
	await page.keyboard.press('ArrowLeft');
	await expect.poll(() => currentId(page)).toBe(pairId);
	await page.locator('button.story-next').click();
	await expect.poll(() => currentId(page)).not.toBe(pairId);

	// A swipe that starts outside the stack (on the title) pages back.
	await page.keyboard.press('ArrowLeft');
	await expect.poll(() => currentId(page)).toBe(pairId);
	const title2 = (await frame.locator('h2.story-photo-title').boundingBox())!;
	await page.mouse.move(column.x + column.width * 0.2, title2.y + title2.height / 2);
	await page.mouse.down();
	await page.mouse.move(column.x + column.width * 0.8, title2.y + title2.height / 2, { steps: 10 });
	await page.mouse.up();
	await expect.poll(() => currentId(page)).not.toBe(pairId);
});

test('with reduced motion, tosses and flips are fades: nothing flies or spins', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(`/i/${issueSlug}`);
	const frame = await goToPageTitled(page, PAIR_TITLE);
	const style = (selector: string) =>
		frame.locator(selector).first().evaluate((el) => {
			const cs = getComputedStyle(el);
			return { property: cs.transitionProperty, duration: cs.transitionDuration, transform: cs.transform };
		});

	// The card only fades: no transform is animated.
	const card = await style('.polaroid');
	expect(card.property).toBe('opacity');
	expect(parseFloat(card.duration)).toBeGreaterThan(0);

	// A toss fades the top card out where it lies: it does not move sideways.
	const top = frame.locator('.polaroid[data-state="top"]');
	const before = (await top.boundingBox())!;
	const tossed = frame.locator('.polaroid').first();
	await frame.locator('.pile-controls').getByRole('button', { name: 'Toss', exact: true }).click();
	await expect(frame.locator('.pile-counter')).toHaveText('02 / 02');
	await expect(tossed).toHaveAttribute('data-state', 'tossed');
	await expect(tossed).toHaveCSS('opacity', '0');
	const after = (await tossed.boundingBox())!;
	expect(Math.abs(after.x - before.x), 'the tossed card stays in place').toBeLessThan(20);

	// A flip cross-fades: the card never rotates, and the back's words read the right way round.
	const single = await goToPageTitled(page, CAPTIONED_TITLE);
	const body = single.locator('button.polaroid-body');
	await body.click();
	await expect(body).toHaveAttribute('data-side', 'back');
	await expect(body).toHaveCSS('transform', 'none');
	await expect(single.locator('.polaroid-back')).toHaveCSS('opacity', '1');
	await expect(single.locator('.polaroid-back')).toHaveCSS('transform', 'none');
	await expect(single.locator('.polaroid-front')).toHaveCSS('opacity', '0');
	await expect(single.locator('.polaroid-note')).toHaveText(CAPTION);
});
