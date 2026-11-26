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

/**
 * The preview's tip guard selectors. They must equal TIP_ACTION_SELECTORS in
 * BookbinderPreview.svelte (its unit test pins that list); a Playwright spec can't import
 * a Svelte module's exports.
 */
const TIP_ACTION_SELECTOR = '[data-amount-cents], a[href*="venmo.com"]';

/**
 * Every control in the reader that looks like a tip (a Venmo URL, a "$n" label, or "with
 * Venmo" in its name), except the buttons that only open the tip sheet, which doesn't
 * match the guard's selectors. Empty means every tip control is guarded.
 */
function unguardedTipControls(reader: ReturnType<Page['frameLocator']>) {
	return reader.locator('body').evaluate((body, selector) => {
		const nameOf = (el: Element) => `${el.getAttribute('aria-label') ?? ''} ${el.textContent ?? ''}`.replace(/\s+/g, ' ').trim();
		return [...body.querySelectorAll('a, button, [role="button"]')]
			.filter((el) => el.getAttribute('aria-haspopup') !== 'dialog')
			.filter((el) => el.matches('[data-venmo-url], a[href*="venmo"]') || /\$\d/.test(nameOf(el)) || /with venmo/i.test(nameOf(el)))
			.filter((el) => !el.matches(selector))
			.map((el) => `${el.tagName.toLowerCase()}.${el.className} "${nameOf(el)}"`);
	}, TIP_ACTION_SELECTOR);
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

for (const width of [320, 390, 1280]) {
	test(`at ${width} px the Bookbinder page never scrolls sideways, and the phone fits its area`, async ({ page }) => {
		await openBookbinder(page);
		await page.setViewportSize({ width, height: width === 1280 ? 800 : 844 });
		// The phone's scale follows the pane's size; wait until it has settled.
		const phone = page.locator('.bookbinder-preview-phone');
		await expect
			.poll(async () => {
				const area = await page.locator('.bookbinder-preview-area').boundingBox();
				const box = await phone.boundingBox();
				return Boolean(area && box && box.width <= area.width + 0.01);
			}, { message: 'the phone fits its area' })
			.toBe(true);
		// B1-T36: the scale is rounded down, so the phone never widens the page by a fraction of a pixel.
		const overflow = await page.evaluate(() => ({
			scroll: document.documentElement.scrollWidth,
			client: document.documentElement.clientWidth
		}));
		expect(overflow.scroll, `scrollWidth at ${width} px`).toBeLessThanOrEqual(overflow.client);
		const widest = await page.evaluate(() =>
			Math.max(...[...document.querySelectorAll('.editor-pane, .preview-pane')].map((el) => el.getBoundingClientRect().right))
		);
		expect(widest, `the panes end inside the page at ${width} px`).toBeLessThanOrEqual(width);
		// The "Preview" chip stays on one line at every width.
		const chip = page.locator('.bookbinder-preview-chip');
		const chipLines = await chip.evaluate((el) => {
			// One client rect per line the text runs over.
			const range = document.createRange();
			range.selectNodeContents(el);
			return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
		});
		expect(chipLines, `the Preview chip at ${width} px`).toBeLessThanOrEqual(1);
	});
}

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
	const frameUrl = () => page.frames().find((f) => f.url().includes('/preview'))?.url() ?? '';
	const before = frameUrl();

	const tipsOff = page.getByRole('status').filter({ hasText: 'tips are off' });

	// Backstop: every tip-looking control on the Cover carries the guard's selector.
	expect(await unguardedTipControls(reader), 'tip controls without data-amount-cents').toEqual([]);

	// A Cover pill: a click, then Enter and Space on it while focused (keys fire click).
	const pill = reader.locator('.story-cover-tip-pills [data-amount-cents]').first();
	await expect(pill).toBeVisible();
	await pill.click();
	await expect(tipsOff).toBeVisible();
	await pill.focus();
	await page.keyboard.press('Enter');
	await page.keyboard.press('Space');

	// The tip sheet, from the bottom bar on a content page: a preset, then the custom amount.
	await reader.getByRole('button', { name: /Open tonight/ }).click();
	await reader.getByRole('button', { name: /Tip .* with Venmo/ }).first().click();
	const sheet = reader.locator('dialog[open]');
	const preset = sheet.locator('[data-amount-cents]').first();
	await expect(preset).toBeVisible();
	await preset.click();
	await sheet.getByLabel(/Other amount/).fill('12');
	const custom = sheet.getByRole('button', { name: 'Tip $12 with Venmo' });
	await expect(custom).toBeVisible();
	// The backstop again, with the custom-amount button showing.
	expect(await unguardedTipControls(reader), 'tip controls in the sheet without data-amount-cents').toEqual([]);
	await custom.click();
	await custom.focus();
	await page.keyboard.press('Enter');
	await page.keyboard.press('Escape');

	// Nothing in the frame can open Venmo in a new window either.
	const opened = await reader.locator('body').evaluate(() => window.open('https://venmo.com/u/quire-sample-band?amount=5') === null);
	expect(opened, 'window.open to Venmo is refused').toBe(true);

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

test.describe('the owner preview route (B1-T33)', () => {
	const DRAFT_CITY = `Draftburg ${RUN}`;
	let draft = { id: '', slug: '' };

	test.beforeAll(async ({ browser, baseURL }) => {
		const context = await browser.newContext();
		const page = await context.newPage();
		await page.goto(`${baseURL}/demo`);
		await expect(page).toHaveURL(/\/dashboard/);
		const quick = await postAction(page.request, baseURL!, '/dashboard/issues/quick', {
			city: DRAFT_CITY,
			venue: 'The Draft Room',
			date: '2026-11-25',
			timezone: 'America/New_York',
			saveMode: 'draft',
			setlistSongs: 'Unreleased One\nUnreleased Two'
		});
		expect(quick.type).not.toBe('failure');
		draft = (await issueForCity(DRAFT_CITY))!;
		await postAction(page.request, baseURL!, `/dashboard/bookbinder/${draft.id}?/addPage`, {
			kind: 'text',
			title: 'Draft Notes',
			body: 'Not out yet.'
		});
		await context.close();
	});

	test("a draft's preview in the Bookbinder shows its pages", async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.route('https://images.unsplash.com/**', (route) => route.abort());
		await page.goto('/demo');
		await page.goto(`/dashboard/bookbinder/${draft.id}`);
		const reader = page.frameLocator(PREVIEW);
		await expect(reader.locator('.story-reader.is-ready')).toBeAttached();
		await expect(page.locator(PREVIEW)).toHaveAttribute('src', `/dashboard/bookbinder/${draft.id}/preview`);
		await expect(reader.locator('.setlist-song')).toHaveText(['Unreleased One', 'Unreleased Two']);
		await expect(reader.locator('.story-page h2', { hasText: 'Draft Notes' })).toBeAttached();
	});

	test('only the owner gets the preview: a signed-out visitor and a Fan get 404, and the draft is not public', async ({ browser, baseURL }) => {
		const url = `/dashboard/bookbinder/${draft.id}/preview`;
		const anon = await browser.newContext();
		expect((await anon.request.get(`${baseURL}${url}`)).status(), 'signed out').toBe(404);
		expect((await anon.request.get(`${baseURL}/i/${draft.slug}`)).status(), 'the public reader').toBe(404);
		await anon.close();

		const fan = await browser.newContext();
		const fanPage = await fan.newPage();
		await fanPage.goto(`${baseURL}/demo?role=fan&redirect=/me/stubs`);
		await expect(fanPage).toHaveURL(/\/me\/stubs/);
		expect((await fan.request.get(`${baseURL}${url}`)).status(), 'a Fan').toBe(404);
		expect((await fan.request.get(`${baseURL}/i/${draft.slug}`)).status(), 'a Fan at the public reader').toBe(404);
		await fan.close();
	});

	test("the preview response is never indexed or cached, and only Quire may frame it", async ({ page, baseURL }) => {
		await page.goto('/demo');
		const response = await page.request.get(`${baseURL}/dashboard/bookbinder/${draft.id}/preview`);
		expect(response.status()).toBe(200);
		const headers = response.headers();
		expect(headers['x-robots-tag']).toBe('noindex, nofollow');
		expect(headers['cache-control']).toBe('private, no-store');
		expect(headers['content-security-policy']).toContain("frame-ancestors 'self'");
		expect(await response.text()).toContain('<meta name="robots" content="noindex, nofollow"');
	});
});
