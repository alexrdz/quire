import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inArray } from 'drizzle-orm';
import { makeSignature } from 'better-auth/crypto';
import { authSecret } from '$lib/server/auth';
import { db, schema } from '$lib/server/db';
import { seedDatabase } from '$lib/server/seed';
import { ArtistAccountStatus } from '$domain/account';
import { withSession } from '../helpers/session-event';

/**
 * PRODUCTION_PLAN 4.3: every Artist action and dashboard load is guarded, and
 * every Fan action needs a signed-in user.
 *
 * The route files are found on disk and every exported action must be listed
 * below. A new action, or a new route file, fails this test until it is
 * classified, and a classified action is then called signed out and as the
 * wrong kind of account to prove its guard runs first.
 */

const ROUTES = path.resolve(__dirname, '../../../src/routes');
const GUARDED_DIRS = ['(site)/dashboard', '(zine)/i/[slug]', '(site)/a/[slug]'];

/** Fan actions: any signed-in account. */
const FAN_ACTIONS: Record<string, string[]> = {
	'(zine)/i/[slug]': ['submitNote', 'flagNote', 'claimStamp', 'saveIssue'],
	'(site)/a/[slug]': ['submitNote', 'flagNote']
};
/** Public actions: they start sign-in, so they cannot require it. */
const PUBLIC_ACTIONS: Record<string, string[]> = {
	'(zine)/i/[slug]': ['googleAuth'],
	'(site)/a/[slug]': ['googleAuth']
};
/** Every other action in GUARDED_DIRS is an Artist action. */
const ARTIST_ROUTE_PREFIX = '(site)/dashboard';

/** Artist actions that redirect to sign-in instead of failing (a link the Artist opened). */
const REDIRECTING_ACTIONS = new Set(['(site)/dashboard/settings/confirm-venmo#default']);

function serverFiles(dir: string, name: string): string[] {
	const root = path.join(ROUTES, dir);
	return (fs.readdirSync(root, { recursive: true }) as string[])
		.map(String)
		.filter((f) => path.basename(f) === name)
		.map((f) => path.join(root, f));
}

function routeId(file: string): string {
	return path.relative(ROUTES, path.dirname(file)).split(path.sep).join('/');
}

interface RouteModule {
	id: string;
	actions: Record<string, (event: never) => Promise<unknown>>;
	load?: (event: never) => Promise<unknown>;
}

async function loadModules(name: string): Promise<RouteModule[]> {
	const files = GUARDED_DIRS.flatMap((dir) => serverFiles(dir, name));
	return Promise.all(
		files.map(async (file) => {
			const mod = await import(/* @vite-ignore */ file);
			return { id: routeId(file), actions: mod.actions ?? {}, load: mod.load };
		})
	);
}

let pageModules: RouteModule[] = [];
let layoutModules: RouteModule[] = [];
const createdUserIds: string[] = [];

async function createUser(kind: 'fan' | 'artist' | 'closed-artist') {
	const userId = crypto.randomUUID();
	const token = `test_guard_${crypto.randomUUID()}`;
	const now = new Date();
	createdUserIds.push(userId);
	await db.insert(schema.users).values({
		id: userId,
		name: `Guard ${kind}`,
		email: `guard-${crypto.randomBytes(4).toString('hex')}@example.com`,
		emailVerified: true,
		accountType: kind === 'fan' ? 'fan' : 'artist',
		createdAt: now,
		updatedAt: now
	});
	if (kind !== 'fan') {
		await db.insert(schema.artists).values({
			id: crypto.randomUUID(),
			userId,
			slug: `guard-${crypto.randomBytes(4).toString('hex')}`,
			displayName: 'Guard Band',
			accountStatus: kind === 'closed-artist' ? ArtistAccountStatus.Closed : ArtistAccountStatus.Active,
			createdAt: now,
			updatedAt: now
		});
	}
	await db.insert(schema.sessions).values({
		id: crypto.randomUUID(),
		userId,
		token,
		expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
		createdAt: now,
		updatedAt: now
	});
	return `better-auth.session_token=${token}.${await makeSignature(token, authSecret)}`;
}

let fanCookie = '';
let closedArtistCookie = '';

beforeAll(async () => {
	await seedDatabase();
	pageModules = await loadModules('+page.server.ts');
	layoutModules = await loadModules('+layout.server.ts');
	fanCookie = await createUser('fan');
	closedArtistCookie = await createUser('closed-artist');
});

afterAll(async () => {
	if (createdUserIds.length === 0) return;
	await db.delete(schema.artists).where(inArray(schema.artists.userId, createdUserIds));
	await db.delete(schema.sessions).where(inArray(schema.sessions.userId, createdUserIds));
	await db.delete(schema.users).where(inArray(schema.users.id, createdUserIds));
});

const PARAMS = { id: crypto.randomUUID(), slug: 'neon-velvet-philly-2026-10-15' };

function pathFor(id: string): string {
	return (
		'/' +
		id
			.replace(/^\([^)]+\)\//, '')
			.replace('[slug]', PARAMS.slug)
			.replace('[id]', PARAMS.id)
	);
}

function cookieJar() {
	return { get: () => undefined, getAll: () => [], set: () => {}, delete: () => {}, serialize: () => '' };
}

async function event(id: string, cookie: string | null, method: 'GET' | 'POST', action?: string) {
	const url = `http://localhost:5173${pathFor(id)}${action ? `?/${action}` : ''}`;
	const headers: Record<string, string> = cookie ? { cookie } : {};
	return withSession({
		request: new Request(url, method === 'POST' ? { method, headers, body: new FormData() } : { headers }),
		params: PARAMS,
		cookies: cookieJar(),
		getClientAddress: () => `198.51.100.${Math.floor(Math.random() * 250)}`
	});
}

/** Runs a handler and returns what it returned or threw: an ActionFailure, a Redirect, an HttpError. */
async function outcome(handler: (event: never) => Promise<unknown>, ev: unknown) {
	try {
		return (await handler(ev as never)) as { status?: number; location?: string; data?: unknown };
	} catch (thrown) {
		return thrown as { status?: number; location?: string };
	}
}

function kindOf(id: string, name: string): 'artist' | 'fan' | 'public' | 'unclassified' {
	if (FAN_ACTIONS[id]?.includes(name)) return 'fan';
	if (PUBLIC_ACTIONS[id]?.includes(name)) return 'public';
	if (id.startsWith(ARTIST_ROUTE_PREFIX)) return 'artist';
	return 'unclassified';
}

function allActions() {
	return pageModules.flatMap((m) => Object.keys(m.actions).map((name) => ({ mod: m, name, kind: kindOf(m.id, name) })));
}

describe('4.3 every action is guarded', () => {
	it('finds the route files and their actions', () => {
		const ids = pageModules.map((m) => m.id);
		for (const id of [
			'(site)/dashboard',
			'(site)/dashboard/settings',
			'(site)/dashboard/settings/confirm-venmo',
			'(site)/dashboard/template',
			'(site)/dashboard/bookbinder/[id]',
			'(site)/dashboard/issues/quick',
			'(zine)/i/[slug]',
			'(site)/a/[slug]'
		]) {
			expect(ids, id).toContain(id);
		}
		expect(allActions().length).toBeGreaterThan(25);
	});

	it('classifies every exported action (a new one fails here until it is listed)', () => {
		const unclassified = allActions()
			.filter((a) => a.kind === 'unclassified')
			.map((a) => `${a.mod.id}#${a.name}`);
		expect(unclassified).toEqual([]);
		// Every listed Fan and public action still exists, so the lists cannot go stale.
		for (const [id, names] of [...Object.entries(FAN_ACTIONS), ...Object.entries(PUBLIC_ACTIONS)]) {
			const mod = pageModules.find((m) => m.id === id);
			for (const name of names) expect(mod?.actions[name], `${id}#${name}`).toBeTypeOf('function');
		}
	});

	it('rejects every Artist and Fan action when signed out', async () => {
		const leaks: string[] = [];
		for (const { mod, name, kind } of allActions()) {
			if (kind === 'public') continue;
			const key = `${mod.id}#${name}`;
			const result = await outcome(mod.actions[name]!, await event(mod.id, null, 'POST', name));
			const rejected = REDIRECTING_ACTIONS.has(key)
				? result.status === 303 && result.location?.startsWith('/login?redirect=')
				: result.status === 401;
			if (!rejected) leaks.push(`${key} -> ${result.status} ${result.location ?? ''}`);
		}
		expect(leaks).toEqual([]);
	});

	it('rejects every Artist action for a Fan session and a closed Artist', async () => {
		const leaks: string[] = [];
		for (const { mod, name, kind } of allActions()) {
			if (kind !== 'artist') continue;
			const key = `${mod.id}#${name}`;
			for (const [who, cookie] of [
				['fan', fanCookie],
				['closed artist', closedArtistCookie]
			] as const) {
				const result = await outcome(mod.actions[name]!, await event(mod.id, cookie, 'POST', name));
				const rejected = REDIRECTING_ACTIONS.has(key)
					? result.status === 303 && result.location?.startsWith('/login')
					: result.status === 403;
				if (!rejected) leaks.push(`${key} as ${who} -> ${result.status} ${result.location ?? ''}`);
			}
		}
		expect(leaks).toEqual([]);
	});

	it('lets a signed-in Fan past the guard of every Fan action', async () => {
		for (const { mod, name, kind } of allActions()) {
			if (kind !== 'fan') continue;
			const result = await outcome(mod.actions[name]!, await event(mod.id, fanCookie, 'POST', name));
			// Past the guard the empty form fails validation or lookup, never sign-in.
			expect(result.status, `${mod.id}#${name}`).not.toBe(401);
		}
	});
});

describe('4.3 every dashboard load is guarded', () => {
	const dashboardLoads = () => [...pageModules, ...layoutModules].filter((m) => m.id.startsWith(ARTIST_ROUTE_PREFIX) && m.load);

	it('redirects signed-out visitors to /login with this page as a safe redirect', async () => {
		expect(dashboardLoads().length).toBeGreaterThanOrEqual(7);
		for (const mod of dashboardLoads()) {
			const result = await outcome(mod.load!, await event(mod.id, null, 'GET'));
			expect(result.status, mod.id).toBe(303);
			expect(result.location, mod.id).toBe(`/login?redirect=${pathFor(mod.id)}`);
		}
	});

	it('sends a Fan to /login and a closed Artist to /login?closed=1', async () => {
		for (const mod of dashboardLoads()) {
			expect((await outcome(mod.load!, await event(mod.id, fanCookie, 'GET'))).location, mod.id).toBe('/login');
			expect((await outcome(mod.load!, await event(mod.id, closedArtistCookie, 'GET'))).location, mod.id).toBe(
				'/login?closed=1'
			);
		}
	});

	it('keeps the query string, encoded, and never redirects off-site', async () => {
		const confirm = pageModules.find((m) => m.id === '(site)/dashboard/settings/confirm-venmo')!;
		const withToken = await withSession({
			request: new Request('http://localhost:5173/dashboard/settings/confirm-venmo?token=abc&x=1')
		});
		expect((await outcome(confirm.load!, withToken)).location).toBe(
			'/login?redirect=/dashboard/settings/confirm-venmo%3Ftoken%3Dabc%26x%3D1'
		);

		const dashboard = pageModules.find((m) => m.id === '(site)/dashboard')!;
		const offSite = await withSession({ request: new Request('http://localhost:5173//evil.example/dashboard') });
		expect((await outcome(dashboard.load!, offSite)).location).toBe('/login?redirect=/dashboard');
	});
});
