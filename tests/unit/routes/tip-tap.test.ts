import crypto from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { render } from 'svelte/server';
import { db, schema } from '$lib/server/db';
import { seedDatabase } from '$lib/server/seed';
import { RATE_LIMITS } from '$lib/server/services/rate-limit';
import { countTipTaps, recordTipTap } from '$lib/server/services/tip-taps';
import { POST as tipTapPOST } from '../../../src/routes/api/tip-tap/+server';
import VenmoTipPanel from '$lib/components/tips/VenmoTipPanel.svelte';
import { demoVenmoMessage, formatTipTaps } from '$lib/components/tips/tip-taps';
import BackPage from '../../../src/routes/(site)/a/[slug]/+page.svelte';
import { ALL_FEATURES_ON, featuresWith } from '../helpers/features';
import { uniqueClientAddress } from '../helpers/client';

/**
 * Tip Taps (ADR 0008, PRODUCTION_PLAN V.4): the /api/tip-tap endpoint, the
 * tip-taps service, and the Venmo tip panel.
 */

const createdUserIds: string[] = [];

beforeAll(async () => {
	await seedDatabase();
});

afterEach(() => {
	vi.restoreAllMocks();
});

afterAll(async () => {
	for (const id of createdUserIds) {
		await db.delete(schema.users).where(eq(schema.users.id, id));
	}
});

/** An Artist (with a Venmo username unless told otherwise) and one published Issue. */
async function createArtist(opts: { venmoUsername?: string | null } = {}) {
	const userId = crypto.randomUUID();
	const artistId = crypto.randomUUID();
	const suffix = crypto.randomBytes(4).toString('hex');
	const slug = `tap-band-${suffix}`;
	const issueId = crypto.randomUUID();
	const issueSlug = `${slug}-austin-2031-03-14`;
	const draftSlug = `${slug}-draft`;
	const now = new Date();
	createdUserIds.push(userId);

	await db.insert(schema.users).values({
		id: userId,
		name: 'Tap Band',
		email: `${slug}@example.com`,
		emailVerified: true,
		accountType: 'artist',
		createdAt: now,
		updatedAt: now
	});
	await db.insert(schema.artists).values({
		id: artistId,
		userId,
		slug,
		displayName: 'Tap Band',
		venmoUsername: opts.venmoUsername === undefined ? 'tap-band-venmo' : opts.venmoUsername,
		createdAt: now,
		updatedAt: now
	});
	for (const [id, s, status] of [
		[issueId, issueSlug, 'published'],
		[crypto.randomUUID(), draftSlug, 'draft']
	] as const) {
		await db.insert(schema.issues).values({
			id,
			artistId,
			slug: s,
			city: 'Austin',
			venue: 'Mohawk',
			date: '2031-03-14',
			timezone: 'America/Chicago',
			secretKey: crypto.randomBytes(16).toString('hex'),
			status,
			createdAt: now,
			updatedAt: now
		});
	}
	return { artistId, slug, issueId, issueSlug, draftSlug };
}

function cookieJar() {
	const store = new Map<string, string>();
	return {
		store,
		get: (name: string) => store.get(name),
		getAll: () => [...store].map(([name, value]) => ({ name, value })),
		set: (name: string, value: string) => void store.set(name, value),
		delete: (name: string) => void store.delete(name),
		serialize: (name: string, value: string) => `${name}=${value}`
	};
}

async function postTap(
	body: unknown,
	opts: { cookies?: ReturnType<typeof cookieJar>; getClientAddress?: () => string } = {}
) {
	const response = (await tipTapPOST({
		request: new Request('http://localhost:5173/api/tip-tap', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: typeof body === 'string' ? body : JSON.stringify(body)
		}),
		cookies: opts.cookies ?? cookieJar(),
		getClientAddress: opts.getClientAddress ?? uniqueClientAddress()
	} as never)) as Response;
	return { status: response.status, json: (await response.json()) as Record<string, unknown> };
}

const tapsFor = async (artistId: string) =>
	db.select().from(schema.tipTaps).where(eq(schema.tipTaps.artistId, artistId));

describe('/api/tip-tap', () => {
	it('records an Issue tap with ids derived from the slugs, ignoring any ids the client sends', async () => {
		const artist = await createArtist();
		const other = await createArtist();

		const res = await postTap({
			artistSlug: artist.slug,
			issueSlug: artist.issueSlug,
			amountCents: 500,
			artistId: other.artistId,
			issueId: other.issueId
		});
		expect(res).toEqual({ status: 201, json: { recorded: true } });

		const taps = await tapsFor(artist.artistId);
		expect(taps).toHaveLength(1);
		expect(taps[0]).toMatchObject({ issueId: artist.issueId, amountSelectedCents: 500 });
		expect(await tapsFor(other.artistId)).toHaveLength(0);
	});

	it('records a General tap (no Issue) for the Back Page', async () => {
		const artist = await createArtist();
		for (const issueSlug of [null, 'general']) {
			const res = await postTap({ artistSlug: artist.slug, issueSlug, amountCents: 300 + (issueSlug ? 100 : 0) });
			expect(res.status).toBe(201);
		}
		const counts = await countTipTaps(artist.artistId);
		expect(counts).toEqual({ total: 2, general: 2, byIssue: {} });
	});

	it.each([
		['an amount below 2 dollars', { amountCents: 199 }],
		['an amount above 500 dollars', { amountCents: 50001 }],
		['fractional cents', { amountCents: 500.5 }],
		['amount as a string', { amountCents: '500' }],
		['missing artist', { artistSlug: undefined }],
		['malformed artist slug', { artistSlug: '../admin' }],
		['malformed Issue slug', { issueSlug: 'x y' }]
	])('rejects %s with 400 and records nothing', async (_label, override) => {
		const artist = await createArtist();
		const res = await postTap({ artistSlug: artist.slug, issueSlug: artist.issueSlug, amountCents: 500, ...override });
		expect(res.status).toBe(400);
		expect(res.json).toEqual({ recorded: false, reason: 'invalid' });
		expect(await tapsFor(artist.artistId)).toHaveLength(0);
	});

	it('rejects a body that is not JSON, or too large, without throwing', async () => {
		expect((await postTap('not json')).status).toBe(400);
		expect((await postTap('x'.repeat(5000))).status).toBe(400);
	});

	it('does not record for an unknown Artist, an Artist without Venmo, a draft or another Artist\'s Issue', async () => {
		const artist = await createArtist();
		const noVenmo = await createArtist({ venmoUsername: null });
		const other = await createArtist();

		const cases = [
			{ artistSlug: `nobody-${crypto.randomBytes(4).toString('hex')}`, issueSlug: null },
			{ artistSlug: noVenmo.slug, issueSlug: null },
			{ artistSlug: artist.slug, issueSlug: artist.draftSlug },
			{ artistSlug: artist.slug, issueSlug: other.issueSlug }
		];
		for (const c of cases) {
			const res = await postTap({ ...c, amountCents: 500 });
			expect(res).toEqual({ status: 404, json: { recorded: false, reason: 'not_found' } });
		}
		expect(await tapsFor(artist.artistId)).toHaveLength(0);
		expect(await tapsFor(noVenmo.artistId)).toHaveLength(0);
	});

	it('counts a double tap once', async () => {
		const artist = await createArtist();
		const cookies = cookieJar();
		const getClientAddress = uniqueClientAddress();
		const body = { artistSlug: artist.slug, issueSlug: artist.issueSlug, amountCents: 500 };

		expect((await postTap(body, { cookies, getClientAddress })).status).toBe(201);
		const second = await postTap(body, { cookies, getClientAddress });
		expect(second.json).toEqual({ recorded: false, reason: 'duplicate' });
		expect(await tapsFor(artist.artistId)).toHaveLength(1);

		// A different amount is a different tap.
		expect((await postTap({ ...body, amountCents: 1000 }, { cookies, getClientAddress })).status).toBe(201);
	});

	it('applies the Phase 2 tip limits: 10 per hour per device, then 429 and nothing recorded', async () => {
		const artist = await createArtist();
		const cookies = cookieJar();
		const getClientAddress = uniqueClientAddress();

		for (let i = 0; i < RATE_LIMITS.tipDevice.max; i++) {
			// Different amounts so the double-tap check does not merge them.
			const res = await postTap(
				{ artistSlug: artist.slug, issueSlug: artist.issueSlug, amountCents: 200 + i * 100 },
				{ cookies, getClientAddress }
			);
			expect(res.status).toBe(201);
		}
		const over = await postTap(
			{ artistSlug: artist.slug, issueSlug: artist.issueSlug, amountCents: 5000 },
			{ cookies, getClientAddress }
		);
		expect(over).toEqual({ status: 429, json: { recorded: false, reason: 'rate_limited' } });
		expect(await tapsFor(artist.artistId)).toHaveLength(RATE_LIMITS.tipDevice.max);

		// The device limit is per device: a new device on the same network still counts.
		const fresh = await postTap(
			{ artistSlug: artist.slug, issueSlug: artist.issueSlug, amountCents: 5000 },
			{ getClientAddress }
		);
		expect(fresh.status).toBe(201);
	});

	it('applies the per-IP limit across devices', async () => {
		const artist = await createArtist();
		const ip = `203.0.113.${crypto.randomInt(1, 254)}-${crypto.randomUUID()}`;
		const now = new Date(Date.UTC(2031, 0, 1));
		for (let i = 0; i < RATE_LIMITS.tipIp.max; i++) {
			const r = await recordTipTap(
				{ artistSlug: artist.slug, issueSlug: null, amountCents: 500 },
				{ deviceId: `device-${i}-${crypto.randomUUID()}`, clientAddress: ip, now }
			);
			expect(r.recorded).toBe(true);
		}
		const over = await recordTipTap(
			{ artistSlug: artist.slug, issueSlug: null, amountCents: 500 },
			{ deviceId: `device-x-${crypto.randomUUID()}`, clientAddress: ip, now }
		);
		expect(over).toEqual({ recorded: false, reason: 'rate_limited' });
	});

	it('a database failure is not thrown: the endpoint answers quickly and records nothing', async () => {
		const artist = await createArtist();
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		vi.spyOn(db, 'insert').mockImplementation(() => {
			throw new Error('database is down');
		});
		const res = await postTap({ artistSlug: artist.slug, issueSlug: null, amountCents: 500 });
		expect(res).toEqual({ status: 503, json: { recorded: false, reason: 'error' } });
	});
});

describe('VenmoTipPanel', () => {
	const props = {
		artistSlug: 'tap-band',
		artistName: 'Tap Band',
		venmoUsername: 'tap-band-venmo',
		issueSlug: 'tap-band-austin-2031-03-14',
		presets: [3, 5, 10]
	};

	it('in production renders real venmo.com links with the amount and the generic note only', () => {
		const { body } = render(VenmoTipPanel, { props: { ...props, opensVenmo: true } });
		const hrefs = [...body.matchAll(/<a[^>]*class="venmo-tip-preset"[^>]*href="([^"]+)"/g)].map((m) =>
			m[1].replace(/&amp;/g, '&')
		);
		expect(hrefs).toHaveLength(3);
		for (const href of hrefs) {
			const url = new URL(href);
			expect(url.origin).toBe('https://venmo.com');
			expect(url.pathname).toBe('/tap-band-venmo');
			expect(url.searchParams.get('txn')).toBe('pay');
			expect(url.searchParams.get('note')).toBe('Tip for Tap Band via Quire');
			// Venmo notes can be public: never where or when the Fan was.
			expect(href).not.toMatch(/austin|mohawk|2031/i);
		}
		expect(hrefs.map((h) => new URL(h).searchParams.get('amount'))).toEqual(['3.00', '5.00', '10.00']);
	});

	it('in the Demo, development and tests renders buttons that never navigate, exposing the would-be URL', () => {
		const { body } = render(VenmoTipPanel, { props: { ...props, opensVenmo: false } });
		expect(body).not.toMatch(/href="https:\/\/venmo\.com/);
		expect(body).not.toMatch(/<a[^>]*venmo-tip-preset/);
		const buttons = [...body.matchAll(/<button[^>]*class="venmo-tip-preset"[^>]*data-venmo-url="([^"]+)"/g)];
		expect(buttons).toHaveLength(3);
		expect(buttons[1][1].replace(/&amp;/g, '&')).toContain('https://venmo.com/tap-band-venmo?txn=pay&amount=5.00');
	});

	it('the Demo message names the amount and username', () => {
		expect(demoVenmoMessage(500, 'tap-band-venmo')).toBe(
			'In the Demo, this would open Venmo to pay $5 to @tap-band-venmo.'
		);
		expect(demoVenmoMessage(1250, 'tap-band-venmo')).toBe(
			'In the Demo, this would open Venmo to pay $12.50 to @tap-band-venmo.'
		);
	});

	it('drops presets outside $2-$500', () => {
		const { body } = render(VenmoTipPanel, { props: { ...props, presets: [1, 5, 600], opensVenmo: true } });
		expect([...body.matchAll(/class="venmo-tip-preset"/g)]).toHaveLength(1);
	});

	it('renders nothing for an invalid username', () => {
		const { body } = render(VenmoTipPanel, { props: { ...props, venmoUsername: 'x', opensVenmo: true } });
		expect(body).not.toContain('venmo-tip-panel');
	});

	it('copy never claims a payment happened', () => {
		const { body } = render(VenmoTipPanel, { props: { ...props, opensVenmo: true } });
		expect(body).not.toMatch(/nothing was charged|thank you for your payment|tip confirmed|sent to/i);
	});

	it('taps are labelled as taps', () => {
		expect(formatTipTaps(1)).toBe('1 tip tap');
		expect(formatTipTaps(14)).toBe('14 tip taps');
	});
});

describe('tip buttons on the Back Page', () => {
	function backPageData(venmoUsername: string | null, features = ALL_FEATURES_ON) {
		return {
			features,
			artist: {
				id: 'a1',
				slug: 'tap-band',
				displayName: 'Tap Band',
				bio: '',
				coverArtUrl: null,
				accentColor: '#05D9E8',
				verified: false,
				venmoUsername,
				accountStatus: 'active'
			},
			isArtistClosed: false,
			groupedIssues: [],
			generalNotes: [],
			tipPresets: [3, 5, 10],
			links: [],
			session: null
		};
	}

	it('are hidden when the Artist has no Venmo username', () => {
		const { body } = render(BackPage, { props: { data: backPageData(null) as never, form: null } });
		expect(body).not.toContain('venmo-tip-panel');
		expect(body).not.toContain('Tip Tap Band with Venmo');
	});

	it('show when the Artist has one, as links only in production', () => {
		const test = render(BackPage, { props: { data: backPageData('tap-band-venmo') as never, form: null } }).body;
		expect(test).toContain('venmo-tip-panel');
		expect(test).not.toMatch(/href="https:\/\/venmo\.com/);

		const production = render(BackPage, {
			props: {
				data: backPageData('tap-band-venmo', featuresWith({ mode: 'production', tipsOpenVenmo: true })) as never,
				form: null
			}
		}).body;
		expect(production).toMatch(/href="https:\/\/venmo\.com\/tap-band-venmo\?txn=pay/);
	});
});
