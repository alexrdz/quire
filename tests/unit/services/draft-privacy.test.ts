import crypto from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeSignature } from 'better-auth/crypto';
import { db, schema } from '$lib/server/db';
import { authSecret } from '$lib/server/auth';
import { seedDatabase } from '$lib/server/seed';
import { isPubliclyReadable } from '$domain/issue';
import { claimStampForFan, saveIssueForFan, signScanToken } from '$lib/server/services/stamping';
import { withSessionModule } from '../helpers/session-event';
import * as readerRoute from '../../../src/routes/(zine)/i/[slug]/+page.server';
import * as stubsRoute from '../../../src/routes/(site)/me/stubs/+page.server';

/**
 * B1-T34: a draft Issue is the Artist's alone. Nothing public reads it, saves it, stamps it
 * or lists it; published, cancelled and archived Issues stay readable.
 */

const { load: readerLoad } = withSessionModule(readerRoute);
const { load: stubsLoad } = withSessionModule(stubsRoute);

type Status = 'draft' | 'published' | 'cancelled' | 'archived';
const users: string[] = [];
const artists: string[] = [];

async function user(kind: 'artist' | 'fan') {
	const id = crypto.randomUUID();
	const token = `test_draft_${crypto.randomUUID()}`;
	const now = new Date();
	await db.insert(schema.users).values({ id, name: kind, email: `${kind}-${id.slice(0, 8)}@example.com`, emailVerified: true, accountType: kind, createdAt: now, updatedAt: now });
	await db.insert(schema.sessions).values({ id: crypto.randomUUID(), userId: id, token, expiresAt: new Date(now.getTime() + 86_400_000), createdAt: now, updatedAt: now });
	users.push(id);
	return { id, cookie: `better-auth.session_token=${token}.${await makeSignature(token, authSecret)}` };
}

async function issues() {
	const owner = await user('artist');
	const artistId = crypto.randomUUID();
	const now = new Date();
	await db.insert(schema.artists).values({ id: artistId, userId: owner.id, slug: `draft-band-${artistId.slice(0, 6)}`, displayName: 'Draft Band', createdAt: now, updatedAt: now });
	artists.push(artistId);
	const made = {} as Record<Status, { id: string; slug: string }>;
	for (const status of ['draft', 'published', 'cancelled', 'archived'] as Status[]) {
		const id = crypto.randomUUID();
		const slug = `draft-privacy-${status}-${id.slice(0, 8)}`;
		await db.insert(schema.issues).values({
			id,
			artistId,
			slug,
			city: `City ${status}`,
			venue: 'Venue',
			date: '2026-11-25',
			timezone: 'America/New_York',
			coverNote: '',
			secretKey: 'draftkey',
			status,
			publishedAt: status === 'draft' ? null : now,
			...(status === 'archived' ? { archivedAt: now, previousStatus: 'published' as const } : {}),
			createdAt: now,
			updatedAt: now
		});
		made[status] = { id, slug };
	}
	return made;
}

async function readerStatus(slug: string) {
	const url = new URL(`http://localhost:4173/i/${slug}`);
	try {
		await (readerLoad as any)({ params: { slug }, url, request: new Request(url), cookies: { get: () => undefined } });
		return 200;
	} catch (e) {
		return (e as { status?: number }).status ?? 500;
	}
}

beforeAll(async () => {
	await seedDatabase();
});

afterEach(async () => {
	for (const artistId of artists.splice(0)) {
		const rows = await db.query.issues.findMany({ where: eq(schema.issues.artistId, artistId) });
		for (const row of rows) await db.delete(schema.collections).where(eq(schema.collections.issueId, row.id));
		await db.delete(schema.issues).where(eq(schema.issues.artistId, artistId));
		await db.delete(schema.artists).where(eq(schema.artists.id, artistId));
	}
	for (const id of users.splice(0)) {
		await db.delete(schema.collections).where(eq(schema.collections.fanUserId, id));
		await db.delete(schema.sessions).where(eq(schema.sessions.userId, id));
		await db.delete(schema.users).where(eq(schema.users.id, id));
	}
});

describe('isPubliclyReadable', () => {
	it('is every status but a draft', () => {
		expect(isPubliclyReadable({ status: 'draft' })).toBe(false);
		for (const status of ['published', 'cancelled', 'archived']) expect(isPubliclyReadable({ status }), status).toBe(true);
	});
});

describe('a draft is not public', () => {
	it('the reader: 404 for a draft and an unknown slug; published, cancelled and archived still load', async () => {
		const made = await issues();
		expect(await readerStatus(made.draft.slug)).toBe(404);
		expect(await readerStatus('no-such-issue')).toBe(404);
		for (const status of ['published', 'cancelled', 'archived'] as Status[]) {
			expect(await readerStatus(made[status].slug), status).toBe(200);
		}
	});

	it('Save: refused for a draft and an unknown id, allowed for a readable Issue', async () => {
		const made = await issues();
		const fan = await user('fan');
		const draft = await saveIssueForFan(fan.id, made.draft.id);
		expect(!draft.ok && draft.error.code).toBe('ISSUE_NOT_FOUND');
		const unknown = await saveIssueForFan(fan.id, crypto.randomUUID());
		expect(!unknown.ok && unknown.error.code).toBe('ISSUE_NOT_FOUND');
		for (const status of ['published', 'cancelled', 'archived'] as Status[]) {
			expect((await saveIssueForFan(fan.id, made[status].id)).ok, status).toBe(true);
		}
		const rows = await db.query.collections.findMany({ where: eq(schema.collections.fanUserId, fan.id) });
		expect(rows.map((r) => r.issueId)).not.toContain(made.draft.id);
	});

	it('Stamp: refused for a draft, even with a scan token for its slug', async () => {
		const made = await issues();
		const fan = await user('fan');
		const draft = await claimStampForFan(fan.id, made.draft.id, signScanToken(made.draft.slug));
		expect(!draft.ok && draft.error.code).toBe('ISSUE_NOT_FOUND');
		expect((await claimStampForFan(fan.id, made.published.id, signScanToken(made.published.slug))).ok).toBe(true);
	});

	it('My Stubs never lists a draft, even one saved before this fix', async () => {
		const made = await issues();
		const fan = await user('fan');
		// What the old Save allowed: a collection row for a draft.
		await db.insert(schema.collections).values({ id: crypto.randomUUID(), fanUserId: fan.id, issueId: made.draft.id, kind: 'saved', createdAt: new Date() });
		await saveIssueForFan(fan.id, made.published.id);
		const url = new URL('http://localhost:4173/me/stubs');
		const data = (await (stubsLoad as any)({ url, request: new Request(url, { headers: { cookie: fan.cookie } }) })) as {
			saved: Array<{ issueId: string }>;
			stamped: Array<{ issueId: string }>;
		};
		const listed = [...data.saved, ...data.stamped].map((entry) => entry.issueId);
		expect(listed).toContain(made.published.id);
		expect(listed).not.toContain(made.draft.id);
	});
});
