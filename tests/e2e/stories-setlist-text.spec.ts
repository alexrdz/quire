import { test, expect, type Locator, type Page } from '@playwright/test';
import { postAction } from './helpers/actions';
import { issueForCity, seedZineContentIssue } from './helpers/db';
import { currentStoryPage, goToPageTitled } from './helpers/story';

/**
 * R-T03 (ADR 0011): the Stories reader's Setlist and Text pages.
 *
 * - Setlist: every song in order, numbered, with an "Encore" divider where a bare
 *   "Encore" or a "(Encore)" suffix marks it (see splitSetlist).
 *   A long list scrolls inside the page; scrolling never pages the reader, a tap still does.
 * - Text: a readable article, at most 65 characters a line, scrolling inside the page.
 * - Both: no horizontal scroll at 320 and 390 px, and AA text.
 *
 * Moved here from zine-content-pages.spec.ts (B1-T28): the setlist's songs and its last
 * song, the text page's words, and AA on the setlist and text.
 */

const RUN = crypto.randomUUID().slice(0, 8);
const ZINE_SLUG = `stories-st-${RUN}`;
const LONG_CITY = `Longlist ${RUN}`;
const SONGS = Array.from({ length: 30 }, (_, i) => `Song Number ${i + 1}`);
const LONG_BODY = Array.from(
	{ length: 40 },
	(_, i) => `Paragraph ${i + 1}: we loaded out at two in the morning and drove until the sun came up over the plains.`
).join(' ');
let longSlug = '';

test.beforeAll(async ({ browser, baseURL }) => {
	const context = await browser.newContext();
	const page = await context.newPage();
	// Signs in as the sample Artist (and seeds it on a fresh database).
	await page.goto(`${baseURL}/demo`);
	await expect(page).toHaveURL(/\/dashboard/);
	await seedZineContentIssue(ZINE_SLUG);

	// A 30-song setlist plus an encore, through Quick Issue as an Artist would make it.
	const quick = await postAction(page.request, baseURL!, '/dashboard/issues/quick', {
		city: LONG_CITY,
		venue: 'The Long Room',
		date: '2026-11-23',
		timezone: 'America/New_York',
		saveMode: 'published',
		// A bare "Encore" marks the encore; "(Encore)" is shown without the suffix.
		setlistSongs: [...SONGS, 'Encore', 'Last Song (Encore)'].join('\n')
	});
	expect(quick.type).not.toBe('failure');
	const issue = (await issueForCity(LONG_CITY))!;
	longSlug = issue.slug;
	// A long text page on the same Issue.
	const text = await postAction(page.request, baseURL!, `/dashboard/bookbinder/${issue.id}?/addPage`, {
		kind: 'text',
		title: 'Long Road',
		body: LONG_BODY
	});
	expect(text).toMatchObject({ type: 'success' });
	await context.close();
});

async function open(page: Page, width: number, slug: string) {
	const problems: string[] = [];
	page.on('console', (msg) => {
		if (/Content Security Policy|Refused to/i.test(msg.text())) problems.push(msg.text());
	});
	page.on('pageerror', (error) => problems.push(error.message));
	await page.setViewportSize({ width, height: 844 });
	await page.route('https://images.unsplash.com/**', (route) => route.abort());
	await page.goto(`/i/${slug}`);
	return problems;
}

/** WCAG contrast of each element's text against the first opaque background behind it. */
function contrastOf(scope: Locator, selector: string) {
	return scope.locator(selector).evaluateAll((els) =>
		els.map((el) => {
			const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
			const lum = ([r, g, b]: number[]) =>
				[r, g, b]
					.map((v) => v / 255)
					.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
					.reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
			// Text drawn at partial opacity: blend its colour over the background first.
			let node: Element | null = el;
			let bg = [0, 0, 0];
			while (node) {
				const parts = rgb(getComputedStyle(node).backgroundColor);
				if (parts.length >= 3 && (parts.length < 4 || parts[3] === 1)) {
					bg = parts.slice(0, 3);
					break;
				}
				node = node.parentElement;
			}
			const fgParts = rgb(getComputedStyle(el).color);
			const alpha = fgParts.length === 4 ? fgParts[3] : 1;
			const fg = fgParts.slice(0, 3).map((c, i) => c * alpha + bg[i] * (1 - alpha));
			const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
			return { text: el.textContent?.trim().slice(0, 30), ratio: (a + 0.05) / (b + 0.05) };
		})
	);
}

async function noSidewaysScroll(page: Page) {
	expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
	const overflowing = await page
		.locator('.story-page > section, .story-scroll')
		.evaluateAll((els) => els.filter((s) => s.scrollWidth > s.clientWidth + 1).map((s) => s.id || s.className));
	expect(overflowing).toEqual([]);
}

/** Wheel-scrolls the page's scroll area to its end and checks the reader stayed on this page. */
async function scrollsInsideWithoutPaging(page: Page, frame: Locator) {
	const id = (await frame.getAttribute('data-page-id'))!;
	const scroller = frame.locator('.story-scroll');
	const before = await scroller.evaluate((el) => ({ top: el.scrollTop, room: el.scrollHeight - el.clientHeight }));
	expect(before.room, 'the content is longer than the page').toBeGreaterThan(100);
	const box = (await scroller.boundingBox())!;
	await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
	for (let i = 0; i < 20; i++) await page.mouse.wheel(0, 400);
	await expect.poll(() => scroller.evaluate((el) => Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight - 1)).toBe(true);
	// A vertical drag on the list (a scroll on touch) does not page either.
	await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.7);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.2, { steps: 8 });
	await page.mouse.up();
	// A mouse drag selects text, and the reader rightly ignores a tap while text is selected.
	// A touch scroll selects nothing, so clear it as a finger would leave it.
	await page.evaluate(() => getSelection()?.removeAllRanges());
	await page.waitForTimeout(350);
	await expect(currentStoryPage(page)).toHaveAttribute('data-page-id', id);
	return id;
}

for (const width of [320, 390]) {
	test(`the setlist: every song in order, numbered, with no decoration, AA (${width} px)`, async ({ page }) => {
		const problems = await open(page, width, ZINE_SLUG);
		const setlist = await goToPageTitled(page, 'Zine Setlist');
		// The songs as written, in order, numbered 01..03. "Encore Song" is an ordinary title:
		// only a bare "Encore" or a "(Encore)" suffix starts the encore, so there is no divider.
		await expect(setlist.locator('.setlist-song')).toHaveText(['Opener', 'Second Song', 'Encore Song']);
		await expect(setlist.locator('.setlist-num')).toHaveText(['01', '02', '03']);
		await expect(setlist.locator('.setlist-song').first()).toBeVisible();
		await expect(setlist.locator('.setlist-encore')).toHaveCount(0);
		// No decoration that isn't information.
		await expect(setlist.locator('.setlist-tag')).toHaveCount(0);
		// The heading uses the Artist's type pairing; the songs use the reader's system font.
		await expect(setlist.locator('.story-setlist-title')).toBeVisible();
		for (const { text, ratio } of await contrastOf(setlist, '.story-setlist-venue, .story-setlist-title, .setlist-num, .setlist-song')) {
			expect(ratio, text).toBeGreaterThanOrEqual(4.5);
		}
		await noSidewaysScroll(page);
		expect(problems).toEqual([]);
	});

	test(`a 30-song setlist scrolls inside the page without paging, and a tap still pages (${width} px)`, async ({ page }) => {
		const problems = await open(page, width, longSlug);
		const setlist = await goToPageTitled(page, "Tonight's Setlist");
		// The bare "Encore" is the divider; "Last Song (Encore)" is listed as "Last Song", numbered on from 30.
		await expect(setlist.locator('.setlist-song')).toHaveText([...SONGS, 'Last Song']);
		await expect(setlist.locator('.setlist-num').last()).toHaveText('31');
		await expect(setlist.locator('h3.setlist-encore')).toHaveText('Encore');
		const order = await setlist.locator('.setlist-encore, .setlist-song').evaluateAll((els) => els.map((e) => e.textContent?.trim()));
		expect(order.slice(-3)).toEqual(['Song Number 30', 'Encore', 'Last Song']);
		for (const { text, ratio } of await contrastOf(setlist, '.setlist-encore')) {
			expect(ratio, text).toBeGreaterThanOrEqual(4.5);
		}
		const id = await scrollsInsideWithoutPaging(page, setlist);
		await expect(setlist.locator('.setlist-song').last()).toBeInViewport();
		// A tap on the right of the list still goes forward.
		const box = (await setlist.locator('.story-scroll').boundingBox())!;
		await page.mouse.click(box.x + box.width * 0.85, box.y + box.height * 0.5);
		await expect(currentStoryPage(page)).not.toHaveAttribute('data-page-id', id);
		await noSidewaysScroll(page);
		expect(problems).toEqual([]);
	});

	test(`a long text page is a 65ch article that scrolls inside the page (${width} px)`, async ({ page }) => {
		const problems = await open(page, width, longSlug);
		const text = await goToPageTitled(page, 'Long Road');
		const body = text.locator('.story-article-body');
		await expect(body).toHaveText(LONG_BODY);
		await expect(body).toHaveCSS('font-family', /system-ui|-apple-system/);
		// At most 65 characters a line: the body is never wider than 65 of its own "0"s.
		const measure = await body.evaluate((el) => {
			const probe = document.createElement('span');
			probe.textContent = '0'.repeat(65);
			probe.style.font = getComputedStyle(el).font;
			probe.style.position = 'absolute';
			probe.style.visibility = 'hidden';
			document.body.append(probe);
			const limit = probe.getBoundingClientRect().width;
			probe.remove();
			const article = el.closest('article')!;
			return { width: el.getBoundingClientRect().width, limit, cap: parseFloat(getComputedStyle(article).maxInlineSize) };
		});
		expect(measure.width).toBeLessThanOrEqual(measure.limit + 1);
		// The reader's column is narrower than 65ch on a phone, so the cap itself is checked too:
		// the article is capped at 65 characters wherever it is shown wider (the Bookbinder preview).
		expect(measure.cap).toBeCloseTo(measure.limit, -1);
		await scrollsInsideWithoutPaging(page, text);
		for (const { text: t, ratio } of await contrastOf(text, '.story-article-title, .story-article-body')) {
			expect(ratio, t).toBeGreaterThanOrEqual(4.5);
		}
		await noSidewaysScroll(page);
		expect(problems).toEqual([]);
	});

	test(`a text page keeps its words (${width} px)`, async ({ page }) => {
		const problems = await open(page, width, ZINE_SLUG);
		const text = await goToPageTitled(page, 'Zine Text');
		await expect(text.locator('.story-article-body')).toHaveText('Words on a scrap.');
		await noSidewaysScroll(page);
		expect(problems).toEqual([]);
	});
}
