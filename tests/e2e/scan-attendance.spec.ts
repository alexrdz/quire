import { test, expect } from '@playwright/test';

test.describe('Physical QR Scan & Attendance Flow', () => {
	// The seed keeps this sample Issue's Stamp Window open relative to seed time.
	test('scanning with valid secret key sets attendance cookie and redirects to cover', async ({ page }) => {
		// Valid secret from seed
		const response = await page.goto('/scan/neon-velvet-brooklyn-2026-10-12?k=kickoff_babys_secret_2026');
		expect(response?.status()).toBeLessThan(400);

		// Verified redirect to issue cover
		await expect(page).toHaveURL(/\/i\/neon-velvet-brooklyn-2026-10-12/);

		// Check for attendance stamp indicator
		await expect(page.locator('text=Attended Stamp Eligible')).toBeVisible();
	});

	test('visiting scan endpoint without secret fails with 400', async ({ page }) => {
		const response = await page.goto('/scan/neon-velvet-brooklyn-2026-10-12');
		expect(response?.status()).toBe(400);
	});

	test('direct link to issue cover allows reading but does NOT grant stamp eligibility', async ({ page, context }) => {
		// Clear cookies
		await context.clearCookies();

		await page.goto('/i/neon-velvet-brooklyn-2026-10-12');
		await expect(page.locator('h1.cover-title')).toHaveText('Brooklyn');

		// "Attended Stamp Eligible" should NOT be present on direct link visit
		await expect(page.locator('text=Attended Stamp Eligible')).not.toBeVisible();
	});
});
