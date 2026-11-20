import { test, expect } from '@playwright/test';

/**
 * PRODUCTION_PLAN 4.2 (banner part), CONTEXT decision 29.
 *
 * The default e2e server runs in test mode, where the banner must never appear.
 * The Demo checks are in tests/e2e/demo/demo-banner.spec.ts and run against the
 * local Demo-mode server (playwright.config.ts, P4L-T03).
 */

const ISSUE_PATH = '/i/neon-velvet-brooklyn-2026-10-12';
const BACK_PAGE_PATH = '/a/the-neon-velvet';
const BANNER = '[data-testid="demo-banner"]';

test.describe('Demo banner outside the Demo (test mode)', () => {
	for (const path of ['/', '/login', BACK_PAGE_PATH, ISSUE_PATH, '/no-such-page']) {
		test(`never renders on ${path}`, async ({ page }) => {
			await page.goto(path);
			await expect(page.locator('body')).toBeVisible();
			await expect(page.locator(BANNER)).toHaveCount(0);
		});
	}

	test('never renders on the dashboard or in the Case Display', async ({ page }) => {
		await page.goto('/demo');
		await expect(page).toHaveURL(/\/dashboard/);
		await expect(page.locator(BANNER)).toHaveCount(0);
		await page.getByRole('button', { name: 'Artist Back Page QR' }).click();
		await page.getByRole('button', { name: 'Full-Screen Case Display' }).first().click();
		await expect(page.getByRole('dialog')).toBeVisible();
		await expect(page.locator(BANNER)).toHaveCount(0);
	});
});
