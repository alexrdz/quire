import { test, expect, type Page } from '@playwright/test';
import {
	createProductionArtist,
	resetProductionRateLimits,
	tipTapsFor,
	type ProductionArtist
} from '../helpers/production-db';

/**
 * PRODUCTION_PLAN Phase 5 and V.4: in real production mode a tip tap opens a
 * venmo.com link with the right username, amount and generic note, and no
 * Stripe key is needed (ADR 0008).
 *
 * venmo.com is intercepted with page.route, so nothing leaves the machine: the
 * test sees the exact navigation the Fan's browser would make.
 */

const VENMO_USERNAME = 'P5-Tip-Band';
const DISPLAY_NAME = 'The P5 Tip Band';
/** Exactly what a $5 tap must open: no venue, city or date in the note. */
const EXPECTED_NOTE = 'Tip%20for%20The%20P5%20Tip%20Band%20via%20Quire';
const venmoUrl = (amount: string) =>
	`https://venmo.com/${VENMO_USERNAME}?txn=pay&amount=${amount}&note=${EXPECTED_NOTE}`;

let withVenmo: ProductionArtist;
let withoutVenmo: ProductionArtist;

test.beforeAll(async () => {
	await resetProductionRateLimits();
	withVenmo = await createProductionArtist({ displayName: DISPLAY_NAME, venmoUsername: VENMO_USERNAME, tipPresets: [3, 5, 10] });
	withoutVenmo = await createProductionArtist({ displayName: 'The No Venmo Band', venmoUsername: null });
});

/** Intercepts venmo.com and records every navigation there. */
async function interceptVenmo(page: Page): Promise<string[]> {
	const opened: string[] = [];
	await page.route(/^https:\/\/([a-z]+\.)?venmo\.com\//, (route) => {
		opened.push(route.request().url());
		return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Venmo stand-in</title>' });
	});
	return opened;
}

async function tapPreset(page: Page, path: string, label: string) {
	const opened = await interceptVenmo(page);
	await page.goto(path);
	await expect(page.locator('[data-testid="demo-banner"]')).toHaveCount(0);
	const panel = page.locator('.venmo-tip-panel');
	await expect(panel).toBeVisible();
	const preset = panel.locator('a.venmo-tip-preset', { hasText: label });

	// A real link in production, with the exact pay URL.
	const href = await preset.getAttribute('href');
	expect(href).toBe(venmoUrl('5.00'));
	for (const leak of ['Philadelphia', 'Secret%20Room', 'Secret Room', '2026', 'venue', 'city']) {
		expect(href, `the note leaks ${leak}`).not.toContain(leak);
	}

	const tap = page.waitForRequest((req) => req.url().endsWith('/api/tip-tap') && req.method() === 'POST');
	await preset.click();
	await tap;
	await expect(page).toHaveURL(venmoUrl('5.00'));
	expect(opened).toEqual([venmoUrl('5.00')]);
	await expect(page.getByText('In the Demo, this would open Venmo')).toHaveCount(0);
}

test('no Stripe key is set for the production server, and payments are off', async ({ request }) => {
	// The server inherits this runner's environment plus its own (playwright.config.ts), which sets none.
	expect(Object.keys(process.env).filter((name) => name.startsWith('STRIPE_'))).toEqual([]);
	const health = await (await request.get('/healthz')).json();
	expect(health.features).toMatchObject({ mode: 'production', payments: false, tipsOpenVenmo: true });
});

test('a preset on the Cover opens the exact Venmo link and records a Tip Tap', async ({ page }) => {
	await tapPreset(page, `/i/${withVenmo.issueSlug}`, '$5');
	await expect
		.poll(async () => tipTapsFor(withVenmo.artistId))
		.toContainEqual({ issueId: withVenmo.issueId, amountSelectedCents: 500 });
});

test('a preset on the Back Page opens the exact Venmo link and records a General Tip Tap', async ({ page }) => {
	await tapPreset(page, `/a/${withVenmo.slug}`, '$5');
	await expect
		.poll(async () => tipTapsFor(withVenmo.artistId))
		.toContainEqual({ issueId: null, amountSelectedCents: 500 });
});

test('every preset carries the right amount', async ({ page }) => {
	await interceptVenmo(page);
	await page.goto(`/i/${withVenmo.issueSlug}`);
	const panel = page.locator('.venmo-tip-panel');
	for (const [label, amount] of [
		['$3', '3.00'],
		['$5', '5.00'],
		['$10', '10.00']
	]) {
		await expect(panel.locator('a.venmo-tip-preset', { hasText: label })).toHaveAttribute('href', venmoUrl(amount));
	}
});

test('a custom amount carries the right amount', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await interceptVenmo(page);
	await page.goto(`/i/${withVenmo.issueSlug}`);
	await page.waitForLoadState('networkidle');
	const panel = page.locator('.venmo-tip-panel');
	await panel.locator('input.venmo-tip-input').fill('12.5');
	await expect(panel.locator('a.venmo-tip-go')).toHaveAttribute('href', venmoUrl('12.50'), { timeout: 2000 });
	expect(errors).toEqual([]);
});

test('an Artist without a Venmo username shows no tip buttons', async ({ page }) => {
	for (const path of [`/i/${withoutVenmo.issueSlug}`, `/a/${withoutVenmo.slug}`]) {
		const response = await page.goto(path);
		expect(response?.status(), path).toBe(200);
		await expect(page.locator('.venmo-tip-panel'), path).toHaveCount(0);
		await expect(page.locator('a[href*="venmo.com"]'), path).toHaveCount(0);
	}
	expect(await tipTapsFor(withoutVenmo.artistId)).toEqual([]);
});
