import { test, expect, type Page } from '@playwright/test';
import { addLegacyQuickPhotoPage, issueForCity } from './helpers/db';

/**
 * Z-T07: Quick Issue saves the photo caption on the back of the polaroid, so a
 * published Quick Issue photo flips to it. A photo without a caption is a still
 * card. Pages published before (caption saved as the page body) still render.
 */

const RUN = Date.now().toString(36);
const PHOTO_URL = 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a';
const CAPTION = 'Soundcheck from the balcony';
const TINY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);

test.describe.configure({ mode: 'serial' });

/** Fills and publishes the Quick Issue form as an Artist would. */
async function publishQuickIssue(page: Page, city: string, caption: string): Promise<string> {
	await page.goto('/demo');
	await expect(page).toHaveURL(/\/dashboard/);
	await page.goto('/dashboard/issues/quick');
	await page.getByLabel('City *').fill(city);
	await page.getByLabel('Venue or Busking Spot *').fill('The Back of the Print');
	await page.getByLabel('Gig Date *').fill('2026-11-20');
	await page.locator('#photoUrl').fill(PHOTO_URL);
	const captionInput = page.getByLabel('Photo Caption (Optional)');
	await expect(captionInput).toHaveAttribute('maxlength', '140');
	await expect(captionInput).toHaveAccessibleDescription('Written on the back of the photo: fans flip it to read.');
	if (caption) await captionInput.fill(caption);
	await page.getByRole('button', { name: /publish/i }).first().click();

	await expect.poll(async () => (await issueForCity(city))?.slug ?? null, { timeout: 10000 }).not.toBeNull();
	return (await issueForCity(city))!.slug;
}

async function photoSection(page: Page, title: string) {
	const section = page
		.locator('section.content-page-canvas')
		.filter({ has: page.locator('.bespoke-heading', { hasText: title }) });
	await section.scrollIntoViewIfNeeded();
	return section;
}

test.beforeEach(async ({ page }) => {
	// No network in e2e: Unsplash answers with a tiny PNG. The CSP still applies to the URL.
	await page.route('https://images.unsplash.com/**', (route) =>
		route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG })
	);
});

test('publish a Quick Issue with a captioned photo, open it, and flip the polaroid to the caption', async ({ page }) => {
	const city = `Flipton ${RUN}`;
	const slug = await publishQuickIssue(page, city, CAPTION);

	await page.goto(`/i/${slug}`);
	const section = await photoSection(page, `${city} Photo`);
	await expect(section.locator('.polaroid')).toHaveCount(1);
	await expect(section.locator('.polaroid img')).toHaveAttribute('src', PHOTO_URL);
	await expect(section.locator('.polaroid-note')).toHaveText(CAPTION);
	// The caption is on the back of the card, not a paragraph under the photo.
	await expect(section.locator('p.bespoke-body-text', { hasText: CAPTION })).toHaveCount(0);

	const card = section.locator('button.polaroid-body');
	await expect(card).toHaveAttribute('data-side', 'front');
	await card.click();
	await expect(card).toHaveAttribute('data-side', 'back');
	await expect(section.locator('.polaroid-note')).toBeVisible();
	await card.click();
	await expect(card).toHaveAttribute('data-side', 'front');
});

test('a Quick Issue photo without a caption is a single card that does not flip', async ({ page }) => {
	const city = `Stillton ${RUN}`;
	const slug = await publishQuickIssue(page, city, '');

	await page.goto(`/i/${slug}`);
	const section = await photoSection(page, `${city} Photo`);
	await expect(section.locator('.polaroid')).toHaveCount(1);
	await expect(section.locator('button.polaroid-body')).toHaveCount(0);
	await expect(section.locator('.pile-controls')).toHaveCount(0);
});

test('an older Quick Issue page, with its caption as the body, still renders it', async ({ page }) => {
	const city = `Oldtown ${RUN}`;
	const slug = await publishQuickIssue(page, city, '');
	const issue = await issueForCity(city);
	await addLegacyQuickPhotoPage(issue!.id, { title: 'Older Quick Photo', imageUrl: PHOTO_URL, body: CAPTION });

	await page.goto(`/i/${slug}`);
	const section = await photoSection(page, 'Older Quick Photo');
	await expect(section.locator('.polaroid')).toHaveCount(1);
	await expect(section.locator('.polaroid img')).toHaveAttribute('src', PHOTO_URL);
	await expect(section.locator('p.bespoke-body-text')).toHaveText(CAPTION);
});
