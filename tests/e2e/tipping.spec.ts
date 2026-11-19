import { test, expect } from '@playwright/test';
import { resetRateLimits } from './helpers/db';

/**
 * Venmo tips in test mode (ADR 0008, PRODUCTION_PLAN V.4): a tap is recorded,
 * Venmo is never opened, and the Fan sees the Demo message.
 */
const ISSUE_PATH = '/i/neon-velvet-brooklyn-2026-10-12';

test.describe('Venmo tip button (test mode)', () => {
	test.beforeAll(async ({ request }) => {
		await request.get(ISSUE_PATH);
		await resetRateLimits();
	});

	test('tapping a preset records a tap, stays on Quire and shows the Demo message', async ({ page }) => {
		const venmoRequests: string[] = [];
		page.on('request', (req) => {
			if (/venmo\.com/.test(req.url())) venmoRequests.push(req.url());
		});

		await page.goto(ISSUE_PATH);
		const panel = page.locator('.venmo-tip-panel');
		await expect(panel).toBeVisible();

		const preset = panel.locator('.venmo-tip-preset', { hasText: '$10' });
		// No real link in test mode; the would-be Venmo URL is exposed for checking.
		await expect(preset).not.toHaveAttribute('href', /.*/);
		const venmoUrl = await preset.getAttribute('data-venmo-url');
		expect(venmoUrl).toMatch(/^https:\/\/venmo\.com\/[A-Za-z0-9_-]+\?txn=pay&amount=10\.00&note=/);
		expect(decodeURIComponent(venmoUrl!.split('note=')[1])).toBe('Tip for The Neon Velvet via Quire');

		const tapRequest = page.waitForRequest((req) => req.url().endsWith('/api/tip-tap') && req.method() === 'POST');
		await preset.click();
		const request = await tapRequest;
		// The beacon body is not exposed by the browser; a 201 means the server matched the
		// slugs to this Artist and Issue and recorded the tap (unknown slugs get 404, bad input 400).
		const response = await request.response();
		expect(response?.status()).toBe(201);
		expect(await response?.json()).toEqual({ recorded: true });

		await expect(page.getByTestId('venmo-demo-message')).toHaveText(
			/^In the Demo, this would open Venmo to pay \$10 to @[A-Za-z0-9_-]+\.$/
		);
		await expect(page).toHaveURL(new RegExp(`${ISSUE_PATH}`));
		expect(venmoRequests).toEqual([]);
	});

	test('a double tap sends one tap', async ({ page }) => {
		await page.goto(ISSUE_PATH);
		const taps: string[] = [];
		page.on('request', (req) => {
			if (req.url().endsWith('/api/tip-tap')) taps.push(req.url());
		});
		const preset = page.locator('.venmo-tip-panel .venmo-tip-preset', { hasText: '$5' });
		await preset.click();
		await preset.click();
		await expect(page.getByTestId('venmo-demo-message')).toBeVisible();
		await page.waitForTimeout(500);
		expect(taps).toHaveLength(1);
	});

	test('the dashboard shows tip-tap counts with "Check Venmo", and no dollar figures', async ({ page }) => {
		await page.goto('/demo');
		await expect(page).toHaveURL(/\/dashboard/);

		const recapTaps = page.getByTestId('recap-tip-taps');
		await expect(recapTaps).toContainText(/\d+ tip taps?/);
		await expect(recapTaps).toContainText('Check Venmo for what came in.');
		await expect(page.getByTestId('general-tip-taps')).toContainText(/\d+ tip taps?/);

		const text = await page.locator('main').innerText();
		expect(text).not.toMatch(/Gross|Net Artist Payout|Stripe/);
		expect(text).not.toMatch(/\$\s*\d[^\n]{0,30}tip taps?|tip taps?[^\n]{0,30}\$\s*\d/i);
	});
});
