import { test, expect } from '@playwright/test';
import { BROOKLYN_ISSUE_PATH, PHILLY_ISSUE_PATH, photoPageOn, walkPhotos, watchPage } from './helpers/photo-pile';

/**
 * B1-T03 in the Stories reader (ADR 0011, replacing the polaroid pile): the
 * sample Issues' Tour Diary pages are several full-screen photos, each its own
 * segment. The Brooklyn page has 4 or 5 photos, most captioned and at least one
 * bare; the Philadelphia page has 3 captioned photos.
 */

test.describe('sample Issue photo pages (test mode)', () => {
	test.beforeAll(async ({ request }) => {
		// The first request seeds the sample data on a fresh database.
		await request.get(BROOKLYN_ISSUE_PATH);
	});

	test('Brooklyn: 4 or 5 photo segments, most captioned, one bare, every photo loads, no CSP violations', async ({
		page
	}) => {
		const problems = await watchPage(page);
		await page.goto(BROOKLYN_ISSUE_PATH);
		const frame = photoPageOn(page);
		await expect(frame.locator('h2.story-photo-title')).toHaveText('Tour Diary: Brooklyn Kickoff');
		const count = await frame.locator('img.story-photo-img').count();
		expect(count).toBeGreaterThanOrEqual(4);
		expect(count).toBeLessThanOrEqual(5);

		const captions = await walkPhotos(page);
		const captioned = captions.filter(Boolean);
		expect(captioned.length).toBeGreaterThan(count / 2);
		expect(captions).toContain(null);
		expect(await problems()).toEqual([]);
	});

	test('Philadelphia: 3 captioned photo segments, every photo loads, no CSP violations', async ({ page }) => {
		const problems = await watchPage(page);
		await page.goto(PHILLY_ISSUE_PATH);
		await expect(photoPageOn(page).locator('img.story-photo-img')).toHaveCount(3);

		const captions = await walkPhotos(page);
		expect(captions).toHaveLength(3);
		expect(captions.every(Boolean)).toBe(true);
		expect(await problems()).toEqual([]);
	});
});
