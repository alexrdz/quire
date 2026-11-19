import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * PRODUCTION_PLAN 4.2 (banner part), CONTEXT decision 29.
 *
 * The default e2e server runs in test mode, where the banner must never appear.
 * The Demo checks need a server running with DEMO_MODE=true. Demo mode requires
 * real core configuration (ADR 0007), so they run only when DEMO_BASE_URL points
 * at one, e.g. the Demo site, and are skipped otherwise. P4L-T03 adds a guarded
 * local Demo-mode preview so they can run in the gate.
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

const demoBaseUrl = process.env.DEMO_BASE_URL;

async function box(locator: Locator) {
	const b = await locator.boundingBox();
	expect(b, 'element has a layout box').not.toBeNull();
	return b!;
}

/** True when two boxes share any area. */
function intersects(a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean {
	return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function expectNoOverlap(page: Page, targets: Locator) {
	const banner = await box(page.locator(BANNER).first());
	const n = await targets.count();
	expect(n).toBeGreaterThan(0);
	for (let i = 0; i < n; i++) {
		const target = targets.nth(i);
		if (!(await target.isVisible())) continue;
		expect(intersects(banner, await box(target)), `banner overlaps ${await target.textContent()}`).toBe(false);
	}
}

test.describe('Demo banner in the Demo', () => {
	test.skip(
		!demoBaseUrl,
		'DEMO_BASE_URL is not set: no Demo-mode server to test against. P4L-T03 adds a local Demo-mode preview for these checks.'
	);
	test.use({ baseURL: demoBaseUrl, viewport: { width: 360, height: 740 } });

	for (const path of ['/', '/login', BACK_PAGE_PATH, ISSUE_PATH, '/no-such-page']) {
		test(`renders on ${path}`, async ({ page }) => {
			await page.goto(path);
			const banner = page.locator(BANNER);
			await expect(banner).toHaveCount(1);
			await expect(banner).toBeVisible();
			await expect(banner).toContainText("You're in the Demo.");
			// In the flow, never overlaid.
			const position = await banner.evaluate((el) => getComputedStyle(el).position);
			expect(['static', 'relative']).toContain(position);
		});
	}

	test('at 360px it does not overlap the Back Page tip buttons', async ({ page }) => {
		await page.goto(BACK_PAGE_PATH);
		await expectNoOverlap(page, page.locator('.btn-hero-support, .venmo-tip-preset, .venmo-tip-go'));
	});

	test('at 360px it does not overlap the Issue Cover CTA or tip buttons', async ({ page }) => {
		await page.goto(ISSUE_PATH);
		await expectNoOverlap(page, page.locator('.btn-open-zine, .venmo-tip-preset, .venmo-tip-go'));
	});

	test('the Full-Screen Case Display carries the compact banner', async ({ page }) => {
		// /demo signs in as the sample Artist and lands on the dashboard.
		await page.goto('/demo');
		await expect(page.locator(BANNER)).toHaveCount(1);
		await page.getByRole('button', { name: 'Artist Back Page QR' }).click();
		await page.getByRole('button', { name: 'Full-Screen Case Display' }).first().click();
		const dialog = page.getByRole('dialog');
		await expect(dialog.locator(`${BANNER}.demo-banner--compact`)).toBeVisible();
	});
});
