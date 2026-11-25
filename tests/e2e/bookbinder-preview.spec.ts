import { test, expect, type Page } from '@playwright/test';
import { postAction } from './helpers/actions';
import { issueForCity } from './helpers/db';

/**
 * B1-T32 (ADR 0011): the Bookbinder preview is the Stories reader Fans see, in a
 * 390 by 844 phone scaled to fit the pane. Taps, keys and Prev/Next work in it; a save
 * jumps it to the page that changed; tips and the Wall are off, so no Venmo opens and
 * no Tip Tap is recorded.
 */

const RUN = crypto.randomUUID().slice(0, 8);
const CITY = `Previewton ${RUN}`;
let issueId = '';

test.beforeAll(async ({ browser, baseURL }) => {
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto(`${baseURL}/demo`);
	await expect(page).toHaveURL(/\/dashboard/);
	// Three pages: a setlist (from Quick Issue), then two text pages.
	const quick = await postAction(page.request, baseURL!, '/dashboard/issues/quick', {
		city: CITY,
		venue: 'The Preview Room',
		date: '2026-11-24',
		timezone: 'America/New_York',
		saveMode: 'published',
		setlistSongs: 'One\nTwo\nThree'
	});
	expect(quick.type).not.toBe('failure');
	issueId = (await issueForCity(CITY))!.id;
	for (const title of ['Page Two', 'Page Three']) {
		const added = await postAction(page.request, baseURL!, `/dashboard/bookbinder/${issueId}?/addPage`, {
			kind: 'text',
			title,
			body: `The words of ${title}.`
		});
		expect(added).toMatchObject({ type: 'success' });
	}
	await context.close();
});

const PREVIEW = 'iframe[title="Live Issue Mobile Preview"]';

async function openBookbinder(page: Page) {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.route('https://images.unsplash.com/**', (route) => route.abort());
	await page.goto('/demo');
	await page.goto(`/dashboard/bookbinder/${issueId}`);
	const reader = page.frameLocator(PREVIEW);
	await expect(reader.locator('.story-reader.is-ready')).toBeAttached();
	return reader;
}

const currentId = (page: Page) =>
	page.frameLocator(PREVIEW).locator('.story-page[data-place="current"]').getAttribute('data-page-id');

test('the preview is the reader in a 390 by 844 phone, fitting the pane, with nothing overflowing at 1280 px', async ({ page }) => {
	const reader = await openBookbinder(page);
	await expect(reader.locator('.story-page[data-page-id="page-cover"]')).toHaveAttribute('data-place', 'current');

	const phone = page.getByTestId('bookbinder-preview-phone');
	const box = (await phone.boundingBox())!;
	expect(box.width / box.height).toBeCloseTo(390 / 844, 2);
	const pane = (await page.locator('.preview-pane').boundingBox())!;
	expect(box.x).toBeGreaterThanOrEqual(pane.x - 0.5);
	expect(box.x + box.width).toBeLessThanOrEqual(pane.x + pane.width + 0.5);
	expect(box.y + box.height).toBeLessThanOrEqual(pane.y + pane.height + 0.5);
	// The reader inside sees a real phone: 390 by 844.
	expect(await reader.locator('html').evaluate(() => [innerWidth, innerHeight])).toEqual([390, 844]);
	// Nothing in the Bookbinder or the preview scrolls sideways.
	expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
	expect(
		await page.locator('.preview-pane, .bookbinder-preview, .bookbinder-preview-area').evaluateAll((els) =>
			els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.className)
		)
	).toEqual([]);
	await expect(page.getByText('Tips and the Wall are off here.')).toBeVisible();
});

test('tapping through the preview works: a tap on the right, and the Next button', async ({ page }) => {
	const reader = await openBookbinder(page);
	// Open the zine from the Cover, then tap the right side of the (scaled) phone.
	await reader.getByRole('button', { name: /Open tonight/ }).click();
	await expect.poll(() => currentId(page)).toBe('page-content-0');
	const box = (await page.getByTestId('bookbinder-preview-phone').boundingBox())!;
	await page.mouse.click(box.x + box.width * 0.85, box.y + box.height * 0.45);
	await expect.poll(() => currentId(page)).toBe('page-content-1');
	await reader.locator('button.story-next').click();
	await expect.poll(() => currentId(page)).toBe('page-content-2');
	// The Bookbinder's own URL is untouched by the reader's paging.
	expect(new URL(page.url()).hash).toBe('');
});

test('saving page 3 jumps the preview to page 3, showing the change', async ({ page }) => {
	const reader = await openBookbinder(page);
	const forms = page.locator('form[action="?/updatePage"]');
	const third = forms.nth(2);
	const title = `Page Three, edited ${Date.now().toString(36)}`;
	await third.locator('input[name="title"]').fill(title);
	await third.getByRole('button', { name: 'Save Page Block' }).click();
	await expect.poll(() => currentId(page), { timeout: 10000 }).toBe('page-content-2');
	await expect(reader.locator('.story-page[data-page-id="page-content-2"] h2')).toHaveText(title);
});

test('a tip in the preview never opens Venmo or records a Tip Tap, and the Wall cannot post', async ({ page }) => {
	const tipTaps: string[] = [];
	const wallPosts: string[] = [];
	page.on('request', (request) => {
		if (request.url().includes('/api/tip-tap')) tipTaps.push(request.url());
		if (request.method() === 'POST' && /\?\/(submitNote|flagNote)/.test(request.url())) wallPosts.push(request.url());
	});
	const popups: string[] = [];
	page.on('popup', (popup) => popups.push(popup.url()));
	const reader = await openBookbinder(page);
	const frameUrl = () => page.frames().find((f) => f.url().includes('/i/'))?.url() ?? '';
	const before = frameUrl();

	// A tip pill on the Cover.
	const pill = reader.locator('[data-amount-cents]').first();
	await expect(pill).toBeVisible();
	await pill.click();
	await expect(page.getByRole('status').filter({ hasText: 'tips are off' })).toBeVisible();
	// The tip sheet's amounts, from the bottom bar on a content page.
	await reader.getByRole('button', { name: /Open tonight/ }).click();
	await reader.getByRole('button', { name: /Tip .* with Venmo/ }).first().click();
	const sheetTip = reader.locator('dialog[open] [data-amount-cents]').first();
	await expect(sheetTip).toBeVisible();
	await sheetTip.click();
	await page.keyboard.press('Escape');

	// The Wall: a note can be written, but posting is off.
	await page.frameLocator(PREVIEW).locator('body').evaluate(() => (location.hash = 'page-wall'));
	const wall = reader.locator('.story-page[data-page-id="page-wall"]');
	await expect(wall).toHaveAttribute('data-place', 'current');
	// The Artist is signed in, so the composer is there: the post is what must not go through.
	const note = wall.locator('textarea');
	await expect(note).toBeVisible();
	await note.fill('From the preview');
	await wall.getByRole('button', { name: 'Post', exact: true }).click();
	await expect(page.getByRole('status').filter({ hasText: 'the Wall, Save and Stamp are off' })).toBeVisible();

	await page.waitForTimeout(500);
	expect(tipTaps, 'no Tip Tap is sent').toEqual([]);
	expect(wallPosts, 'no Wall post is sent').toEqual([]);
	expect(popups, 'nothing opens').toEqual([]);
	expect(frameUrl().split('#')[0]).toBe(before.split('#')[0]);
	expect(frameUrl()).not.toContain('venmo.com');
});
