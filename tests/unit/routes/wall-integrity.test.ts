import crypto from 'node:crypto';
import { withSessionModule } from '../helpers/session-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { makeSignature } from 'better-auth/crypto';
import { authSecret } from '$lib/server/auth';
import { db, schema } from '$lib/server/db';
import { seedDatabase } from '$lib/server/seed';
import { FLAG_AUTO_HIDE_THRESHOLD, NoteStatus, flagNote } from '$domain/wall';
import { createArtistId, createFanUserId, createNoteId } from '$domain/types';
import { flagWallNote } from '$lib/server/services/moderation';
import { createArtistForNewUser } from '$lib/server/services/account';
import { uniqueClientAddress } from '../helpers/client';
import * as __route1 from '../../../src/routes/(zine)/i/[slug]/+page.server';
const { actions: issueActions } = withSessionModule(__route1);
import * as __route2 from '../../../src/routes/(site)/a/[slug]/+page.server';
const { actions: artistActions } = withSessionModule(__route2);
import * as __route3 from '../../../src/routes/(site)/login/+page.server';
const { actions: loginActions } = withSessionModule(__route3);

/**
 * PRODUCTION_PLAN 3.2 (Wall notes and flags follow the URL, not the form) and
 * 3.7 (atomic flag counting, all-or-nothing artist signup).
 */

const createdUserIds: string[] = [];
const hex = () => crypto.randomBytes(4).toString('hex');

beforeAll(async () => {
	await seedDatabase();
});

afterAll(async () => {
	if (createdUserIds.length === 0) return;
	// Artists, issues, notes and flags cascade from their users.
	await db.delete(schema.artists).where(inArray(schema.artists.userId, createdUserIds));
	await db.delete(schema.sessions).where(inArray(schema.sessions.userId, createdUserIds));
	await db.delete(schema.users).where(inArray(schema.users.id, createdUserIds));
});

async function createUser(accountType: 'fan' | 'artist' = 'fan') {
	const userId = crypto.randomUUID();
	const token = `test_wall_${crypto.randomUUID()}`;
	const now = new Date();
	createdUserIds.push(userId);
	await db.insert(schema.users).values({
		id: userId,
		name: 'Wall Test User',
		email: `wall-${hex()}@example.com`,
		emailVerified: true,
		accountType,
		createdAt: now,
		updatedAt: now
	});
	await db.insert(schema.sessions).values({
		id: crypto.randomUUID(),
		userId,
		token,
		expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
		createdAt: now,
		updatedAt: now
	});
	return {
		userId,
		cookie: `better-auth.session_token=${token}.${await makeSignature(token, authSecret)}`
	};
}

async function createArtist() {
	const owner = await createUser('artist');
	const artistId = crypto.randomUUID();
	const now = new Date();
	await db.insert(schema.artists).values({
		id: artistId,
		userId: owner.userId,
		slug: `wall-artist-${hex()}`,
		displayName: 'Wall Test Band',
		createdAt: now,
		updatedAt: now
	});
	const artist = await db.query.artists.findFirst({ where: eq(schema.artists.id, artistId) });
	return artist!;
}

async function createIssue(artistId: string, status: 'published' | 'archived' | 'draft' = 'published') {
	const issueId = crypto.randomUUID();
	const now = new Date();
	const slug = `wall-issue-${hex()}`;
	await db.insert(schema.issues).values({
		id: issueId,
		artistId,
		slug,
		city: 'Austin',
		venue: 'The Mohawk',
		date: '2031-03-14',
		secretKey: crypto.randomBytes(16).toString('hex'),
		status,
		createdAt: now,
		updatedAt: now
	});
	return { id: issueId, slug, artistId };
}

async function createNote(input: { artistId: string; issueId: string | null; fanUserId: string }) {
	const id = crypto.randomUUID();
	await db.insert(schema.notes).values({
		id,
		artistId: input.artistId,
		issueId: input.issueId,
		fanUserId: input.fanUserId,
		body: 'Loud and lovely',
		status: NoteStatus.Live,
		flagCount: 0,
		flagImmune: false,
		createdAt: new Date()
	});
	return id;
}

/** The General Wall scope for an Artist. */
const general = (artistId: string) => ({ artistId, issueId: null });

type ActionResult = { status?: number; data?: { error?: string }; success?: boolean; noteId?: string };

function callAction(
	actions: typeof issueActions | typeof artistActions,
	name: 'submitNote' | 'flagNote',
	slug: string,
	cookie: string,
	fields: Record<string, string>
): Promise<ActionResult> {
	const form = new FormData();
	for (const [key, value] of Object.entries(fields)) form.set(key, value);
	const action = actions[name] as (event: never) => Promise<ActionResult>;
	return action({
		params: { slug },
		request: new Request(`http://localhost:5173/x?/${name}`, {
			method: 'POST',
			headers: { cookie },
			body: form
		}),
		getClientAddress: uniqueClientAddress()
	} as never);
}

describe('3.2 Wall notes take their Artist and Issue from the URL', () => {
	it('an Issue note with a forged artistId and issueId lands on the Issue named by the slug', async () => {
		const target = await createArtist();
		const targetIssue = await createIssue(target.id);
		const victim = await createArtist();
		const victimIssue = await createIssue(victim.id);
		const fan = await createUser();

		const result = await callAction(issueActions, 'submitNote', targetIssue.slug, fan.cookie, {
			artistId: victim.id,
			issueId: victimIssue.id,
			body: 'Forged ids should not matter'
		});
		expect(result.success).toBe(true);

		const note = await db.query.notes.findFirst({ where: eq(schema.notes.id, result.noteId!) });
		expect(note?.artistId).toBe(target.id);
		expect(note?.issueId).toBe(targetIssue.id);
		const onVictim = await db.query.notes.findMany({ where: eq(schema.notes.artistId, victim.id) });
		expect(onVictim).toHaveLength(0);
	});

	it('a General Wall note with a forged artistId lands on the Artist named by the slug, with no Issue', async () => {
		const target = await createArtist();
		const victim = await createArtist();
		const fan = await createUser();

		const result = await callAction(artistActions, 'submitNote', target.slug, fan.cookie, {
			artistId: victim.id,
			issueId: crypto.randomUUID(),
			body: 'General Wall hello'
		});
		expect(result.success).toBe(true);

		const note = await db.query.notes.findFirst({ where: eq(schema.notes.id, result.noteId!) });
		expect(note?.artistId).toBe(target.id);
		expect(note?.issueId).toBeNull();
	});

	it('unknown, draft and archived slugs write no note', async () => {
		const artist = await createArtist();
		const draft = await createIssue(artist.id, 'draft');
		const archived = await createIssue(artist.id, 'archived');
		const fan = await createUser();
		const fields = { artistId: artist.id, body: 'Should not be written' };

		const unknownIssue = await callAction(issueActions, 'submitNote', `no-such-${hex()}`, fan.cookie, fields);
		expect(unknownIssue.status).toBe(404);
		expect((await callAction(issueActions, 'submitNote', draft.slug, fan.cookie, fields)).status).toBe(404);
		expect((await callAction(issueActions, 'submitNote', archived.slug, fan.cookie, fields)).status).toBe(403);
		const unknownArtist = await callAction(artistActions, 'submitNote', `no-such-${hex()}`, fan.cookie, fields);
		expect(unknownArtist.status).toBe(404);

		const written = await db.query.notes.findMany({ where: eq(schema.notes.fanUserId, fan.userId) });
		expect(written).toHaveLength(0);
	});

	it('the Issue flag action rejects a note from another Issue or from a General Wall', async () => {
		const artist = await createArtist();
		const issue = await createIssue(artist.id);
		const otherIssue = await createIssue(artist.id);
		const author = await createUser();
		const flagger = await createUser();
		const elsewhere = await createNote({ artistId: artist.id, issueId: otherIssue.id, fanUserId: author.userId });
		const general = await createNote({ artistId: artist.id, issueId: null, fanUserId: author.userId });
		const own = await createNote({ artistId: artist.id, issueId: issue.id, fanUserId: author.userId });

		for (const noteId of [elsewhere, general]) {
			const result = await callAction(issueActions, 'flagNote', issue.slug, flagger.cookie, { noteId });
			expect(result.status).toBe(404);
		}
		const flags = await db.query.noteFlags.findMany({ where: inArray(schema.noteFlags.noteId, [elsewhere, general]) });
		expect(flags).toHaveLength(0);

		const okResult = await callAction(issueActions, 'flagNote', issue.slug, flagger.cookie, { noteId: own });
		expect(okResult.success).toBe(true);
	});

	it("the General Wall flag action rejects an Issue note and another Artist's note", async () => {
		const artist = await createArtist();
		const issue = await createIssue(artist.id);
		const other = await createArtist();
		const author = await createUser();
		const flagger = await createUser();
		const issueNote = await createNote({ artistId: artist.id, issueId: issue.id, fanUserId: author.userId });
		const otherArtistNote = await createNote({ artistId: other.id, issueId: null, fanUserId: author.userId });
		const own = await createNote({ artistId: artist.id, issueId: null, fanUserId: author.userId });

		for (const noteId of [issueNote, otherArtistNote]) {
			const result = await callAction(artistActions, 'flagNote', artist.slug, flagger.cookie, { noteId });
			expect(result.status).toBe(404);
		}
		const okResult = await callAction(artistActions, 'flagNote', artist.slug, flagger.cookie, { noteId: own });
		expect(okResult.success).toBe(true);
	});
});

describe('3.7 Flags are counted atomically', () => {
	it('flagWallNote rejects a note outside the given Wall scope', async () => {
		const artist = await createArtist();
		const issue = await createIssue(artist.id);
		const author = await createUser();
		const fan = await createUser();
		const noteId = await createNote({ artistId: artist.id, issueId: issue.id, fanUserId: author.userId });

		const wrongWall = await flagWallNote(noteId, fan.userId, general(artist.id));
		expect(!wrongWall.ok && wrongWall.error.code).toBe('NOTE_NOT_FOUND');
		const right = await flagWallNote(noteId, fan.userId, { artistId: artist.id, issueId: issue.id });
		expect(right.ok).toBe(true);
	});

	it('two concurrent flags by the same Fan count once', async () => {
		const artist = await createArtist();
		const author = await createUser();
		const fan = await createUser();
		const noteId = await createNote({ artistId: artist.id, issueId: null, fanUserId: author.userId });

		const results = await Promise.all([
			flagWallNote(noteId, fan.userId, general(artist.id)),
			flagWallNote(noteId, fan.userId, general(artist.id))
		]);
		expect(results.filter((r) => r.ok)).toHaveLength(1);
		const rejected = results.find((r) => !r.ok);
		expect(rejected && !rejected.ok && rejected.error.code).toBe('ALREADY_FLAGGED');

		const note = await db.query.notes.findFirst({ where: eq(schema.notes.id, noteId) });
		expect(note?.flagCount).toBe(1);
		const flags = await db.query.noteFlags.findMany({ where: eq(schema.noteFlags.noteId, noteId) });
		expect(flags).toHaveLength(1);
	});

	it('two concurrent flags by different Fans count twice', async () => {
		const artist = await createArtist();
		const author = await createUser();
		const [a, b] = await Promise.all([createUser(), createUser()]);
		const noteId = await createNote({ artistId: artist.id, issueId: null, fanUserId: author.userId });

		const results = await Promise.all([
			flagWallNote(noteId, a.userId, general(artist.id)),
			flagWallNote(noteId, b.userId, general(artist.id))
		]);
		expect(results.every((r) => r.ok)).toBe(true);
		const note = await db.query.notes.findFirst({ where: eq(schema.notes.id, noteId) });
		expect(note?.flagCount).toBe(2);
	});

	it('concurrent flags reaching the threshold auto-hide the note, as the domain rule says', async () => {
		const artist = await createArtist();
		const author = await createUser();
		const fans = await Promise.all(Array.from({ length: FLAG_AUTO_HIDE_THRESHOLD }, () => createUser()));
		const noteId = await createNote({ artistId: artist.id, issueId: null, fanUserId: author.userId });

		await Promise.all(fans.map((f) => flagWallNote(noteId, f.userId, general(artist.id))));
		const note = await db.query.notes.findFirst({ where: eq(schema.notes.id, noteId) });
		expect(note?.flagCount).toBe(FLAG_AUTO_HIDE_THRESHOLD);

		const domain = flagNote({
			id: createNoteId(noteId),
			artistId: createArtistId(artist.id),
			issueId: null,
			fanUserId: createFanUserId(author.userId),
			body: 'x',
			status: NoteStatus.Live,
			flagCount: FLAG_AUTO_HIDE_THRESHOLD - 1,
			flagImmune: false,
			createdAt: new Date()
		});
		expect(domain.ok && domain.value.note.status).toBe(NoteStatus.Hidden);
		expect(note?.status).toBe(NoteStatus.Hidden);
	});

	it('a flag-immune note is counted but never auto-hidden', async () => {
		const artist = await createArtist();
		const author = await createUser();
		const fans = await Promise.all(Array.from({ length: FLAG_AUTO_HIDE_THRESHOLD }, () => createUser()));
		const noteId = await createNote({ artistId: artist.id, issueId: null, fanUserId: author.userId });
		await db.update(schema.notes).set({ flagImmune: true }).where(eq(schema.notes.id, noteId));

		for (const f of fans) await flagWallNote(noteId, f.userId, general(artist.id));
		const note = await db.query.notes.findFirst({ where: eq(schema.notes.id, noteId) });
		expect(note?.flagCount).toBe(FLAG_AUTO_HIDE_THRESHOLD);
		expect(note?.status).toBe(NoteStatus.Live);
	});

	it('the flag insert and the counter update are one atomic batch with a single increment UPDATE', async () => {
		const artist = await createArtist();
		const author = await createUser();
		const fan = await createUser();
		const noteId = await createNote({ artistId: artist.id, issueId: null, fanUserId: author.userId });

		const batchSpy = vi.spyOn(db, 'batch');
		try {
			const result = await flagWallNote(noteId, fan.userId, general(artist.id));
			expect(result.ok).toBe(true);
			expect(batchSpy).toHaveBeenCalledTimes(1);
			const statements = batchSpy.mock.calls[0]![0] as unknown as Array<{ toSQL(): { sql: string } }>;
			expect(statements).toHaveLength(2);
			expect(statements[0]!.toSQL().sql).toMatch(/^insert into "note_flags"/);
			const update = statements[1]!.toSQL().sql;
			// One UPDATE that increments in SQL, never a value computed in JavaScript.
			expect(update).toMatch(/^update "notes" set /);
			expect(update).toContain('"flag_count" = "notes"."flag_count" + 1');
			expect(update).toMatch(/where "notes"\."id" = \?/);
		} finally {
			batchSpy.mockRestore();
		}
	});
});

describe('3.7 Artist signup is all or nothing', () => {
	function signupRequest(fields: Record<string, string>) {
		const form = new FormData();
		for (const [key, value] of Object.entries(fields)) form.set(key, value);
		return new Request('http://localhost:5173/login?/signup', { method: 'POST', body: form });
	}

	it('a failed artist insert during signup leaves no user and no artist row', async () => {
		const email = `signup-fail-${hex()}@example.com`;
		const slug = `signup-fail-${hex()}`;
		const realBatch = db.batch.bind(db);
		const batchSpy = vi
			.spyOn(db, 'batch')
			.mockImplementationOnce(() => Promise.reject(new Error('simulated artist insert failure')))
			.mockImplementation(realBatch as never);

		let result: { status?: number } | undefined;
		try {
			result = (await loginActions.signup({
				request: signupRequest({ name: 'Rollback Band', slug, email, password: 'correct-horse-battery' }),
				url: new URL('http://localhost:5173/login?/signup'),
				cookies: { get: () => undefined, getAll: () => [], set: () => {}, delete: () => {}, serialize: () => '' },
				getClientAddress: uniqueClientAddress()
			} as never)) as { status?: number };
		} finally {
			batchSpy.mockRestore();
		}

		expect(result?.status).toBe(409);
		expect(await db.query.users.findFirst({ where: eq(schema.users.email, email) })).toBeUndefined();
		expect(await db.query.artists.findFirst({ where: eq(schema.artists.slug, slug) })).toBeUndefined();
	});

	it('a real slug collision at insert time deletes the new user, its account and its sessions', async () => {
		const user = await createUser('artist');
		await db.insert(schema.accounts).values({
			id: crypto.randomUUID(),
			userId: user.userId,
			accountId: user.userId,
			providerId: 'credential',
			createdAt: new Date(),
			updatedAt: new Date()
		});
		const taken = await createArtist();

		const result = await createArtistForNewUser({ userId: user.userId, slug: taken.slug, displayName: 'Late Band' });
		expect(result.ok).toBe(false);

		expect(await db.query.users.findFirst({ where: eq(schema.users.id, user.userId) })).toBeUndefined();
		expect(await db.query.accounts.findFirst({ where: eq(schema.accounts.userId, user.userId) })).toBeUndefined();
		expect(await db.query.sessions.findFirst({ where: eq(schema.sessions.userId, user.userId) })).toBeUndefined();
		const artists = await db.query.artists.findMany({
			where: and(eq(schema.artists.userId, user.userId))
		});
		expect(artists).toHaveLength(0);
		// The Artist that already held the slug is untouched.
		expect(await db.query.artists.findFirst({ where: eq(schema.artists.id, taken.id) })).toBeDefined();
	});

	it('a successful signup creates both the user and the artist', async () => {
		const email = `signup-ok-${hex()}@example.com`;
		const slug = `signup-ok-${hex()}`;
		let thrown: unknown;
		try {
			await loginActions.signup({
				request: signupRequest({ name: 'Whole Band', slug, email, password: 'correct-horse-battery' }),
				url: new URL('http://localhost:5173/login?/signup'),
				cookies: { get: () => undefined, getAll: () => [], set: () => {}, delete: () => {}, serialize: () => '' },
				getClientAddress: uniqueClientAddress()
			} as never);
		} catch (error) {
			thrown = error;
		}
		expect((thrown as { status?: number })?.status).toBe(303);

		const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
		expect(user).toBeDefined();
		createdUserIds.push(user!.id);
		const artist = await db.query.artists.findFirst({ where: eq(schema.artists.slug, slug) });
		expect(artist?.userId).toBe(user!.id);
	});
});
