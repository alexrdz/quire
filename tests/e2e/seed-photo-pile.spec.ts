import { test, expect } from '@playwright/test';
import { BROOKLYN_ISSUE_PATH, PHILLY_ISSUE_PATH, pileOn, walkPile, watchPage } from './helpers/photo-pile';

/**
 * B1-T03, seed data: the sample Issues seeded by `src/lib/server/seed.ts` show
 * their Tour Diary pages as captioned polaroid piles. The Brooklyn pile has 4
 * or 5 photos, most of which flip to a caption and at least one which doesn't;
 * the Philadelphia pile has 3 captioned photos. The pile component itself is
 * covered by `photo-pile.spec.ts`; this file only checks the seeded content.
 */

test.describe('sample Issue photo piles (test mode)', () => {
	test.beforeAll(async ({ request }) => {
		// The first request seeds the sample data on a fresh database.
		await request.get(BROOKLYN_ISSUE_PATH);
	});

	test('Brooklyn: a pile of 4 or 5, most captioned and flipping, one bare, every photo loads, no CSP violations', async ({
		page
	}) => {
		const problems = await watchPage(page);
		await page.goto(BROOKLYN_ISSUE_PATH);
		const stage = pileOn(page);
		await expect(stage).toHaveAttribute('aria-label', 'Tour Diary: Brooklyn Kickoff');
		const count = await stage.locator('.polaroid').count();
		expect(count).toBeGreaterThanOrEqual(4);
		expect(count).toBeLessThanOrEqual(5);
		await expect(page.locator('.pile-counter')).toHaveText(`01 / ${String(count).padStart(2, '0')}`);

		const captions = await walkPile(page);
		const captioned = captions.filter(Boolean);
		expect(captioned.length).toBeGreaterThan(count / 2);
		expect(captions).toContain(null);
		expect(await problems()).toEqual([]);
	});

	test('Philadelphia: a pile of 3 captioned photos, every photo loads, no CSP violations', async ({ page }) => {
		const problems = await watchPage(page);
		await page.goto(PHILLY_ISSUE_PATH);
		await expect(pileOn(page).locator('.polaroid')).toHaveCount(3);

		const captions = await walkPile(page);
		expect(captions).toHaveLength(3);
		expect(captions.every(Boolean)).toBe(true);
		expect(await problems()).toEqual([]);
	});
});
