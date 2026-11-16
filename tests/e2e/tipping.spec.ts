import { test, expect } from '@playwright/test';

test.describe('1-Tap Anonymous Tipping Flow', () => {
	test('opens tip drawer, selects preset, and sends tip in offline simulator', async ({ page }) => {
		await page.goto('/i/neon-velvet-brooklyn-2026-10-12');

		// Open tip drawer
		const tipButton = page.locator('button:has-text("Support Artist")');
		await tipButton.click();

		// Verify drawer opens
		await expect(page.locator('text=Tip The Neon Velvet')).toBeVisible();

		// Select $10 preset
		await page.locator('button:has-text("$10")').click();

		// Submit tip form
		const submitTip = page.locator('button:has-text("Send $10.00 Tip Now")');
		await submitTip.click();

		// Confirm tip success message appears
		await expect(page.locator('text=Tip Confirmed!')).toBeVisible({ timeout: 5000 });
	});
});
