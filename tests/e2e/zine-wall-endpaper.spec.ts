import { test, expect, type Page } from '@playwright/test';
import { clearCollectionFor, resetRateLimits } from './helpers/db';

/**
 * Z-T06 (ADR 0009): the Wall's notes are taped-up scraps with ink "Was There"
 * stamps and marker replies, and the Endpaper is the back cover with an ink
 * Stamp. Posting, flagging, Save and Stamp still work in the new look.
 */

const BROOKLYN = 'neon-velvet-brooklyn-2026-10-12';
const PHILLY = 'neon-velvet-philly-2026-10-15';
const FAN_EMAIL = 'maya@example.com';
const SCAN = `/scan/${BROOKLYN}?k=kickoff_babys_secret_2026`;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
	// The first request seeds the sample data on a fresh database.
	await request.get(`/i/${BROOKLYN}`);
	await resetRateLimits();
});

async function signInAsFan(page: Page) {
	await page.route('https://images.unsplash.com/**', (route) => route.abort());
	await page.goto('/demo?role=fan&redirect=/me/stubs');
	await expect(page).toHaveURL(/\/me\/stubs/);
}

async function noHorizontalScroll(page: Page) {
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
	expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
}

test('the Wall: taped-up notes with "Was There" stamps and marker replies; post and flag still work', async ({ page }) => {
	await signInAsFan(page);
	await page.goto(`/i/${BROOKLYN}`);
	const wall = page.locator('#page-wall');
	await wall.scrollIntoViewIfNeeded();

	const notes = wall.locator('.wall-note');
	expect(await notes.count()).toBeGreaterThan(0);
	await expect(notes.first().locator('.tape')).toHaveCount(1);
	await expect(wall.locator('.stamp', { hasText: 'Was There' }).first()).toBeVisible();
	const reply = wall.locator('.wall-reply').first();
	await expect(reply).toContainText('(Artist)');
	await expect(reply.locator('.marker-face')).toHaveCSS('font-family', /Permanent Marker/);

	// Post a note.
	const body = `Taped to the wall ${Date.now().toString(36)}`;
	await wall.getByLabel('Your note to The Neon Velvet').fill(body);
	await wall.getByRole('button', { name: 'Post Note →' }).click();
	await expect(wall.getByRole('status')).toHaveText(/Your note is live on the Wall!|Note submitted for artist approval!/);
	const posted = wall.locator('.wall-note', { hasText: body });
	await expect(posted).toBeVisible();

	// Flag it: the flag form posts and the page keeps working.
	const flagResponse = page.waitForResponse((res) => res.url().includes('?/flagNote') && res.request().method() === 'POST');
	await posted.getByRole('button', { name: /^Flag the note from/ }).click();
	expect((await flagResponse).status()).toBe(200);
	await noHorizontalScroll(page);
});

test('the Endpaper: claim the Stamp after a scan, and it is pressed on as an ink stamp', async ({ page }) => {
	await clearCollectionFor(FAN_EMAIL, BROOKLYN);
	await signInAsFan(page);
	await page.goto(SCAN);
	await expect(page).toHaveURL(new RegExp(BROOKLYN));

	const endpaper = page.locator('#page-endpaper');
	await endpaper.scrollIntoViewIfNeeded();
	await endpaper.getByRole('button', { name: 'Claim Attendance Stamp' }).click();

	const stamp = endpaper.locator('.ink-stamp');
	await expect(stamp).toContainText('OFFICIAL ATTENDANCE STAMPED');
	await expect(stamp).toContainText('Brooklyn');
	// The press animation runs when motion is allowed.
	expect(await stamp.evaluate((el) => getComputedStyle(el).animationName)).toMatch(/ink-press/);
	await expect(endpaper.getByRole('link', { name: 'View My Stubs →' })).toBeVisible();
	await noHorizontalScroll(page);
});

test('the ink Stamp does not move with reduced motion', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await signInAsFan(page);
	await page.goto(`/i/${BROOKLYN}`);
	const stamp = page.locator('#page-endpaper .ink-stamp');
	await expect(stamp).toBeAttached();
	expect(await stamp.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
});

test('the Endpaper: Save without a scan shows the Saved stamp', async ({ page }) => {
	await clearCollectionFor(FAN_EMAIL, PHILLY);
	await signInAsFan(page);
	await page.goto(`/i/${PHILLY}`);
	const endpaper = page.locator('#page-endpaper');
	await endpaper.scrollIntoViewIfNeeded();
	await endpaper.getByRole('button', { name: '+ Save Issue to My Stubs' }).click();
	await expect(endpaper.locator('.stamp', { hasText: 'Saved to Bookmarks' })).toBeVisible();
	await expect(endpaper.getByRole('link', { name: 'Open My Stubs →' })).toBeVisible();
});

test('at 320 px the Wall and the back cover fit, with 44 px controls', async ({ browser, baseURL }) => {
	const context = await browser.newContext({ baseURL, viewport: { width: 320, height: 720 } });
	const page = await context.newPage();
	await signInAsFan(page);
	await page.goto(`/i/${BROOKLYN}`);
	for (const id of ['page-wall', 'page-endpaper']) {
		await page.locator(`#${id}`).scrollIntoViewIfNeeded();
		await noHorizontalScroll(page);
	}
	// Layout sizes (offset*), which ignore the scroll-driven page-turn transform.
	const small = await page.evaluate(() =>
		[...document.querySelectorAll('#page-wall button, #page-wall a, #page-endpaper button, #page-endpaper a')]
			.filter((el) => !el.closest('.page-footer'))
			.map((el) => ({ text: (el.textContent ?? '').trim(), w: (el as HTMLElement).offsetWidth, h: (el as HTMLElement).offsetHeight }))
			.filter((t) => t.w < 44 || t.h < 44)
	);
	expect(small).toEqual([]);
	await context.close();
});
