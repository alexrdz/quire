import { test, expect } from '@playwright/test';

test.describe('Dashboard & Desktop Bookbinder Flow', () => {
	test('logs in via demo quick-switch and accesses morning-after recap', async ({ page }) => {
		// Jump in via demo
		await page.goto('/demo');

		// Redirects to dashboard
		await expect(page).toHaveURL(/\/dashboard/);
		await expect(page.locator('h1')).toContainText('The Neon Velvet');

		// Verify Gig Recap stats are visible
		await expect(page.locator('text=Morning-After Gig Recap')).toBeVisible();
		await expect(page.getByTestId('recap-tip-taps')).toContainText(/\d+ tip taps?/);
		await expect(page.getByTestId('recap-tip-taps')).toContainText('Check Venmo for what came in.');
		await expect(page.locator('text=Attended Stamps')).toBeVisible();
	});

	test('navigates to Quick Issue phone creator', async ({ page }) => {
		await page.goto('/demo');
		await page.goto('/dashboard/issues/quick');

		await expect(page.locator('h1')).toHaveText("Publish Tonight's Issue");
		await expect(page.locator('input#city')).toBeVisible();
		await expect(page.locator('input#venue')).toBeVisible();
	});
});
