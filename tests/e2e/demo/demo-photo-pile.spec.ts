import { test, expect } from '@playwright/test';
import { BROOKLYN_ISSUE_PATH, PHILLY_ISSUE_PATH, pileOn, walkPile, watchPage } from '../helpers/photo-pile';

/**
 * B1-T03: the Demo seeds itself from the same sample data (and reseeds
 * nightly), so its Issues show the captioned piles too, under the Demo's CSP.
 */

test('the Demo Issues show the Brooklyn and Philadelphia photo piles with no CSP violations', async ({ page }) => {
	const problems = await watchPage(page);

	await page.goto(BROOKLYN_ISSUE_PATH);
	const brooklyn = await walkPile(page);
	expect(brooklyn.length).toBeGreaterThanOrEqual(4);
	expect(brooklyn.length).toBeLessThanOrEqual(5);
	expect(brooklyn).toContain(null);

	await page.goto(PHILLY_ISSUE_PATH);
	await expect(pileOn(page).locator('.polaroid')).toHaveCount(3);
	expect((await walkPile(page)).every(Boolean)).toBe(true);

	expect(await problems()).toEqual([]);
});
