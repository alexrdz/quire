import { expect, type Page } from '@playwright/test';

/**
 * B1-T03, now in the Stories reader (ADR 0011): checks for the sample Issues'
 * multi-photo pages, shared by the test-mode and Demo-mode specs. Unsplash is stubbed with a tiny PNG (the e2e suite never
 * uses the network). The browser still applies the CSP to the real Unsplash
 * URL, so a missing img-src entry would show up as a violation.
 */

export const BROOKLYN_ISSUE_PATH = '/i/neon-velvet-brooklyn-2026-10-12';
export const PHILLY_ISSUE_PATH = '/i/neon-velvet-philly-2026-10-15';

const TINY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);

/** Starts collecting CSP violations and console errors; call before `goto`. */
export async function watchPage(page: Page): Promise<() => Promise<string[]>> {
	const problems: string[] = [];
	page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
	page.on('console', (msg) => {
		const text = msg.text();
		if (msg.type() === 'error' || /Content Security Policy|Refused to/i.test(text)) problems.push(text);
	});
	await page.addInitScript(() => {
		const list: string[] = [];
		(window as unknown as { __csp: string[] }).__csp = list;
		document.addEventListener('securitypolicyviolation', (e) => {
			list.push(`${e.violatedDirective} ${e.blockedURI}`);
		});
	});
	await page.route('https://images.unsplash.com/**', (route) =>
		route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG })
	);
	return async () => {
		const fromEvents = await page
			.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? [])
			.catch(() => []);
		return [...problems, ...fromEvents];
	};
}

/** The first photo page of an Issue: its frame in the Stories reader (ADR 0011). */
export function photoPageOn(page: Page) {
	return page.locator('.story-page').filter({ has: page.locator('section.story-photo') }).first();
}

/**
 * Opens the reader's first photo page and walks its photos the way a Fan does,
 * one tap on the right of the page per photo. Each photo is its own segment:
 * it must be the only photo showing, load, and be named in the URL hash and
 * the announcement. Returns each photo's caption (or null) in order.
 */
export async function walkPhotos(page: Page): Promise<Array<string | null>> {
	const frame = photoPageOn(page);
	const id = (await frame.getAttribute('data-page-id'))!;
	await page.evaluate((hash) => (location.hash = hash), id);
	await expect(frame).toHaveAttribute('data-place', 'current');

	const total = await frame.locator('img.story-photo-img').count();
	const captions: Array<string | null> = [];
	for (let i = 0; i < total; i++) {
		const showing = frame.locator('img.story-photo-img.is-current');
		await expect(showing).toHaveCount(1);
		await expect(showing).toHaveAttribute('src', /^https:\/\/images\.unsplash\.com\/photo-/);
		await expect
			.poll(() => showing.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), {
				message: `photo ${i + 1} loads`
			})
			.toBe(true);
		await expect(page).toHaveURL(new RegExp(`#${id}${i === 0 ? '$' : `-photo-${i + 1}$`}`));
		if (total > 1) await expect(frame.locator('.story-photo-count')).toHaveText(`${i + 1} / ${total}`);

		const caption = frame.locator('.story-photo-caption');
		captions.push((await caption.count()) ? (await caption.textContent())?.trim() || null : null);

		// A tap on the right two-thirds of the page, clear of the bars.
		const box = (await page.locator('.story-column').boundingBox())!;
		await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.4);
	}
	// After the last photo the reader moved on to the next page.
	await expect(frame).toHaveAttribute('data-place', 'before');
	return captions;
}
