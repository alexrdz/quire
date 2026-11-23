import { test, expect } from '@playwright/test';
import { createProductionArtist, resetProductionRateLimits, tipTapsFor } from '../helpers/production-db';

/**
 * ADR 0011 with decision 4 (tip-first Cover): in production a tip pill on the
 * Issue Cover is the real Venmo link, one tap from the Cover to Venmo, and the
 * tap is recorded as a Tip Tap. venmo.com is intercepted, so nothing leaves the
 * machine.
 */

test('a tip pill on the Cover opens the exact Venmo link and records a Tip Tap', async ({ page }) => {
	await resetProductionRateLimits();
	const artist = await createProductionArtist({
		displayName: 'The Cover Pill Band',
		venmoUsername: 'Cover-Pill-Band',
		tipPresets: [3, 5, 10]
	});
	const expected = 'https://venmo.com/Cover-Pill-Band?txn=pay&amount=10.00&note=Tip%20for%20The%20Cover%20Pill%20Band%20via%20Quire';
	const opened: string[] = [];
	await page.route(/^https:\/\/([a-z]+\.)?venmo\.com\//, (route) => {
		opened.push(route.request().url());
		return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Venmo stand-in</title>' });
	});

	await page.goto(`/i/${artist.issueSlug}`);
	const pill = page.locator('#page-cover a.venmo-tip-preset.story-tip-pill', { hasText: '$10' });
	await expect(pill).toBeVisible();
	await expect(pill).toHaveAttribute('href', expected);
	// No venue, city or date in the public Venmo note.
	expect(await pill.getAttribute('href')).not.toMatch(/2026|Philadelphia|Secret/);

	const tap = page.waitForRequest((req) => req.url().endsWith('/api/tip-tap') && req.method() === 'POST');
	await pill.click();
	await tap;
	await expect(page).toHaveURL(expected);
	expect(opened).toEqual([expected]);
	await expect
		.poll(async () => tipTapsFor(artist.artistId))
		.toContainEqual({ issueId: artist.issueId, amountSelectedCents: 1000 });
});
