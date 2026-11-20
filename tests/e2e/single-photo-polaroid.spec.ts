import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Locator, type Page } from '@playwright/test';
import { postAction } from './helpers/actions';
import { issueForCity, latestPhotoUrlForCity } from './helpers/db';
import { LOCAL_UPLOADS_DIR, TINY_PNG } from './helpers/upload-files';

/**
 * Every photo page renders through PhotoPile (Z-T01). A one-photo page, like
 * the one Quick Issue publishes, is a single tilted polaroid: it flips to its
 * caption when it has one, and it can never be tossed into an empty pile. The
 * pages are made here through the real actions, not taken from the seed.
 */

// Unique per run, so no cleanup write is needed.
const CITY = `Polaroidville ${Date.now().toString(36)}`;
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

/** The content page whose heading is `title`, scrolled into view. */
async function photoPage(page: Page, title: string): Promise<Locator> {
	const section = page
		.locator('section.content-page-canvas')
		.filter({ has: page.locator('.bespoke-heading', { hasText: title }) });
	await section.scrollIntoViewIfNeeded();
	return section;
}

async function expectTilted(card: Locator) {
	const transform = await card.evaluate((el) => getComputedStyle(el).transform);
	expect(transform, 'the polaroid rests at a tilt').not.toBe('none');
	expect(transform).not.toBe('matrix(1, 0, 0, 1, 0, 0)');
}

test('the Quick Issue photo is a single polaroid card, not a plain frame', async ({ page }) => {
	await page.goto(`/i/${issueSlug}`);
	const section = await photoPage(page, `${CITY} Photo`);

	await expect(section.locator('.polaroid')).toHaveCount(1);
	await expect(section.locator('.photo-page-frame')).toHaveCount(0);
	await expectTilted(section.locator('.polaroid'));
	await expect(section.locator('.polaroid img')).toHaveAttribute('src', photoUrl);

	// No caption: nothing to flip, so the card is not a button, and no pile controls.
	await expect(section.locator('button.polaroid-body')).toHaveCount(0);
	await expect(section.locator('.pile-controls')).toHaveCount(0);
	await expect(section.locator('.pile-counter')).toHaveCount(0);

	// A tap does nothing: the card never leaves for an empty pile.
	await section.locator('.polaroid-body').click();
	await expect(section.locator('.polaroid')).toHaveAttribute('data-state', 'top');
	await expect(section.locator('.pile-empty')).toHaveCount(0);
});

test('a captioned single photo flips to its caption on tap, Enter and Space', async ({ page }) => {
	await page.goto(`/i/${issueSlug}`);
	const section = await photoPage(page, CAPTIONED_TITLE);
	const card = section.locator('button.polaroid-body');

	await expect(section.locator('.polaroid')).toHaveCount(1);
	await expectTilted(section.locator('.polaroid'));
	await expect(section.locator('.polaroid-note')).toHaveText(CAPTION);
	// The caption lives on the back of the card, not in a paragraph under it.
	await expect(section.locator('p.bespoke-body-text', { hasText: CAPTION })).toHaveCount(0);

	// Only Flip: no counter, Back, Toss or Restack for one photo.
	const controls = section.locator('.pile-controls button');
	await expect(controls).toHaveText(['Flip']);
	await expect(section.locator('.pile-counter')).toHaveCount(0);

	await expect(card).toHaveAttribute('data-side', 'front');
	await card.click();
	await expect(card).toHaveAttribute('data-side', 'back');
	await card.click();
	await expect(card).toHaveAttribute('data-side', 'front');

	await card.focus();
	await page.keyboard.press('Enter');
	await expect(card).toHaveAttribute('data-side', 'back');
	await page.keyboard.press('Space');
	await expect(card).toHaveAttribute('data-side', 'front');

	// A swipe is not a toss for a single card.
	const box = (await card.boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2, { steps: 8 });
	await page.mouse.up();
	await expect(section.locator('.polaroid')).toHaveAttribute('data-state', 'top');
	await expect(section.locator('.pile-empty')).toHaveCount(0);
});

test('a two-photo pile still counts, tosses, clears and restacks', async ({ page }) => {
	await page.goto(`/i/${issueSlug}`);
	const section = await photoPage(page, PAIR_TITLE);

	await expect(section.locator('.polaroid')).toHaveCount(2);
	await expect(section.locator('.pile-counter')).toHaveText('01 / 02');
	const toss = section.locator('.pile-controls button', { hasText: 'Toss' });
	await toss.click();
	await expect(section.locator('.pile-counter')).toHaveText('02 / 02');
	await toss.click();
	await expect(section.locator('.pile-empty')).toBeVisible();
	await section.locator('.pile-controls button', { hasText: 'Restack' }).click();
	await expect(section.locator('.pile-counter')).toHaveText('01 / 02');
});
