import { test, expect, type Page } from '@playwright/test';

/**
 * Z-T08: the floating Tip button never covers a page's Prev or Next button
 * (ADR 0009: nothing covers a control), and Prev, Next and the Tip button are
 * at least 44 px. Checked on every page of the seeded Brooklyn Issue.
 */

const ISSUE = '/i/neon-velvet-brooklyn-2026-10-12';

interface Box {
	text: string;
	left: number;
	right: number;
	top: number;
	bottom: number;
	height: number;
	width: number;
}

async function measure(page: Page, pageId: string): Promise<{ tip: Box; nav: Box[] }> {
	return page.evaluate((id) => {
		const box = (el: Element): Box => {
			const r = el.getBoundingClientRect();
			const h = el as HTMLElement;
			return {
				text: (el.textContent ?? '').trim(),
				left: r.left,
				right: r.right,
				top: r.top,
				bottom: r.bottom,
				// Layout size, which ignores the scroll-driven page-turn transform.
				height: h.offsetHeight,
				width: h.offsetWidth
			};
		};
		const tip = document.querySelector('.btn-floating-tip');
		if (!tip) throw new Error('no floating Tip button');
		return { tip: box(tip), nav: [...document.querySelectorAll(`#${id} .page-footer button`)].map(box) };
	}, pageId);
}

const intersects = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

for (const width of [390, 320]) {
	test(`at ${width} px, on every page, the Tip button never covers Prev or Next, and all are 44 px or more`, async ({
		browser,
		baseURL
	}) => {
		const context = await browser.newContext({ baseURL, viewport: { width, height: 844 } });
		const page = await context.newPage();
		await page.route('https://images.unsplash.com/**', (route) => route.abort());
		await page.goto(ISSUE);

		const pageIds = await page.locator('.book-container > section.page').evaluateAll((els) => els.map((el) => el.id));
		// Cover, the content pages, the Wall and the Endpaper.
		expect(pageIds).toContain('page-wall');
		expect(pageIds).toContain('page-endpaper');
		expect(pageIds.filter((id) => id.startsWith('page-content-')).length).toBeGreaterThan(0);

		let checkedButtons = 0;
		for (const id of pageIds) {
			await page.locator(`#${id}`).scrollIntoViewIfNeeded();
			// Let the snap and the scroll-driven page turn settle: the page is flat when it
			// sits at the left edge and its footer buttons share one row at their layout height.
			await expect
				.poll(
					async () =>
						page.locator(`#${id}`).evaluate((el) => {
							if (Math.round(el.getBoundingClientRect().left) !== 0) return false;
							const rows = [...el.querySelectorAll('.page-footer button')].map((b) => b.getBoundingClientRect());
							return rows.every(
								(r, _, all) =>
									Math.abs(r.top - all[0]!.top) < 1 &&
									Math.abs(r.height - (el.querySelector('.page-footer button') as HTMLElement).offsetHeight) < 1
							);
						}),
					{ message: `${id} settles flat` }
				)
				.toBe(true);

			const { tip, nav } = await measure(page, id);
			expect(tip.height, `${id}: Tip button height`).toBeGreaterThanOrEqual(44);
			expect(tip.width, `${id}: Tip button width`).toBeGreaterThanOrEqual(44);

			for (const button of nav) {
				expect(button.height, `${id}: "${button.text}" height`).toBeGreaterThanOrEqual(44);
				expect(button.width, `${id}: "${button.text}" width`).toBeGreaterThanOrEqual(44);
				expect(intersects(button, tip), `${id}: "${button.text}" is clear of the Tip button`).toBe(false);
				checkedButtons++;
			}

			const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
			expect(overflow, `${id}: no horizontal scroll`).toBeLessThanOrEqual(0);
		}
		// Every inner page has a Prev and a Next.
		expect(checkedButtons).toBe((pageIds.length - 1) * 2);
		await context.close();
	});
}

test('the Tip button still takes the Fan to the Venmo tip panel from an inner page', async ({ page }) => {
	await page.route('https://images.unsplash.com/**', (route) => route.abort());
	await page.goto(ISSUE);
	await page.locator('#page-wall').scrollIntoViewIfNeeded();
	await page.locator('.btn-floating-tip').click();
	await expect(page).toHaveURL(/#tip$/);
	await expect(page.locator('#tip.venmo-tip-panel')).toBeInViewport();
});
