import { test, expect, type Browser, type Page } from '@playwright/test';
import { createClient } from '@libsql/client';
import { postAction } from './helpers/actions';
import { issueForCity, resetRateLimits } from './helpers/db';
import { TINY_PNG } from './helpers/upload-files';
import { expectCurrent, openStoryAt } from './helpers/story';

/**
 * B1-T37, SPEC.md §5.5: "tapping 'Post note' triggers Google OAuth with the draft
 * saved in sessionStorage and automatically submits upon return. For Endpaper,
 * tapping 'Claim Stamp' triggers Google sign-in and immediately stamps the Issue
 * upon return." In test mode Google is the stand-in sign-in (the sample Fan). The
 * action completes exactly once: a refresh or Back never repeats it, and every
 * usual rule still applies.
 */

const RUN = Date.now().toString(36);
const ARTIST = 'The Neon Velvet';
const FAN_EMAIL = 'maya@example.com';

test.describe.configure({ mode: 'serial' });

/** Today in the venue's time zone, so the Quick Issue's Stamp Window is open now. */
function venueDate(offsetDays = 0, timeZone = 'America/New_York'): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

async function query<T = Record<string, unknown>>(sql: string, args: Array<string | number>): Promise<T[]> {
	const db = createClient({ url: 'file:local.db' });
	try {
		await db.execute('PRAGMA busy_timeout = 5000');
		return (await db.execute({ sql, args })).rows as unknown as T[];
	} finally {
		db.close();
	}
}

/** A published Quick Issue by the Demo Artist, with its slug and the QR's secret. */
async function quickIssue(browser: Browser, baseURL: string, city: string, date: string) {
	const page = await browser.newPage({ baseURL });
	await page.goto('/demo');
	await expect(page).toHaveURL(/\/dashboard/);
	const result = await postAction(page.request, baseURL, '/dashboard/issues/quick', {
		city,
		venue: 'The Resume Room',
		date,
		timezone: 'America/New_York',
		saveMode: 'published',
		photoFile: { name: 'photo.png', mimeType: 'image/png', buffer: TINY_PNG }
	});
	expect(result.type, 'Quick Issue publishes').toBe('success');
	await page.close();
	const issue = (await issueForCity(city))!;
	const [row] = await query<{ secret_key: string }>('SELECT secret_key FROM issues WHERE id = ?', [issue.id]);
	return { ...issue, secret: row!.secret_key };
}

const notesWith = async (body: string) =>
	Number((await query<{ n: number }>('SELECT count(*) AS n FROM notes WHERE body = ?', [body]))[0]!.n);

const stampsFor = async (issueId: string) =>
	query<{ kind: string }>(
		'SELECT c.kind FROM collections c JOIN users u ON u.id = c.fan_user_id WHERE u.email = ? AND c.issue_id = ?',
		[FAN_EMAIL, issueId]
	);

/** Writes a note on the Wall page signed out, then taps Post and signs in with "Google". */
async function draftAndSignIn(page: Page, slug: string, body: string) {
	await openStoryAt(page, `/i/${slug}`, 'page-wall');
	const wall = page.locator('#page-wall');
	await wall.getByLabel(`Your note to ${ARTIST}`).fill(body);
	await wall.getByRole('button', { name: 'Sign in to post' }).click();
	const sheet = page.locator('dialog[open]');
	await expect(sheet.getByText('Sign in with Google and it posts to the Wall.')).toBeVisible();
	await sheet.getByRole('button', { name: 'Continue with Google' }).click();
	await expect(page).toHaveURL(new RegExp(`/i/${slug}#page-wall$`));
	return wall;
}

let today: { id: string; slug: string; secret: string };

test.beforeAll(async ({ browser, baseURL }) => {
	today = await quickIssue(browser, baseURL!, `Resumeton ${RUN}`, venueDate());
});

test.beforeEach(async () => {
	await resetRateLimits();
});

test('a signed-out Fan writes a note, taps Post, signs in, and the note is posted once', async ({ page }) => {
	const body = `Back from sign-in ${RUN}`;
	const wall = await draftAndSignIn(page, today.slug, body);

	await expect(wall.locator('.wall-feedback-msg')).toHaveText('Your note is live on the Wall!');
	await expect(wall.locator('.wall-note', { hasText: body })).toHaveCount(1);
	await expect(wall.getByLabel(`Your note to ${ARTIST}`)).toHaveValue('');
	expect(await notesWith(body)).toBe(1);

	// A refresh does not post it again, and the draft is gone.
	await page.reload();
	await expectCurrent(page, 'page-wall');
	await expect(wall.locator('.wall-note', { hasText: body })).toHaveCount(1);
	await expect(wall.locator('.wall-feedback-msg')).toHaveCount(0);
	await expect(wall.getByLabel(`Your note to ${ARTIST}`)).toHaveValue('');
	expect(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('quire_draft_')))).toEqual([]);
	expect(await notesWith(body)).toBe(1);

	// Nor does Back to the page and forward again.
	await page.goto('/');
	await page.goBack();
	await expect(page).toHaveURL(new RegExp(`/i/${today.slug}#page-wall$`));
	await expectCurrent(page, 'page-wall');
	await expect(wall.locator('.wall-note', { hasText: body })).toHaveCount(1);
	await page.waitForTimeout(500);
	expect(await notesWith(body)).toBe(1);
});

test('a note breaking the no-links rule is refused after sign-in, and the draft is kept to fix', async ({ page }) => {
	const body = `Text me at resume-${RUN}.example.com`;
	const wall = await draftAndSignIn(page, today.slug, body);

	await expect(wall.locator('.wall-feedback-msg')).toContainText(/link/i);
	await expect(wall.getByLabel(`Your note to ${ARTIST}`)).toHaveValue(body);
	expect(await notesWith(body)).toBe(0);

	// The Fan fixes it and posts by hand, once.
	const fixed = `Fixed after sign-in ${RUN}`;
	await wall.getByLabel(`Your note to ${ARTIST}`).fill(fixed);
	await wall.getByRole('button', { name: 'Post', exact: true }).click();
	await expect(wall.locator('.wall-feedback-msg')).toHaveText('Your note is live on the Wall!');
	expect(await notesWith(fixed)).toBe(1);
	expect(await notesWith(body)).toBe(0);
});

test('Claim Stamp after a scan, then sign-in, claims the Stamp exactly once', async ({ page }) => {
	await page.goto(`/scan/${today.slug}?k=${today.secret}`);
	await openStoryAt(page, `/i/${today.slug}`, 'page-endpaper');
	const endpaper = page.locator('#page-endpaper');
	await endpaper.getByRole('button', { name: 'Sign in to claim your Stamp' }).click();
	const sheet = page.locator('dialog[open]');
	await expect(sheet.getByText("Sign in with Google and this show's Stamp goes straight into your Stubs.")).toBeVisible();
	await sheet.getByRole('button', { name: 'Continue with Google' }).click();
	await expect(page).toHaveURL(new RegExp(`/i/${today.slug}#page-endpaper$`));

	// No second tap: the Stamp is claimed on return.
	await expect(endpaper.locator('.stamped-card .stamped-title')).toHaveText('Stamped');
	expect((await stampsFor(today.id)).map((r) => r.kind)).toEqual(['stamped']);

	// A refresh keeps it claimed, once, with nothing else submitted.
	await page.reload();
	await expectCurrent(page, 'page-endpaper');
	await expect(endpaper.locator('.stamped-card')).toBeVisible();
	await expect(endpaper.locator('.endpaper-error')).toHaveCount(0);
	expect((await stampsFor(today.id)).map((r) => r.kind)).toEqual(['stamped']);
});

test('a scan outside the Stamp Window is refused, and signing in claims nothing', async ({ browser, baseURL, page }) => {
	const past = await quickIssue(browser, baseURL!, `Lateton ${RUN}`, venueDate(-30));
	const response = await page.goto(`/scan/${past.slug}?k=${past.secret}`);
	expect(response?.status()).toBe(403);
	await expect(page.getByText(/outside of the 48-hour Stamp Window/)).toBeVisible();

	// No Scan Token, so the Endpaper offers no Stamp; signing in (from Save) stamps nothing.
	await openStoryAt(page, `/i/${past.slug}`, 'page-endpaper');
	const endpaper = page.locator('#page-endpaper');
	await expect(endpaper.getByTestId('stamp-unavailable')).toBeVisible();
	await endpaper.getByRole('button', { name: 'Sign in to save' }).click();
	await page.locator('dialog[open]').getByRole('button', { name: 'Continue with Google' }).click();
	await expect(page).toHaveURL(new RegExp(`/i/${past.slug}#page-endpaper$`));
	await expect(endpaper.getByRole('button', { name: 'Save to My Stubs' })).toBeVisible();
	await page.waitForTimeout(500);
	await expect(endpaper.locator('.stamped-card')).toHaveCount(0);
	expect(await stampsFor(past.id)).toEqual([]);
});
