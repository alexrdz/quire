import { test, expect, type APIRequestContext } from '@playwright/test';
import { postAction } from './helpers/actions';
import { issueForCity } from './helpers/db';

/**
 * B1-T34: a draft Issue is the Artist's alone. On main before this fix, /i/<slug> served a
 * draft to anyone. Every public path now treats a draft as missing; published and archived
 * Issues still load.
 */

const RUN = crypto.randomUUID().slice(0, 8);
const DRAFT_CITY = `Secretville ${RUN}`;
const ARCHIVED_CITY = `Oldtown ${RUN}`;
let draft = { id: '', slug: '' };
let archived = { id: '', slug: '' };

test.beforeAll(async ({ browser, baseURL }) => {
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto(`${baseURL}/demo`);
	await expect(page).toHaveURL(/\/dashboard/);
	const base = { venue: 'The Back Room', date: '2026-11-25', timezone: 'America/New_York', setlistSongs: 'Unreleased' };
	expect((await postAction(page.request, baseURL!, '/dashboard/issues/quick', { ...base, city: DRAFT_CITY, saveMode: 'draft' })).type).not.toBe('failure');
	draft = (await issueForCity(DRAFT_CITY))!;
	// An archived Issue, as an Artist makes one: published, then archived in the Bookbinder.
	expect((await postAction(page.request, baseURL!, '/dashboard/issues/quick', { ...base, city: ARCHIVED_CITY, saveMode: 'published' })).type).not.toBe('failure');
	archived = (await issueForCity(ARCHIVED_CITY))!;
	const save = await postAction(page.request, baseURL!, `/dashboard/bookbinder/${archived.id}?/save`, {
		city: ARCHIVED_CITY,
		venue: base.venue,
		date: base.date,
		timezone: base.timezone,
		status: 'archived'
	});
	expect(save).toMatchObject({ type: 'success' });
	await context.close();
});

/** A request context signed in as the sample Fan, or the sample Artist. */
async function signedIn(browser: import('@playwright/test').Browser, baseURL: string, role: 'fan' | 'artist') {
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto(`${baseURL}/demo?role=${role}&redirect=${role === 'fan' ? '/me/stubs' : '/dashboard'}`);
	return { context, request: page.request as APIRequestContext };
}

test('a draft is 404 at /i/<slug> for a signed-out visitor, a Fan, and any Artist, even its owner', async ({ browser, baseURL }) => {
	const anon = await browser.newContext();
	const response = await anon.request.get(`${baseURL}/i/${draft.slug}`);
	expect(response.status(), 'signed out').toBe(404);
	expect(await response.text()).not.toContain(DRAFT_CITY);
	await anon.close();

	for (const role of ['fan', 'artist'] as const) {
		const { context, request } = await signedIn(browser, baseURL!, role);
		const res = await request.get(`${baseURL}/i/${draft.slug}`);
		expect(res.status(), role).toBe(404);
		expect(await res.text(), role).not.toContain(DRAFT_CITY);
		await context.close();
	}
});

test('a published and an archived Issue still load at /i/', async ({ request }) => {
	expect((await request.get('/i/neon-velvet-brooklyn-2026-10-12')).status()).toBe(200);
	const res = await request.get(`/i/${archived.slug}`);
	expect(res.status()).toBe(200);
	expect(await res.text()).toContain(ARCHIVED_CITY);
});

test('scanning a draft issues no Scan Token', async ({ browser, baseURL }) => {
	const anon = await browser.newContext();
	const res = await anon.request.get(`${baseURL}/scan/${draft.slug}?k=anything`, { maxRedirects: 0 });
	expect(res.status()).toBe(403);
	expect(res.headers()['set-cookie'] ?? '').not.toContain('quire_scan_');
	expect((await anon.cookies()).filter((c) => c.name.startsWith('quire_scan_'))).toEqual([]);
	await anon.close();
});

test('a Tip Tap, a Wall post, a Save or a Stamp against a draft is refused', async ({ browser, baseURL }) => {
	// Tip Tap: the endpoint answers "not found" and records nothing.
	const anon = await browser.newContext();
	const tap = await anon.request.post(`${baseURL}/api/tip-tap`, {
		data: { artistSlug: 'the-neon-velvet', issueSlug: draft.slug, amountCents: 500 }
	});
	expect(tap.status()).toBe(404);
	await anon.close();

	// As a signed-in Fan: the Wall, Save and Stamp.
	const { context, request } = await signedIn(browser, baseURL!, 'fan');
	const wall = await postAction(request, baseURL!, `/i/${draft.slug}?/submitNote`, { body: 'A note on a draft' });
	expect(wall).toMatchObject({ type: 'failure', status: 404 });
	const save = await postAction(request, baseURL!, `/i/${draft.slug}?/saveIssue`, { issueId: draft.id });
	expect(save).toMatchObject({ type: 'failure', status: 400 });
	expect(String((save as { data?: unknown }).data)).toContain('Issue does not exist');
	const stamp = await postAction(request, baseURL!, `/i/${draft.slug}?/claimStamp`, { issueId: draft.id });
	expect(stamp.type).toBe('failure');
	// And the draft never shows in the Fan's Stubs.
	const stubs = await request.get(`${baseURL}/me/stubs`);
	expect(await stubs.text()).not.toContain(DRAFT_CITY);
	await context.close();
});
