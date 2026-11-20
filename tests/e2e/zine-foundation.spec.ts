import { test, expect, type Page } from '@playwright/test';

/**
 * ADR 0009 foundation (Z-T04): the Issue reader is cut-and-paste on dark.
 * These check the Rules, not the pixels: grain on every page, the accent
 * faces loaded from 'self', tape and stamps never covering a control, text
 * tilted at most about 2 degrees, 44 px tip targets, 320 px without
 * horizontal scroll, and a fade instead of a page turn under reduced motion.
 */

const ISSUE = '/i/neon-velvet-brooklyn-2026-10-12';
const TINY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);

/** Unsplash is offline in e2e; the browser still applies the CSP to the real URL. */
async function open(page: Page, width: number) {
	const problems: string[] = [];
	page.on('console', (msg) => {
		if (/Content Security Policy|Refused to/i.test(msg.text())) problems.push(msg.text());
	});
	page.on('pageerror', (error) => problems.push(error.message));
	await page.setViewportSize({ width, height: 844 });
	await page.route('https://images.unsplash.com/**', (route) =>
		route.fulfill({ status: 200, contentType: 'image/png', body: TINY_PNG })
	);
	await page.goto(ISSUE);
	await page.evaluate(() => document.fonts.ready);
	return problems;
}

/** True when an element's transform is at rest (none or the identity matrix). */
function isFlat(page: Page, selector: string) {
	return page.locator(selector).evaluate((el) => {
		const t = getComputedStyle(el).transform;
		return t === 'none' || new DOMMatrixReadOnly(t).isIdentity;
	});
}

/** The rotation, in degrees, an element's own transform applies. */
function rotationOf(page: Page, selector: string) {
	return page.locator(selector).evaluateAll((els) =>
		els.map((el) => {
			const m = new DOMMatrixReadOnly(getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform);
			return Math.abs((Math.atan2(m.b, m.a) * 180) / Math.PI);
		})
	);
}

for (const width of [390, 320]) {
	test(`the reader is cut-and-paste on dark at ${width} px`, async ({ page }) => {
		const problems = await open(page, width);

		// No horizontal page scroll (the book scrolls sideways inside its own container).
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow).toBeLessThanOrEqual(0);

		// Every page is dark paper with the grain, not glass.
		const sections = page.locator('.book-container > section');
		const count = await sections.count();
		expect(count).toBeGreaterThan(3);
		for (let i = 0; i < count; i++) {
			const section = sections.nth(i);
			await expect(section, `page ${i}`).toHaveClass(/zine-paper/);
			expect(await section.evaluate((el) => getComputedStyle(el).backgroundImage), `page ${i} grain`).toContain(
				'feTurbulence'
			);
		}

		// The accent faces come from 'self' and are in use.
		expect(await page.evaluate(() => document.fonts.check("16px 'Special Elite'"))).toBe(true);
		await expect(page.locator('#page-cover .type-label').first()).toHaveCSS('font-family', /Special Elite/);

		// The Cover: a taped, tilted print; typed labels; the cover note on a typed slip.
		const print = page.locator('#page-cover .cover-print');
		await expect(print).toBeVisible();
		await expect(print.locator('.tape')).toHaveCount(2);
		const [printTilt] = await rotationOf(page, '#page-cover .cover-print');
		expect(printTilt).toBeGreaterThan(1);
		await expect(page.locator('#page-cover .type-label')).toHaveText([/2026-10-12/, /Brooklyn/i, /Baby's All Right/i]);

		// Text never tilts beyond about 2 degrees.
		for (const tilt of await rotationOf(page, '.scrap, .type-label')) {
			expect(tilt).toBeLessThanOrEqual(2.05);
		}

		// Tape and stamps never cover a control.
		const overlaps = await page.evaluate(() => {
			const deco = [...document.querySelectorAll('.tape, .stamp, .cover-print')];
			const controls = [...document.querySelectorAll('a[href], button, input, textarea, select')];
			const hits: string[] = [];
			for (const d of deco) {
				const a = d.getBoundingClientRect();
				for (const c of controls) {
					if (d.contains(c)) continue;
					const b = c.getBoundingClientRect();
					if (b.width === 0 || b.height === 0) continue;
					const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
					const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
					if (x > 0.5 && y > 0.5) hits.push(`${d.className} over ${c.textContent?.trim() || c.tagName}`);
				}
			}
			return hits;
		});
		expect(overlaps).toEqual([]);

		// The Venmo tip stays obvious and easy to tap.
		const panel = page.locator('#page-cover .venmo-tip-panel');
		await expect(panel).toBeVisible();
		for (const target of await panel.locator('.venmo-tip-preset, .venmo-tip-go').all()) {
			const box = (await target.boundingBox())!;
			expect(box.height, await target.innerText()).toBeGreaterThanOrEqual(44);
			expect(box.width, await target.innerText()).toBeGreaterThanOrEqual(44);
		}
		const [panelTilt] = await rotationOf(page, '#page-cover .venmo-tip-panel');
		expect(panelTilt).toBe(0);

		// The page shell: typed labels and a typed page number.
		const shell = page.locator('#page-content-0');
		await expect(shell.locator('.type-label')).toHaveCount(2);
		await expect(shell.locator('.subtext-page')).toHaveCSS('font-family', /Special Elite/);

		expect(problems).toEqual([]);
	});
}

test('pages turn as they are swiped, and sit flat when snapped', async ({ page }) => {
	await open(page, 390);
	const inner = page.locator('#page-cover > .page-inner');
	await expect(inner).toHaveCSS('animation-name', 'zine-page-turn');
	// Snapped: the turn is at rest, so nothing is skewed while reading.
	expect(await isFlat(page, '#page-cover > .page-inner')).toBe(true);

	// Half a page into a swipe, the next page is mid-turn.
	await page.locator('.book-container').evaluate((el) => el.scrollTo({ left: el.clientWidth / 2 }));
	await expect.poll(() => isFlat(page, '#page-content-0 > .page-inner')).toBe(false);
});

test('with reduced motion the page turn is only a fade', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await open(page, 390);
	const inner = page.locator('#page-cover > .page-inner');
	await expect(inner).toHaveCSS('animation-name', 'zine-page-fade');
	await page.locator('.book-container').evaluate((el) => el.scrollTo({ left: el.clientWidth / 2 }));
	const next = page.locator('#page-content-0 > .page-inner');
	await expect.poll(() => next.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeLessThan(1);
	expect(await isFlat(page, '#page-content-0 > .page-inner')).toBe(true);
});
