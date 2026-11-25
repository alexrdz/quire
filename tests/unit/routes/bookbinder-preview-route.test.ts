import crypto from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeSignature } from 'better-auth/crypto';
import { db, schema } from '$lib/server/db';
import { authSecret } from '$lib/server/auth';
import { seedDatabase } from '$lib/server/seed';
import { withSessionModule } from '../helpers/session-event';
import * as previewRoute from '../../../src/routes/(site)/dashboard/bookbinder/[id]/preview/+page.server';
import * as readerRoute from '../../../src/routes/(zine)/i/[slug]/+page.server';

/**
 * B1-T33: the Artist's own preview (/dashboard/bookbinder/[id]/preview) shows drafts and
 * published Issues alike, only to the Artist who owns them; anyone else gets 404. It is
 * never cached or indexed, and refuses every write. The public reader no longer shows drafts.
 */

const { load: previewLoad, actions: previewActions } = withSessionModule(previewRoute);
const { load: readerLoad } = withSessionModule(readerRoute);

interface Fixture {
	userId: string;
	artistId: string;
	cookie: string;
}
const created: Fixture[] = [];

async function artist(label: string): Promise<Fixture> {
	const userId = crypto.randomUUID();
	const artistId = crypto.randomUUID();
	const suffix = crypto.randomUUID().slice(0, 6);
	const token = `test_preview_${crypto.randomUUID()}`;
	const now = new Date();
	await db.insert(schema.users).values({ id: userId, name: label, email: `${label}-${suffix}@example.com`, emailVerified: true, accountType: 'artist', createdAt: now, updatedAt: now });
	await db.insert(schema.sessions).values({ id: crypto.randomUUID(), userId, token, expiresAt: new Date(now.getTime() + 86_400_000), createdAt: now, updatedAt: now });
	await db.insert(schema.artists).values({ id: artistId, userId, slug: `${label}-${suffix}`, displayName: label, createdAt: now, updatedAt: now });
	const fixture = { userId, artistId, cookie: `better-auth.session_token=${token}.${await makeSignature(token, authSecret)}` };
	created.push(fixture);
	return fixture;
}

async function issueFor(owner: Fixture, status: 'draft' | 'published') {
	const id = crypto.randomUUID();
	const slug = `preview-${status}-${id.slice(0, 8)}`;
	const now = new Date();
	await db.insert(schema.issues).values({
		id,
		artistId: owner.artistId,
		slug,
		city: `Preview ${status}`,
		venue: 'The Back Room',
		date: '2026-11-25',
		timezone: 'America/New_York',
		coverNote: '',
		secretKey: 'previewkey',
		status,
		publishedAt: status === 'published' ? now : null,
		createdAt: now,
		updatedAt: now
	});
	await db.insert(schema.issuePages).values({
		id: `${id}-p0`,
		issueId: id,
		position: 0,
		kind: 'text',
		contentJson: JSON.stringify({ title: 'Draft words' }),
		createdAt: now
	});
	return { id, slug };
}

/** Calls the preview load as `who` (null: signed out); returns its data or the error status, and the headers it set. */
async function preview(issueId: string, who: Fixture | null) {
	const headers: Record<string, string> = {};
	const url = new URL(`http://localhost:4173/dashboard/bookbinder/${issueId}/preview`);
	try {
		const data = await (previewLoad as any)({
			params: { id: issueId },
			url,
			request: new Request(url, { headers: who ? { cookie: who.cookie } : {} }),
			cookies: { get: () => undefined },
			setHeaders: (h: Record<string, string>) => Object.assign(headers, h)
		});
		return { data, status: 200, headers };
	} catch (e) {
		return { data: null, status: (e as { status?: number }).status ?? 500, headers };
	}
}

async function publicRead(slug: string) {
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
	while (created.length) {
		const f = created.pop()!;
		const issues = await db.query.issues.findMany({ where: eq(schema.issues.artistId, f.artistId) });
		for (const issue of issues) await db.delete(schema.issuePages).where(eq(schema.issuePages.issueId, issue.id));
		await db.delete(schema.issues).where(eq(schema.issues.artistId, f.artistId));
		await db.delete(schema.artists).where(eq(schema.artists.id, f.artistId));
		await db.delete(schema.sessions).where(eq(schema.sessions.userId, f.userId));
		await db.delete(schema.users).where(eq(schema.users.id, f.userId));
	}
});

describe('the owner preview route', () => {
	it('shows the owner a draft and a published Issue, with the same reader data, uncached and unindexed', async () => {
		const owner = await artist('owner');
		for (const status of ['draft', 'published'] as const) {
			const issue = await issueFor(owner, status);
			const result = await preview(issue.id, owner);
			expect(result.status, status).toBe(200);
			expect(result.data.issue.id).toBe(issue.id);
			expect(result.data.issue.status).toBe(status);
			expect(result.data.issuePages.map((p: { id: string }) => p.id)).toEqual([`${issue.id}-p0`]);
			expect(result.data.preview).toBe(true);
			// The Artist's view, never a Fan's: no Stamp or Save state, no scan.
			expect(result.data.collectionStatus).toBe('none');
			expect(result.data.isScanVerified).toBe(false);
			expect(result.headers).toMatchObject({ 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex, nofollow' });
		}
	});

	it('is 404, not 403, for another Artist, for a signed-out visitor, and for an unknown id', async () => {
		const owner = await artist('owner');
		const other = await artist('other');
		const draft = await issueFor(owner, 'draft');
		expect((await preview(draft.id, other)).status).toBe(404);
		expect((await preview(draft.id, null)).status).toBe(404);
		expect((await preview('no-such-issue', owner)).status).toBe(404);
		// Still never cached, even when refused.
		expect((await preview(draft.id, null)).headers['cache-control']).toBe('private, no-store');
	});

	it('refuses every write the reader can post: the Wall, flagging, Stamp, Save and Fan sign-in', async () => {
		const owner = await artist('owner');
		const issue = await issueFor(owner, 'published');
		for (const name of ['submitNote', 'flagNote', 'claimStamp', 'saveIssue', 'googleAuth']) {
			const action = (previewActions as Record<string, (e: unknown) => Promise<unknown>>)[name]!;
			const url = new URL(`http://localhost:4173/dashboard/bookbinder/${issue.id}/preview?/${name}`);
			const form = new FormData();
			form.set('body', 'From the preview');
			form.set('issueId', issue.id);
			const result = (await action({
				params: { id: issue.id },
				url,
				request: new Request(url, { method: 'POST', headers: { cookie: owner.cookie }, body: form }),
				cookies: { get: () => undefined }
			})) as { status: number; data: { error: string } };
			expect(result.status, name).toBe(403);
			expect(result.data.error, name).toMatch(/preview/);
		}
		const notes = await db.query.notes.findMany({ where: eq(schema.notes.issueId, issue.id) });
		expect(notes).toEqual([]);
	});
});

describe('the public reader', () => {
	it('no longer shows a draft to anyone, but still shows a published Issue', async () => {
		const owner = await artist('owner');
		expect(await publicRead((await issueFor(owner, 'draft')).slug)).toBe(404);
		expect(await publicRead((await issueFor(owner, 'published')).slug)).toBe(200);
		expect(await publicRead('no-such-slug')).toBe(404);
	});
});
