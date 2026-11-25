import { test, expect, type Locator, type Page } from '@playwright/test';
import { signInAsFan } from './helpers/actions';
import { addRepliedWallNote, createFan, resetRateLimits } from './helpers/db';
import { expectCurrent, goToStoryPage, openStoryAt } from './helpers/story';

/**
 * R-T04 (ADR 0011): the Wall as a modern comment thread, in a bottom sheet
 * from any page and on the Wall page, and the Endpaper ("That's the zine.",
 * Save and Stamp, a Stamped card). Posting, flagging, "Was there", the Artist's
 * reply, Save and Stamp keep working exactly as before.
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

async function noHorizontalScroll(page: Page, label = 'page') {
	const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
	expect(overflow, `${label}: no horizontal scroll`).toBeLessThanOrEqual(0);
}

/** The ids of the reader's pages, in order. */
function pageIds(page: Page): Promise<string[]> {
	return page.locator('.story-page').evaluateAll((els) => els.map((el) => el.getAttribute('data-page-id')!));
}

/** Rendered controls in `scope` under 44 by 44 px (layout size, ignoring the page slide). */
function smallControls(scope: Locator) {
	return scope.evaluateAll((roots) =>
		roots.flatMap((root) =>
			[...root.querySelectorAll('a[href], button, input:not([type="hidden"]), textarea')]
				.filter((el) => getComputedStyle(el).display !== 'none' && !el.closest('.visually-hidden'))
				.map((el) => ({
					name: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim() || el.tagName,
					w: (el as HTMLElement).offsetWidth,
					h: (el as HTMLElement).offsetHeight
				}))
				.filter((c) => c.w < 44 || c.h < 44)
		)
	);
}

/** WCAG contrast of each text element against the first opaque background behind it. */
function contrastOf(scope: Locator, selector: string) {
	return scope.locator(selector).evaluateAll((els) =>
		els.map((el) => {
			const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
			const lum = ([r, g, b]: number[]) =>
				[r!, g!, b!]
					.map((v) => v / 255)
					.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
					.reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0);
			let node: Element | null = el;
			let background = 'rgb(9, 7, 16)';
			while (node) {
				const parts = rgb(getComputedStyle(node).backgroundColor);
				if (parts.length >= 3 && (parts.length < 4 || parts[3] === 1)) {
					background = getComputedStyle(node).backgroundColor;
					break;
				}
				node = node.parentElement;
			}
			const [a, b] = [lum(rgb(getComputedStyle(el).color)), lum(rgb(background))].sort((x, y) => y - x);
			return { text: (el.textContent ?? '').trim().slice(0, 30), ratio: (a! + 0.05) / (b! + 0.05) };
		})
	);
}

test('the Wall: a comment thread with "Was there" and the Artist reply; post and flag still work', async ({ page }) => {
	const tag = uniqueTag();
	const replied = { body: `Front row at the kickoff ${tag}`, reply: `Thanks for singing along ${tag}` };
	const { fanName } = await addRepliedWallNote(BROOKLYN, replied);

	await signInAsDemoFan(page);
	await openStoryAt(page, `/i/${BROOKLYN}`, 'page-wall');
	const wall = page.locator('#page-wall');

	// The note this test added: its Fan is stamped at this show ("Was there"), with
	// the Artist's reply indented under it and labelled "Artist".
	const item = wall.locator('.wall-note-item', { hasText: replied.body });
	await expect(item.locator('.wall-note .note-author')).toHaveText(fanName);
	await expect(item.locator('.wall-note .was-there')).toHaveText('Was there');
	await expect(item.locator('.wall-note .note-time')).toHaveText(/^(just now|\d+[mhd])$/);
	const reply = item.locator('.wall-reply');
	await expect(reply.locator('.artist-badge')).toHaveText('Artist');
	await expect(reply.locator('.note-author')).toHaveText('The Neon Velvet');
	await expect(reply).toContainText(replied.reply);
	// Indented under the note.
	const noteBox = (await item.locator('.wall-note').boundingBox())!;
	const replyBox = (await reply.boundingBox())!;
	expect(replyBox.x).toBeGreaterThan(noteBox.x + 20);
	expect(replyBox.y).toBeGreaterThanOrEqual(noteBox.y + noteBox.height - 1);

	// Post a note.
	const body = `On the wall ${tag}`;
	await wall.getByLabel('Your note to The Neon Velvet').fill(body);
	await wall.getByRole('button', { name: 'Post', exact: true }).click();
	await expect(wall.getByRole('status')).toHaveText(/Your note is live on the Wall!|Note submitted for artist approval!/);
	const posted = wall.locator('.wall-note-item', { hasText: body });
	await expect(posted).toBeVisible();

	// Flag it from its "more" menu: the flag form posts and the page keeps working.
	await posted.getByRole('button', { name: /^More for the note from/ }).click();
	const flagResponse = page.waitForResponse((res) => res.url().includes('?/flagNote') && res.request().method() === 'POST');
	await posted.getByRole('button', { name: /^Flag the note from/ }).click();
	expect((await flagResponse).status()).toBe(200);
	await expectCurrent(page, 'page-wall');
	await noHorizontalScroll(page);
});

test('the Wall sheet opens from the bottom bar on every page, shows the thread, and posts from its composer', async ({ page }) => {
	const tag = uniqueTag();
	await signInAsDemoFan(page);
	await page.goto(`/i/${BROOKLYN}`);
	const ids = (await pageIds(page)).filter((id) => id !== 'page-cover');
	const dialog = page.locator('dialog[open]');

	for (const id of ids) {
		await goToStoryPage(page, id);
		await page.locator('.story-bar .story-wall').click();
		await expect(dialog.getByRole('heading', { name: 'The Wall' }), id).toBeVisible();
		await expect(dialog.locator('.wall-note-item').first(), id).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(dialog, id).toHaveCount(0);
		await expectCurrent(page, id);
	}

	// Post from the sheet: the note shows in the sheet and on the Wall page.
	await page.locator('.story-bar .story-wall').click();
	const body = `From the sheet ${tag}`;
	await dialog.getByLabel('Your note to The Neon Velvet').fill(body);
	await dialog.getByRole('button', { name: 'Post', exact: true }).click();
	await expect(dialog.getByRole('status')).toHaveText(/Your note is live on the Wall!|Note submitted for artist approval!/);
	await expect(dialog.locator('.wall-note-item', { hasText: body })).toBeVisible();
	await page.keyboard.press('Escape');
	await goToStoryPage(page, 'page-wall');
	await expect(page.locator('#page-wall .wall-note-item', { hasText: body })).toBeVisible();
});

test('the Wall sheet closes with swipe down, Escape and a tap outside, and keeps focus inside', async ({ page }) => {
	await signInAsDemoFan(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(`/i/${BROOKLYN}`);
	const ids = await pageIds(page);
	await goToStoryPage(page, ids[1]!);
	const wallButton = page.locator('.story-bar .story-wall');
	const dialog = page.locator('dialog[open]');

	// Escape, and focus returns to the Wall button.
	await wallButton.click();
	await expect(dialog).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(dialog).toHaveCount(0);
	await expect(wallButton).toBeFocused();

	// A tap outside the sheet.
	await wallButton.click();
	await expect(dialog).toBeVisible();
	await page.mouse.click(195, 30);
	await expect(dialog).toHaveCount(0);

	// A swipe down on the handle, once the sheet has finished sliding up.
	await wallButton.click();
	await dialog.locator('.sheet').evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
	const handle = (await dialog.locator('.sheet-grab').boundingBox())!;
	await page.mouse.move(handle.x + handle.width / 2, handle.y + 10);
	await page.mouse.down();
	await page.mouse.move(handle.x + handle.width / 2, handle.y + 220, { steps: 10 });
	await page.mouse.up();
	await expect(dialog).toHaveCount(0);

	// Focus stays in the sheet while it is open.
	await wallButton.click();
	await expect(dialog).toBeVisible();
	for (let i = 0; i < 15; i++) {
		await page.keyboard.press('Tab');
		expect(
			await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')) || document.activeElement === document.body),
			`Tab ${i + 1} stays in the sheet`
		).toBe(true);
	}
	await page.keyboard.press('Escape');
});

test('at 390 px the sheet composer stays visible with the keyboard open', async ({ page }) => {
	await signInAsDemoFan(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(`/i/${BROOKLYN}`);
	const ids = await pageIds(page);
	await goToStoryPage(page, ids[1]!);
	await page.locator('.story-bar .story-wall').click();
	const field = page.locator('dialog[open] textarea');
	await field.click();
	await expect(field).toBeFocused();

	// An on-screen keyboard takes the bottom ~40% of a phone screen: the visual viewport shrinks.
	await page.setViewportSize({ width: 390, height: 500 });
	await expect
		.poll(async () => {
			const box = (await field.boundingBox())!;
			const vv = await page.evaluate(() => ({ top: visualViewport!.offsetTop, height: visualViewport!.height }));
			return box.y >= vv.top && box.y + box.height <= vv.top + vv.height;
		}, { message: 'the composer is inside the visual viewport' })
		.toBe(true);
	await expect(page.locator('dialog[open] .wall-post')).toBeInViewport();
});

test('a signed-out Fan posting from the sheet keeps the draft and gets the sign-in sheet', async ({ page }) => {
	await blockRemotePhotos(page);
	await page.goto(`/i/${BROOKLYN}`);
	const ids = await pageIds(page);
	await goToStoryPage(page, ids[1]!);
	await page.locator('.story-bar .story-wall').click();
	const dialog = page.locator('dialog[open]');
	const draft = `Draft before sign-in ${uniqueTag()}`;
	await dialog.getByLabel('Your note to The Neon Velvet').fill(draft);
	await dialog.getByRole('button', { name: 'Sign in to post' }).click();

	await expect(page.locator('dialog[open]').getByRole('heading', { name: 'Sign in' })).toBeVisible();
	await expect(page.locator('dialog[open] form[action="?/googleAuth"] input[name="targetHash"]')).toHaveValue('#page-wall');
	expect(await page.evaluate(() => Object.entries(sessionStorage).find(([k]) => k.startsWith('quire_draft_'))?.[1])).toBe(draft);
});

test('the Endpaper: claim the Stamp after a scan, and a Stamped card shows it', async ({ page }) => {
	await signInAsNewFan(page, 'Stamp Fan');
	await page.goto(SCAN);
	await expect(page).toHaveURL(new RegExp(BROOKLYN));

	await goToStoryPage(page, 'page-endpaper');
	const endpaper = page.locator('#page-endpaper');
	await expect(endpaper.getByRole('heading', { name: "That's the zine." })).toBeVisible();
	// Save and Stamp are both there.
	await expect(endpaper.getByRole('button', { name: 'Save to My Stubs' })).toBeVisible();
	await endpaper.getByRole('button', { name: 'Claim your Stamp' }).click();

	const card = endpaper.locator('.stamped-card');
	await expect(card.locator('.stamped-title')).toHaveText('Stamped');
	await expect(card).toContainText("Baby's All Right");
	await expect(card).toContainText('Oct 12, 2026');
	await expect(endpaper.locator('.ink-stamp, .tape, .stamp')).toHaveCount(0);
	await expect(endpaper.getByText('In your Stubs')).toBeVisible();
	await expect(endpaper.getByRole('link', { name: 'My Stubs' })).toBeVisible();
	await expect(endpaper.getByRole('link', { name: "The Neon Velvet's page" })).toHaveAttribute('href', '/a/the-neon-velvet');
	await noHorizontalScroll(page);
});

test('the Endpaper: Save without a scan, and Stamp says what it needs', async ({ page }) => {
	await signInAsNewFan(page, 'Save Fan');
	await openStoryAt(page, `/i/${PHILLY}`, 'page-endpaper');
	const endpaper = page.locator('#page-endpaper');
	// Without the venue scan there is no Stamp to claim, and the page says why.
	await expect(endpaper.getByTestId('stamp-unavailable')).toHaveText('Stamp');
	await expect(endpaper.getByText(/scan the QR code at the venue/)).toBeVisible();
	await expect(endpaper.locator('form[action="?/claimStamp"]')).toHaveCount(0);

	await endpaper.getByRole('button', { name: 'Save to My Stubs' }).click();
	await expect(endpaper.getByText('In your Stubs')).toBeVisible();
	await expect(endpaper.getByRole('link', { name: 'My Stubs' })).toBeVisible();
});

for (const width of [320, 390]) {
	test(`at ${width} px the Wall, its sheet and the Endpaper fit, with 44 px targets and AA text`, async ({ browser, baseURL }) => {
		const context = await browser.newContext({ baseURL, viewport: { width, height: 720 } });
		const page = await context.newPage();
		await signInAsDemoFan(page);
		await page.goto(`/i/${BROOKLYN}`);

		for (const id of ['page-wall', 'page-endpaper']) {
			await goToStoryPage(page, id);
			await noHorizontalScroll(page, id);
			expect(await smallControls(page.locator(`#${id}`)), `${id} targets`).toEqual([]);
			for (const { text, ratio } of await contrastOf(page.locator(`#${id}`), 'h2, p, span, a, button, time, strong')) {
				expect(ratio, `${id}: "${text}"`).toBeGreaterThanOrEqual(4.5);
			}
		}

		await goToStoryPage(page, 'page-wall');
		await page.locator('#page-wall .wall-more-button').first().click();
		expect(await smallControls(page.locator('#page-wall .wall-menu')), 'more menu').toEqual([]);
		await page.keyboard.press('Escape');

		await page.locator('.story-bar .story-wall').click();
		const sheet = page.locator('dialog[open]');
		await expect(sheet).toBeVisible();
		await noHorizontalScroll(page, 'Wall sheet');
		expect(await smallControls(sheet), 'sheet targets').toEqual([]);
		for (const { text, ratio } of await contrastOf(sheet, 'h2, p, span, button, time')) {
			expect(ratio, `sheet: "${text}"`).toBeGreaterThanOrEqual(4.5);
		}
		await context.close();
	});
}
