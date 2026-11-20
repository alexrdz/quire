import { expect, type Page } from '@playwright/test';

/**
 * B1-T03: checks for the sample Issues' photo piles, shared by the test-mode
 * and Demo-mode specs. Unsplash is stubbed with a tiny PNG (the e2e suite never
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

/** The photo page's pile on an Issue page. */
export function pileOn(page: Page) {
	return page.locator('.pile-stage');
}

/**
 * Walks the pile from the top, checking that each photo loads and that the Flip
 * control matches its caption. Returns the caption (or null) of each photo in order.
 */
export async function walkPile(page: Page): Promise<Array<string | null>> {
	const stage = pileOn(page);
	const total = await stage.locator('.polaroid').count();
	const controls = page.locator('.pile-controls');
	const captions: Array<string | null> = [];

	for (let i = 0; i < total; i++) {
		const top = stage.locator('.polaroid[data-state="top"]');
		await expect(top).toHaveCount(1);
		const img = top.locator('img');
		await expect(img).toHaveAttribute('src', /^https:\/\/images\.unsplash\.com\/photo-/);
		await expect
			.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), {
				message: `photo ${i + 1} loads`
			})
			.toBe(true);

		const caption = (await top.locator('.polaroid-note').textContent())?.trim() || null;
		captions.push(caption);
		const flip = controls.getByRole('button', { name: 'Flip' });
		const body = top.locator('.polaroid-body');
		if (caption) {
			await expect(flip, `photo ${i + 1} flips`).toBeEnabled();
			await flip.click();
			await expect(body).toHaveAttribute('data-side', 'back');
			await flip.click();
			await expect(body).toHaveAttribute('data-side', 'front');
		} else {
			await expect(flip, `photo ${i + 1} has no caption to flip to`).toBeDisabled();
		}
		await controls.getByRole('button', { name: 'Toss' }).click();
	}

	await expect(stage.getByText('End of the pile')).toBeVisible();
	return captions;
}
