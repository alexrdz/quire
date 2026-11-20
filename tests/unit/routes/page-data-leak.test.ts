import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { makeSignature } from 'better-auth/crypto';
import { authSecret } from '$lib/server/auth';
import { db, schema } from '$lib/server/db';
import { seedDatabase } from '$lib/server/seed';
import { withSession } from '../helpers/session-event';

/**
 * P4L-T05: page data is serialized into the HTML and `__data.json`, so no load
 * may return the Better Auth session record, its token, or the full user row.
 *
 * Every +page.server.ts and +layout.server.ts with a `load` is found on disk
 * and run as a signed-in Fan and a signed-in Artist (the seeded ones, so the
 * loads return real data). The serialized result must not contain the
 * session's token or id, and no object in it may carry a session-row field.
 */

const ROUTES = path.resolve(__dirname, '../../../src/routes');

/** Fields only a session row has; none may appear anywhere in page data. */
const SESSION_FIELDS = ['token', 'ipAddress', 'userAgent', 'expiresAt', 'impersonatedBy'];

/**
 * `token` keys that are not the session: the one-time token the visitor brought
 * in the URL of these pages, echoed back into the form. A load without it in
 * the URL returns '' or null.
 */
const URL_TOKEN_ROUTES = new Set(['(site)/login/reset', '(site)/dashboard/settings/confirm-venmo']);

/** Pages that show the signed-in user's own email address. */
const EMAIL_ALLOWED = new Set(['(site)/dashboard/settings', '(site)/dashboard']);

const PARAMS: Record<string, string> = {};

function loadFiles(): string[] {
	return (fs.readdirSync(ROUTES, { recursive: true }) as string[])
		.map(String)
		.filter((f) => ['+page.server.ts', '+layout.server.ts'].includes(path.basename(f)))
		.map((f) => path.join(ROUTES, f));
}

function routeId(file: string): string {
	const dir = path.relative(ROUTES, path.dirname(file)).split(path.sep).join('/');
	return dir === '' ? '/' : dir;
}

function pathFor(id: string): string {
	if (id === '/') return '/';
	const url = id
		.split('/')
		.filter((seg) => !/^\(.+\)$/.test(seg))
		.map((seg) => seg.replace(/^\[(\w+)\]$/, (_, name: string) => PARAMS[name] ?? 'x'))
		.join('/');
	return `/${url}`;
}

interface Viewer {
	label: string;
	userId: string;
	cookie: string;
	token: string;
	sessionId: string;
	email: string;
}

const createdSessionIds: string[] = [];

async function signIn(label: string, email: string): Promise<Viewer> {
	const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
	if (!user) throw new Error(`seed user ${email} missing`);
	const token = `test_leak_${crypto.randomUUID()}`;
	const sessionId = crypto.randomUUID();
	const now = new Date();
	createdSessionIds.push(sessionId);
	await db.insert(schema.sessions).values({
		id: sessionId,
		userId: user.id,
		token,
		ipAddress: '203.0.113.7',
		userAgent: 'LeakTestAgent/1.0',
		expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
		createdAt: now,
		updatedAt: now
	});
	const cookie = `better-auth.session_token=${token}.${await makeSignature(token, authSecret)}`;
	return { label, userId: user.id, cookie, token, sessionId, email };
}

let fan: Viewer;
let artist: Viewer;
let loads: Array<{ id: string; load: (event: never) => Promise<unknown> }> = [];

beforeAll(async () => {
	await seedDatabase();
	fan = await signIn('Fan', 'maya@example.com');
	artist = await signIn('Artist', 'demo@neonvelvet.band');

	const band = await db.query.artists.findFirst({ where: eq(schema.artists.userId, artist.userId) });
	const issue = await db.query.issues.findFirst({ where: eq(schema.issues.slug, 'neon-velvet-philly-2026-10-15') });
	PARAMS.slug = 'neon-velvet-philly-2026-10-15';
	PARAMS.id = issue!.id;
	expect(issue!.artistId).toBe(band!.id);

	loads = (
		await Promise.all(
			loadFiles().map(async (file) => {
				const mod = await import(/* @vite-ignore */ file);
				return { id: routeId(file), load: mod.load };
			})
		)
	).filter((m) => typeof m.load === 'function');
});

afterAll(async () => {
	if (createdSessionIds.length > 0) {
		await db.delete(schema.sessions).where(inArray(schema.sessions.id, createdSessionIds));
	}
});

/** The `/a/[slug]` route takes an Artist slug, every other `[slug]` an Issue slug. */
function paramsFor(id: string): Record<string, string> {
	return id.startsWith('(site)/a/') ? { ...PARAMS, slug: 'the-neon-velvet' } : PARAMS;
}

async function runLoad(id: string, load: (event: never) => Promise<unknown>, viewer: Viewer) {
	const params = paramsFor(id);
	const urlPath = id.startsWith('(site)/a/') ? '/a/the-neon-velvet' : pathFor(id);
	const event = await withSession({
		request: new Request(`http://localhost:5173${urlPath}`, { headers: { cookie: viewer.cookie } }),
		params,
		route: { id: `/${id}` },
		cookies: { get: () => undefined, getAll: () => [], set: () => {}, delete: () => {}, serialize: () => '' },
		getClientAddress: () => '198.51.100.1',
		setHeaders: () => {},
		depends: () => {},
		untrack: <T>(fn: () => T) => fn(),
		parent: async () => ({})
	});
	try {
		return { data: await load(event as never) };
	} catch (thrown) {
		// A redirect or HTTP error carries no page data; record it so the test can see what ran.
		const t = thrown as { status?: number; location?: string };
		return { thrown: `${t.status ?? 'error'} ${t.location ?? ''}`.trim() };
	}
}

/** Paths to every key in `data` whose name is in `names`. */
function findKeys(value: unknown, names: string[], at = '$', out: string[] = [], seen = new Set<object>()): string[] {
	if (!value || typeof value !== 'object' || value instanceof Date) return out;
	if (seen.has(value)) return out;
	seen.add(value);
	for (const [key, child] of Object.entries(value)) {
		const here = Array.isArray(value) ? `${at}[${key}]` : `${at}.${key}`;
		if (names.includes(key)) out.push(here);
		findKeys(child, names, here, out, seen);
	}
	return out;
}

function leaksIn(id: string, data: unknown, viewer: Viewer): string[] {
	const leaks: string[] = [];
	const serialized = JSON.stringify(data) ?? '';
	if (serialized.includes(viewer.token)) leaks.push(`${id}: session token value`);
	if (serialized.includes(viewer.sessionId)) leaks.push(`${id}: session id`);
	if (serialized.includes('LeakTestAgent') || serialized.includes('203.0.113.7')) {
		leaks.push(`${id}: session userAgent/ipAddress value`);
	}
	for (const key of findKeys(data, SESSION_FIELDS)) {
		if (URL_TOKEN_ROUTES.has(id) && key === '$.token') continue;
		leaks.push(`${id}: ${key}`);
	}
	if (!EMAIL_ALLOWED.has(id) && serialized.includes(viewer.email)) leaks.push(`${id}: the viewer's email`);
	return leaks;
}

describe('P4L-T05 no load serializes the session', () => {
	it('finds every load, public and dashboard', () => {
		const ids = loads.map((l) => l.id);
		for (const id of [
			'/',
			'(site)/a/[slug]',
			'(zine)/i/[slug]',
			'(site)/me/stubs',
			'(site)/login',
			'(site)/dashboard',
			'(site)/dashboard/settings',
			'(site)/dashboard/bookbinder/[id]'
		]) {
			expect(ids, id).toContain(id);
		}
	});

	for (const who of ['Fan', 'Artist'] as const) {
		it(`returns no session token, session field or email for a signed-in ${who}`, async () => {
			const viewer = who === 'Fan' ? fan : artist;
			const leaks: string[] = [];
			const ran: string[] = [];
			for (const { id, load } of loads) {
				const result = await runLoad(id, load, viewer);
				if ('thrown' in result) continue;
				ran.push(id);
				leaks.push(...leaksIn(id, result.data, viewer));
			}
			expect(leaks).toEqual([]);
			// The pages that know who is signed in really ran with data, so the check above means something.
			expect(ran).toEqual(expect.arrayContaining(['/', '(site)/a/[slug]', '(zine)/i/[slug]']));
			if (who === 'Fan') expect(ran).toContain('(site)/me/stubs');
			else expect(ran).toEqual(expect.arrayContaining(['(site)/dashboard', '(site)/dashboard/settings']));
		});
	}

	it('gives public pages only the viewer fields they use', async () => {
		for (const id of ['(site)/a/[slug]', '(zine)/i/[slug]']) {
			const load = loads.find((l) => l.id === id)!.load;
			const signedIn = (await runLoad(id, load, fan)) as { data: Record<string, unknown> };
			expect(signedIn.data.viewer, id).toEqual({
				id: fan.userId,
				name: expect.any(String),
				image: null,
				accountType: 'fan'
			});
			expect(signedIn.data, id).not.toHaveProperty('session');
		}
		const stubs = loads.find((l) => l.id === '(site)/me/stubs')!.load;
		const result = (await runLoad('(site)/me/stubs', stubs, fan)) as { data: Record<string, unknown> };
		expect(Object.keys(result.data.viewer as object).sort()).toEqual(['accountType', 'id', 'image', 'name']);
		expect(result.data).not.toHaveProperty('user');
	});
});
