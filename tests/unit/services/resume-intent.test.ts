import crypto from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { makeSignature } from 'better-auth/crypto';
import { authSecret } from '$lib/server/auth';
import { db, schema } from '$lib/server/db';
import { seedDatabase } from '$lib/server/seed';
import { calculateStampWindow } from '$domain/stamping';
import { resetRateLimitsForTests } from '$lib/server/services/rate-limit';
import { signScanToken } from '$lib/server/services/stamping';
import {
	consumeResumeIntent,
	readResumeIntent,
	resumeCookieName,
	RESUME_TTL_SECONDS,
	setResumeIntent,
	signResumeToken,
	verifyResumeToken
} from '$lib/server/services/resume-intent';
import { withSessionModule } from '../helpers/session-event';
import { uniqueClientAddress } from '../helpers/client';
import * as readerRoute from '../../../src/routes/(zine)/i/[slug]/+page.server';

/**
 * B1-T37 (SPEC.md §5.5): after Google sign-in the reader finishes the note or Stamp
 * the Fan started, exactly once. The resume token is signed, bound to one Issue and
 * one action, short-lived, and single-use; the actions spend it before anything else
 * and keep every usual rule.
 */

const { actions, load } = withSessionModule(readerRoute);

/** A cookie jar shaped like SvelteKit's `Cookies`, recording the options it was given. */
function jar(initial: Record<string, string> = {}) {
	const values = new Map(Object.entries(initial));
	const options = new Map<string, Record<string, unknown>>();
	return {
		values,
		options,
		get: (name: string) => values.get(name),
		getAll: () => [...values].map(([name, value]) => ({ name, value })),
		set: (name: string, value: string, opts: Record<string, unknown>) => {
			values.set(name, value);
			options.set(name, opts);
		},
		delete: (name: string, opts: Record<string, unknown>) => {
			values.delete(name);
			options.set(name, { ...opts, deleted: true });
		},
		serialize: () => ''
	};
}

const users: string[] = [];
const artists: string[] = [];

beforeAll(async () => {
	await seedDatabase();
});

beforeEach(async () => {
	await resetRateLimitsForTests();
});

afterAll(async () => {
	if (artists.length) await db.delete(schema.artists).where(inArray(schema.artists.id, artists));
	if (users.length) {
		await db.delete(schema.collections).where(inArray(schema.collections.fanUserId, users));
		await db.delete(schema.notes).where(inArray(schema.notes.fanUserId, users));
		await db.delete(schema.sessions).where(inArray(schema.sessions.userId, users));
		await db.delete(schema.users).where(inArray(schema.users.id, users));
	}
});

async function fan() {
	const id = crypto.randomUUID();
	const token = `test_resume_${crypto.randomUUID()}`;
	const now = new Date();
	await db.insert(schema.users).values({ id, name: 'Resume Fan', email: `resume-${id.slice(0, 8)}@example.com`, emailVerified: true, accountType: 'fan', createdAt: now, updatedAt: now });
	await db.insert(schema.sessions).values({ id: crypto.randomUUID(), userId: id, token, expiresAt: new Date(now.getTime() + 3_600_000), createdAt: now, updatedAt: now });
	users.push(id);
	return { id, cookie: `better-auth.session_token=${token}.${await makeSignature(token, authSecret)}` };
}

/** A published Issue whose Stamp Window is open now (or closed, a year back). */
async function issue(windowOpen = true) {
	const owner = await fan();
	const artistId = crypto.randomUUID();
	const now = new Date();
	await db.insert(schema.artists).values({ id: artistId, userId: owner.id, slug: `resume-band-${artistId.slice(0, 6)}`, displayName: 'Resume Band', createdAt: now, updatedAt: now });
	artists.push(artistId);
	const date = new Date(now.getTime() - (windowOpen ? 0 : 365 * 86_400_000)).toISOString().slice(0, 10);
	const window = calculateStampWindow(date, 'UTC');
	const id = crypto.randomUUID();
	const slug = `resume-issue-${id.slice(0, 8)}`;
	await db.insert(schema.issues).values({
		id,
		artistId,
		slug,
		city: 'Resumeville',
		venue: 'The Return',
		date,
		timezone: 'UTC',
		coverNote: '',
		secretKey: 'resumekey',
		status: 'published',
		publishedAt: now,
		stampWindowStart: window.ok ? window.value.start : now,
		stampWindowEnd: window.ok ? window.value.end : now,
		createdAt: now,
		updatedAt: now
	});
	return { id, slug };
}

type Result = { status?: number; data?: Record<string, unknown>; success?: boolean; stamped?: boolean };

function act(name: 'submitNote' | 'claimStamp', slug: string, cookie: string, cookies: ReturnType<typeof jar>, fields: Record<string, string>) {
	const form = new FormData();
	for (const [key, value] of Object.entries(fields)) form.set(key, value);
	const action = (actions as Record<string, (event: never) => Promise<Result>>)[name]!;
	return action({
		params: { slug },
		request: new Request(`http://localhost:4173/i/${slug}?/${name}`, { method: 'POST', headers: { cookie }, body: form }),
		cookies,
		getClientAddress: uniqueClientAddress()
	} as never);
}

const notesBy = (fanUserId: string, issueId: string) =>
	db.query.notes.findMany({ where: and(eq(schema.notes.fanUserId, fanUserId), eq(schema.notes.issueId, issueId)) });

describe('the resume token', () => {
	it('verifies only for its own Issue, unexpired and untampered', () => {
		const now = new Date('2026-11-26T12:00:00Z');
		const token = signResumeToken('note', 'brooklyn', now);
		expect(verifyResumeToken(token, 'brooklyn', now)?.action).toBe('note');
		expect(verifyResumeToken(token, 'philly', now)).toBeNull();
		expect(verifyResumeToken(token, 'brooklyn', new Date(now.getTime() + RESUME_TTL_SECONDS * 1000))).toBeNull();
		// Changing the payload breaks the signature.
		const [body, signature] = token.split('.');
		const forged = Buffer.from(Buffer.from(body!, 'base64url').toString().replace('"note"', '"stamp"')).toString('base64url');
		expect(verifyResumeToken(`${forged}.${signature}`, 'brooklyn', now)).toBeNull();
		expect(verifyResumeToken(`${body}.${signature}x`, 'brooklyn', now)).toBeNull();
		expect(verifyResumeToken('nonsense', 'brooklyn', now)).toBeNull();
		expect(verifyResumeToken(undefined, 'brooklyn', now)).toBeNull();
	});

	it('is an httpOnly, lax, short-lived cookie scoped to the Issue', () => {
		const cookies = jar();
		setResumeIntent(cookies as never, 'brooklyn', 'stamp');
		expect(cookies.options.get(resumeCookieName('brooklyn'))).toMatchObject({
			path: '/i/brooklyn',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: RESUME_TTL_SECONDS
		});
		expect(readResumeIntent(cookies as never, 'brooklyn')).toBe('stamp');
		expect(readResumeIntent(cookies as never, 'philly')).toBeNull();
	});

	it('is spent once: the cookie is deleted, and a replay of the same token is refused', async () => {
		const token = signResumeToken('note', 'brooklyn');
		const first = jar({ [resumeCookieName('brooklyn')]: token });
		expect(await consumeResumeIntent(first as never, 'brooklyn', 'note')).toBe(true);
		expect(first.values.has(resumeCookieName('brooklyn'))).toBe(false);
		// The same cookie sent again (another tab, a replayed request).
		const replay = jar({ [resumeCookieName('brooklyn')]: token });
		expect(await consumeResumeIntent(replay as never, 'brooklyn', 'note')).toBe(false);
	});

	it('is not spent by the other action', async () => {
		const cookies = jar({ [resumeCookieName('brooklyn')]: signResumeToken('stamp', 'brooklyn') });
		expect(await consumeResumeIntent(cookies as never, 'brooklyn', 'note')).toBe(false);
	});
});

describe('googleAuth records what to finish', () => {
	it('sets the token for a note or a Stamp, and clears it for a plain sign-in', async () => {
		const target = await issue();
		const signIn = async (cookies: ReturnType<typeof jar>, intent: string) => {
			const form = new FormData();
			form.set('intent', intent);
			form.set('targetHash', '#page-wall');
			try {
				await (actions as Record<string, (e: never) => Promise<unknown>>).googleAuth!({
					params: { slug: target.slug },
					request: new Request(`http://localhost:4173/i/${target.slug}?/googleAuth`, { method: 'POST', body: form }),
					cookies,
					getClientAddress: uniqueClientAddress()
				} as never);
			} catch {
				// The stand-in sign-in redirects back to the Issue.
			}
		};
		const cookies = jar();
		await signIn(cookies, 'note');
		expect(verifyResumeToken(cookies.get(resumeCookieName(target.slug)), target.slug)?.action).toBe('note');
		await signIn(cookies, '');
		expect(cookies.values.has(resumeCookieName(target.slug))).toBe(false);
		await signIn(cookies, 'publish-everything');
		expect(cookies.values.has(resumeCookieName(target.slug))).toBe(false);
	});
});

describe('the reader sees the intent only for a signed-in Fan', () => {
	it('loads resumeIntent for the Fan, and null when signed out', async () => {
		const target = await issue();
		const reader = await fan();
		const cookies = jar({ [resumeCookieName(target.slug)]: signResumeToken('note', target.slug) });
		const run = (cookie?: string) =>
			(load as unknown as (e: never) => Promise<{ resumeIntent: string | null }>)({
				params: { slug: target.slug },
				url: new URL(`http://localhost:4173/i/${target.slug}`),
				request: new Request(`http://localhost:4173/i/${target.slug}`, { headers: cookie ? { cookie } : {} }),
				cookies
			} as never);
		expect((await run(reader.cookie)).resumeIntent).toBe('note');
		expect((await run()).resumeIntent).toBeNull();
	});
});

describe('submitNote on return from sign-in', () => {
	it('posts once; the same submit again (refresh, Back, replay) posts nothing', async () => {
		const target = await issue();
		const writer = await fan();
		const token = signResumeToken('note', target.slug);
		const body = `Back from sign-in ${crypto.randomUUID().slice(0, 8)}`;

		const first = await act('submitNote', target.slug, writer.cookie, jar({ [resumeCookieName(target.slug)]: token }), { body, resume: '1' });
		expect(first.success).toBe(true);
		const replay = await act('submitNote', target.slug, writer.cookie, jar({ [resumeCookieName(target.slug)]: token }), { body, resume: '1' });
		expect(replay.status).toBe(409);
		expect(replay.data).toEqual({ resumeSpent: true });
		const noCookie = await act('submitNote', target.slug, writer.cookie, jar(), { body, resume: '1' });
		expect(noCookie.status).toBe(409);

		expect(await notesBy(writer.id, target.id)).toHaveLength(1);
	});

	it('keeps every rule: a note with a link is refused, and the token is still spent', async () => {
		const target = await issue();
		const writer = await fan();
		const cookies = jar({ [resumeCookieName(target.slug)]: signResumeToken('note', target.slug) });
		const refused = await act('submitNote', target.slug, writer.cookie, cookies, { body: 'see quire.example.com/me', resume: '1' });
		expect(refused.status).toBe(400);
		expect(String(refused.data?.error)).toMatch(/link|URL|web address/i);
		expect(cookies.values.has(resumeCookieName(target.slug))).toBe(false);
		expect(await notesBy(writer.id, target.id)).toHaveLength(0);
	});

	it('a signed-out request with a token posts nothing and leaves the token', async () => {
		const target = await issue();
		const cookies = jar({ [resumeCookieName(target.slug)]: signResumeToken('note', target.slug) });
		const result = await act('submitNote', target.slug, '', cookies, { body: 'No session', resume: '1' });
		expect(result.status).toBe(401);
		expect(cookies.values.has(resumeCookieName(target.slug))).toBe(true);
	});
});

describe('claimStamp on return from sign-in', () => {
	it('claims once with a scan inside the Window; a replay is refused', async () => {
		const target = await issue(true);
		const stamper = await fan();
		const token = signResumeToken('stamp', target.slug);
		const scan = { [`quire_scan_${target.slug}`]: signScanToken(target.slug) };

		const first = await act('claimStamp', target.slug, stamper.cookie, jar({ ...scan, [resumeCookieName(target.slug)]: token }), { issueId: target.id, resume: '1' });
		expect(first.stamped).toBe(true);
		const replay = await act('claimStamp', target.slug, stamper.cookie, jar({ ...scan, [resumeCookieName(target.slug)]: token }), { issueId: target.id, resume: '1' });
		expect(replay.status).toBe(409);

		const rows = await db.query.collections.findMany({ where: and(eq(schema.collections.fanUserId, stamper.id), eq(schema.collections.issueId, target.id)) });
		expect(rows.map((r) => r.kind)).toEqual(['stamped']);
	});

	it('without a Scan Token (the scan was refused outside the Window) nothing is claimed', async () => {
		const target = await issue(false);
		const stamper = await fan();
		const cookies = jar({ [resumeCookieName(target.slug)]: signResumeToken('stamp', target.slug) });
		const refused = await act('claimStamp', target.slug, stamper.cookie, cookies, { issueId: target.id, resume: '1' });
		expect(refused.status).toBe(403);
		expect(String(refused.data?.error)).toMatch(/scan/i);
		const rows = await db.query.collections.findMany({ where: eq(schema.collections.fanUserId, stamper.id) });
		expect(rows).toHaveLength(0);
	});
});
