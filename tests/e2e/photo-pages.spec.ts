import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { postAction } from './helpers/actions';
import { issueForCity, latestPhotoUrlForCity } from './helpers/db';
import { LOCAL_UPLOADS_DIR, TINY_PNG } from './helpers/upload-files';
import { announcement, expectCurrent, goToPageTitled } from './helpers/story';

/**
 * Photo pages in the Stories reader (ADR 0011, replacing the polaroid pile of
 * Z-T01): a one-photo page, like the one Quick Issue publishes, is one
 * full-screen photo and one segment of the progress bar; its caption sits over
 * a scrim. A two-photo page is two segments, paged by tap like any other. The
 * pages are made here through the real actions, not taken from the seed.
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

/** Taps the page on its right two-thirds (forward) or left third (back), clear of the bars. */
async function tap(page: Page, direction: 'forward' | 'back') {
	const box = (await page.locator('.story-column').boundingBox())!;
	await page.mouse.click(box.x + box.width * (direction === 'forward' ? 0.8 : 0.15), box.y + box.height * 0.4);
}

test('the Quick Issue photo is one full-screen photo and one segment', async ({ page }) => {
	await page.goto(`/i/${issueSlug}`);
	const frame = await goToPageTitled(page, `${CITY} Photo`);
	const section = frame.locator('section.story-photo');

	await expect(section.locator('img.story-photo-img')).toHaveCount(1);
	await expect(section.locator('img.story-photo-img.is-current')).toHaveAttribute('src', photoUrl);
	// It fills the page: no polaroid card, no pile controls, no "1 / 1" counter.
	const fill = await section.locator('img.story-photo-img').evaluate((el) => {
		const r = el.getBoundingClientRect();
		const p = el.closest('.story-column')!.getBoundingClientRect();
		return { w: Math.round(r.width - p.width), h: Math.round(r.height - p.height) };
	});
	expect(fill).toEqual({ w: 0, h: 0 });
	await expect(section.locator('.polaroid, .pile-controls')).toHaveCount(0);
	await expect(section.locator('.story-photo-count')).toHaveCount(0);
	await expect(section.locator('.story-photo-caption')).toHaveCount(0);
	// One bar per page, plus one for the two-photo page's second photo.
	await expect(page.locator('.story-progress-bar')).toHaveCount((await page.locator('.story-page').count()) + 1);
});

test('a captioned single photo shows its caption over the scrim, and a tap moves on to the next page', async ({ page }) => {
	await page.goto(`/i/${issueSlug}`);
	const frame = await goToPageTitled(page, CAPTIONED_TITLE);
	const id = (await frame.getAttribute('data-page-id'))!;

	await expect(frame.locator('.story-photo-caption')).toHaveText(CAPTION);
	await expect(frame.locator('.story-photo-caption')).toBeVisible();
	await expect(frame.locator('[data-scrim]')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.62)');

	await tap(page, 'forward');
	await expect(frame).toHaveAttribute('data-place', 'before');
	await tap(page, 'back');
	await expectCurrent(page, id);
	await expect(page).toHaveURL(new RegExp(`#${id}$`));
});

test('a two-photo page is two segments: tap through both, then back', async ({ page }) => {
	await page.goto(`/i/${issueSlug}`);
	const frame = await goToPageTitled(page, PAIR_TITLE);
	const id = (await frame.getAttribute('data-page-id'))!;
	const counter = frame.locator('.story-photo-count');

	await expect(frame.locator('img.story-photo-img')).toHaveCount(2);
	await expect(counter).toHaveText('1 / 2');
	await tap(page, 'forward');
	await expect(counter).toHaveText('2 / 2');
	await expect(page).toHaveURL(new RegExp(`#${id}-photo-2$`));
	await expect(announcement(page)).toHaveText(/photo 2 of 2$/);
	await tap(page, 'forward');
	await expect(frame).toHaveAttribute('data-place', 'before');
	await tap(page, 'back');
	await expectCurrent(page, id);
	await expect(counter).toHaveText('2 / 2');
	await tap(page, 'back');
	await expect(counter).toHaveText('1 / 2');
});
