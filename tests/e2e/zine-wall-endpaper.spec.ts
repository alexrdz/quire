import { test, expect, type Page } from '@playwright/test';
import { signInAsFan } from './helpers/actions';
import { addRepliedWallNote, createFan, resetRateLimits } from './helpers/db';
import { goToStoryPage, openStoryAt } from './helpers/story';

/**
 * Z-T06 (ADR 0009): the Wall's notes are taped-up scraps with ink "Was There"
 * stamps and marker replies, and the Endpaper is the back cover with an ink
 * Stamp. Posting, flagging, Save and Stamp still work in the new look.
 *
 * In the Stories reader (ADR 0011) each test opens the Wall or the Endpaper
 * by its URL hash, as a shared link would; R-T04 restyles both pages.
 *
 * B1-T16: every test owns the state it checks, so the tests run in any order
 * and in parallel, including --repeat-each copies of themselves. A test that
 * stamps or saves signs in as a new Fan of its own; the Wall test reads a
 * replied note it added itself, not the seeded one. Maya (the /demo Fan) only
 * reads, and posts and flags a note of her own with a unique body.
 */

const BROOKLYN = 'neon-velvet-brooklyn-2026-10-12';
const PHILLY = 'neon-velvet-philly-2026-10-15';
const SCAN = `/scan/${BROOKLYN}?k=kickoff_babys_secret_2026`;

test.beforeAll(async ({ request }) => {
	// The first request seeds the sample data on a fresh database.
	await request.get(`/i/${BROOKLYN}`);
	await resetRateLimits();
});

/** Unique per test and per copy, so parallel copies never find each other's notes. */
const uniqueTag = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function blockRemotePhotos(page: Page) {
	await page.route('https://images.unsplash.com/**', (route) => route.abort());
}

/** Maya, the sample Fan, through the /demo sign-in. */
async function signInAsDemoFan(page: Page) {
	await blockRemotePhotos(page);
	await page.goto('/demo?role=fan&redirect=/me/stubs');
	await expect(page).toHaveURL(/\/me\/stubs/);
}

/** A new Fan with no stamps or saves, signed in before the page has any cookies. */
async function signInAsNewFan(page: Page, label: string) {
	await blockRemotePhotos(page);
	await signInAsFan(page, await createFan(label));
}

async function noHorizontalScroll(page: Page) {
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
	expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
}

test('the Wall: taped-up notes with "Was There" stamps and marker replies; post and flag still work', async ({ page }) => {
	const tag = uniqueTag();
	const replied = { body: `Front row at the kickoff ${tag}`, reply: `Thanks for singing along ${tag}` };
	const { fanName } = await addRepliedWallNote(BROOKLYN, replied);

	await signInAsDemoFan(page);
	await openStoryAt(page, `/i/${BROOKLYN}`, 'page-wall');
	const wall = page.locator('#page-wall');

	// The note this test added: taped up, stamped "Was There" (its Fan is stamped
	// at this show), with the Artist's reply in marker stuck under it.
	const item = wall.locator('.wall-note-item', { hasText: replied.body });
	await expect(item.locator('.wall-note .note-author')).toHaveText(fanName);
	await expect(item.locator('.wall-note .tape')).toHaveCount(1);
	await expect(item.locator('.wall-note .stamp', { hasText: 'Was There' })).toBeVisible();
	const reply = item.locator('.wall-reply');
	await expect(reply).toContainText('(Artist)');
	await expect(reply).toContainText(replied.reply);
	await expect(reply.locator('.marker-face')).toHaveCSS('font-family', /Permanent Marker/);

	// Post a note.
	const body = `Taped to the wall ${tag}`;
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
	await signInAsNewFan(page, 'Stamp Fan');
	await page.goto(SCAN);
	await expect(page).toHaveURL(new RegExp(BROOKLYN));

	await goToStoryPage(page, 'page-endpaper');
	const endpaper = page.locator('#page-endpaper');
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
	await signInAsNewFan(page, 'Still Stamp Fan');
	await page.goto(SCAN);
	await expect(page).toHaveURL(new RegExp(BROOKLYN));

	await goToStoryPage(page, 'page-endpaper');
	const endpaper = page.locator('#page-endpaper');
	await endpaper.getByRole('button', { name: 'Claim Attendance Stamp' }).click();
	const stamp = endpaper.locator('.ink-stamp');
	await expect(stamp).toContainText('OFFICIAL ATTENDANCE STAMPED');
	expect(await stamp.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
});

test('the Endpaper: Save without a scan shows the Saved stamp', async ({ page }) => {
	await signInAsNewFan(page, 'Save Fan');
	await openStoryAt(page, `/i/${PHILLY}`, 'page-endpaper');
	const endpaper = page.locator('#page-endpaper');
	await endpaper.getByRole('button', { name: '+ Save Issue to My Stubs' }).click();
	await expect(endpaper.locator('.stamp', { hasText: 'Saved to Bookmarks' })).toBeVisible();
	await expect(endpaper.getByRole('link', { name: 'Open My Stubs →' })).toBeVisible();
});

test('at 320 px the Wall and the back cover fit, with 44 px controls', async ({ browser, baseURL }) => {
	const context = await browser.newContext({ baseURL, viewport: { width: 320, height: 720 } });
	const page = await context.newPage();
	await signInAsDemoFan(page);
	await page.goto(`/i/${BROOKLYN}`);
	for (const id of ['page-wall', 'page-endpaper']) {
		await goToStoryPage(page, id);
		await noHorizontalScroll(page);
	}
	// Layout sizes (offset*), which ignore the page's slide transform.
	const small = await page.evaluate(() =>
		[...document.querySelectorAll('#page-wall button, #page-wall a, #page-endpaper button, #page-endpaper a')]
			.map((el) => ({ text: (el.textContent ?? '').trim(), w: (el as HTMLElement).offsetWidth, h: (el as HTMLElement).offsetHeight }))
			.filter((t) => t.w < 44 || t.h < 44)
	);
	expect(small).toEqual([]);
	await context.close();
});
