import { expect, type Locator, type Page } from '@playwright/test';

/**
 * The Stories reader (ADR 0011) shows one page at a time; every page is in the
 * DOM, but only the current one is visible and reachable. These helpers open
 * a page the way a Fan's link would (by its URL hash) and wait until it is the
 * settled, current page.
 */

/** The frame of the page with this id: `page-cover`, `page-content-2`, `page-wall`, `page-endpaper`. */
export function storyPage(page: Page, id: string): Locator {
	return page.locator(`.story-page[data-page-id="${id}"]`);
}

/** The frame of the page on screen. */
export function currentStoryPage(page: Page): Locator {
	return page.locator('.story-page[data-place="current"]');
}

/** Waits until the reader is hydrated and the page with this id is the current page, fully faded in. */
export async function expectCurrent(page: Page, id: string): Promise<Locator> {
	// Hydrated: the reader turns transitions on only once it is running, so taps after this are handled.
	await expect(page.locator('.story-reader.is-ready')).toBeAttached();
	const frame = storyPage(page, id);
	await expect(frame).toHaveAttribute('data-place', 'current');
	await expect.poll(() => frame.evaluate((el) => Number(getComputedStyle(el).opacity)), { message: `${id} fades in` }).toBe(1);
	await expect.poll(() => frame.evaluate((el) => getComputedStyle(el).transform), { message: `${id} slides in` }).toBe('none');
	return frame;
}

/** Opens `/i/<slug>` at the page with this id, as a shared link would. */
export async function openStoryAt(page: Page, path: string, id: string): Promise<Locator> {
	await page.goto(`${path}#${id}`);
	return expectCurrent(page, id);
}

/** The id of the content page whose heading is `title`. */
export async function pageIdTitled(page: Page, title: string): Promise<string> {
	const frame = page.locator('.story-page').filter({ has: page.locator('h1, h2', { hasText: title }) }).first();
	await expect(frame, `a page titled "${title}"`).toBeAttached();
	return (await frame.getAttribute('data-page-id'))!;
}

/**
 * Moves the open reader to the page whose heading is `title`, through the URL
 * hash (the reader follows hash changes), and returns its frame once current.
 */
export async function goToPageTitled(page: Page, title: string): Promise<Locator> {
	const id = await pageIdTitled(page, title);
	await page.evaluate((hash) => (location.hash = hash), id);
	return expectCurrent(page, id);
}

/** The announcement a screen reader hears on a page change. */
export function announcement(page: Page): Locator {
	return page.getByTestId('story-announcement');
}

/**
 * Opens the tip sheet: from the Cover's "Other amount" (its amount pills are
 * Venmo buttons themselves), or from the bottom bar's Tip pill on any other page.
 */
export async function openTipSheet(page: Page): Promise<Locator> {
	const cover = page.locator('.story-page[data-place="current"] .story-tip-other');
	if (await cover.count()) await cover.click();
	else await page.locator('.story-bar .story-tip').click();
	const panel = page.locator('dialog[open] .venmo-tip-panel');
	await expect(panel).toBeVisible();
	return panel;
}

/** Moves the open reader to the page with this id through the URL hash, and waits until it is current. */
export async function goToStoryPage(page: Page, id: string): Promise<Locator> {
	await page.evaluate((hash) => (location.hash = hash), id);
	return expectCurrent(page, id);
}
