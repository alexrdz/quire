import { test, expect } from '@playwright/test';

test('landing typography scales without breakpoint jumps or clipped simulator content', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	const readings = [];
	for (const width of [320, 390, 768, 859, 860, 861, 1023, 1024, 1025, 1240, 1600]) {
		await page.setViewportSize({ width, height: 1000 });
		readings.push(await page.locator('h1').evaluate((element) => ({
			font: parseFloat(getComputedStyle(element).fontSize),
			overflow: document.documentElement.scrollWidth > innerWidth
		})));
	}
	for (let i = 1; i < readings.length; i++) {
		expect(readings[i].font).toBeGreaterThanOrEqual(readings[i - 1].font);
		expect(readings[i].overflow).toBe(false);
	}
	await page.setViewportSize({ width: 390, height: 900 });
	for (const tab of ['Photo', 'Notes', 'Wall', 'Track']) {
		await page.getByRole('button', { name: tab, exact: true }).click();
		await expect(page.locator('.card-page')).toBeVisible();
		expect(await page.locator('.card-page').evaluate((element) =>
			element.scrollWidth <= element.clientWidth)).toBe(true);
	}
	await page.getByRole('button', { name: '1-Tap Tip', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Support The Neon Velvet' })).toBeVisible();
	await page.getByRole('button', { name: 'Close', exact: true }).first().click();
});

test('authentication forms reflow at narrow sizes with keyboard-visible focus', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 900 });
	await page.goto('/login');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await page.keyboard.press('Tab');
	expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
