import { afterEach, describe, it, expect } from 'vitest';
import { actions, load } from '../../../src/routes/(site)/dashboard/+page.server';
import { db, schema } from '$lib/server/db';
import { authSecret } from '$lib/server/auth';
import { render } from 'svelte/server';
import { ALL_FEATURES_ON } from '../helpers/features';
import DashboardPage from '../../../src/routes/(site)/dashboard/+page.svelte';
import { NoteStatus } from '$domain/wall';
import { eq } from 'drizzle-orm';
import { seedDatabase } from '$lib/server/seed';
import { getConfig } from '$lib/server/config';
import crypto from 'node:crypto';
import { makeSignature } from 'better-auth/crypto';

const createdUserIds: string[] = [];
const createdSessionTokens: string[] = [];

afterEach(async () => {
	while (createdSessionTokens.length > 0) {
		const token = createdSessionTokens.pop()!;
		await db.delete(schema.sessions).where(eq(schema.sessions.token, token));
	}
	while (createdUserIds.length > 0) {
		const userId = createdUserIds.pop()!;
		await db.delete(schema.users).where(eq(schema.users.id, userId));
	}
});

async function createFreshArtistSession(slugSuffix: string) {
	const userId = crypto.randomUUID();
	const artistId = crypto.randomUUID();
	const sessionToken = `test_dash_fresh_${crypto.randomUUID()}`;
	const now = new Date();
	const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24);
	const slug = `static-bloom-${slugSuffix}`;

	createdUserIds.push(userId);
	createdSessionTokens.push(sessionToken);

	await db.insert(schema.users).values({
		id: userId,
		name: 'Static Bloom',
		email: `static-${slugSuffix}@example.com`,
		emailVerified: true,
		accountType: 'artist',
		createdAt: now,
		updatedAt: now
	});

	await db.insert(schema.artists).values({
		id: artistId,
		userId,
		slug,
		displayName: 'Static Bloom',
		bio: 'Live digital zines and tour archive on Quire.',
		accentColor: '#05D9E8',
		typePairing: 'sans-serif',
		tipPresetsJson: '[3, 5, 10]',
		linksJson: '[]',
		payoutsEnabled: false,
		verified: false,
		generalWallApproveFirst: false,
		createdAt: now,
		updatedAt: now
	});

	await db.insert(schema.templatePages).values({
		id: crypto.randomUUID(),
		artistId,
		position: 1,
		kind: 'text',
		contentJson: JSON.stringify({ title: 'About Static Bloom', body: 'Starter page' }),
		createdAt: now
	});

	await db.insert(schema.sessions).values({
		id: crypto.randomUUID(),
		userId,
		token: sessionToken,
		expiresAt,
		createdAt: now,
		updatedAt: now
	});

	const signature = await makeSignature(sessionToken, authSecret);
	return {
		userId,
		artistId,
		slug,
		cookie: `better-auth.session_token=${sessionToken}.${signature}`
	};
}

describe('Dashboard +page.server', () => {
	it('executes load function successfully for demo artist', async () => {
		await seedDatabase();

		const demoArtist = await db.query.artists.findFirst({
			where: eq(schema.artists.slug, 'the-neon-velvet'),
			with: { user: true }
		});
		expect(demoArtist).toBeDefined();
		if (!demoArtist) return;

		const sessionToken = `test_dash_session_${crypto.randomUUID()}`;
		createdSessionTokens.push(sessionToken);
		const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

		await db.insert(schema.sessions).values({
			id: crypto.randomUUID(),
			userId: demoArtist.userId,
			token: sessionToken,
			expiresAt,
			createdAt: new Date(),
			updatedAt: new Date()
		});

		const signature = await makeSignature(sessionToken, authSecret);
		const signedCookie = `${sessionToken}.${signature}`;

		const req = new Request('http://localhost:4173/dashboard', {
			headers: {
				cookie: `better-auth.session_token=${signedCookie}`
			}
		});

		const data = (await (load as any)({ request: req, url: new URL(req.url) })) as any;
		expect(data.artist).toBeDefined();
		expect(data.artist.displayName).toBe('The Neon Velvet');
		expect(data.issues).toBeDefined();
		expect(data.issues.length).toBeGreaterThan(0);
		expect(data.pendingNotes).toBeDefined();
		expect(data.latestRecap).toBeDefined();
		expect(data.generalRow).toBeDefined();
		expect(data.artistQrSvg).toContain('<svg');
		expect(data.artistBackPageUrl).toBe(`${getConfig().core.appUrl}/a/the-neon-velvet`);
		expect(data.hasCustomizedTemplate).toBe(true);
		expect(data.onboarding).toBe(false);
	});

	it('returns onboarding launchpad metadata for a brand-new artist with zero issues', async () => {
		await seedDatabase();
		const fixture = await createFreshArtistSession(crypto.randomBytes(3).toString('hex'));

		const req = new Request('http://localhost:4173/dashboard?onboarding=1', {
			headers: { cookie: fixture.cookie }
		});

		const initial = (await (load as any)({ request: req, url: new URL(req.url) })) as any;
		expect(initial.issues).toEqual([]);
		expect(initial.onboarding).toBe(true);
		expect(initial.hasCustomizedTemplate).toBe(false);
		expect(initial.artistBackPageUrl).toBe(`${getConfig().core.appUrl}/a/${fixture.slug}`);

		// Customizing accent color flips hasCustomizedTemplate to true
		await db
			.update(schema.artists)
			.set({ accentColor: '#FF8800', updatedAt: new Date() })
			.where(eq(schema.artists.id, fixture.artistId));

		const customized = (await (load as any)({ request: req, url: new URL(req.url) })) as any;
		expect(customized.hasCustomizedTemplate).toBe(true);
	});

	it('creates a new draft issue and redirects to Bookbinder via createDraft action', async () => {
		await seedDatabase();
		const fixture = await createFreshArtistSession(crypto.randomBytes(3).toString('hex'));

		const unauthReq = new Request('http://localhost:4173/dashboard?/createDraft', {
			method: 'POST'
		});
		const unauthRes = (await actions.createDraft({ request: unauthReq } as any)) as any;
		expect(unauthRes.status).toBe(401);

		const req = new Request('http://localhost:4173/dashboard?/createDraft', {
			method: 'POST',
			headers: { cookie: fixture.cookie }
		});

		let redirectTarget = '';
		try {
			await actions.createDraft({ request: req } as any);
			expect.unreachable('Should have thrown redirect to Bookbinder');
		} catch (redirectErr: any) {
			expect(redirectErr.status).toBe(303);
			expect(redirectErr.location).toMatch(/^\/dashboard\/bookbinder\/[0-9a-f-]+$/);
			redirectTarget = redirectErr.location;
		}

		const createdIssueId = redirectTarget.replace('/dashboard/bookbinder/', '');
		const createdIssue = await db.query.issues.findFirst({
			where: eq(schema.issues.id, createdIssueId)
		});
		expect(createdIssue).toBeDefined();
		expect(createdIssue?.artistId).toBe(fixture.artistId);
		expect(createdIssue?.status).toBe('draft');
		expect(createdIssue?.city).toBe('New City');
		expect(createdIssue?.venue).toBe('Venue TBA');
		expect(createdIssue?.timezone).toBe('America/New_York');
		expect(createdIssue?.slug).toMatch(new RegExp(`^${fixture.slug}-draft-[0-9a-f]+`));
		expect(createdIssue?.secretKey).toMatch(/^[0-9a-f]{32}$/);
	});

	it('redirects unauthenticated requests to /login?redirect=/dashboard', async () => {
		const req = new Request('http://localhost:4173/dashboard', {
			headers: {}
		});

		try {
			await (load as any)({ request: req });
			expect.unreachable('Should have thrown redirect');
		} catch (redirectErr: any) {
			expect(redirectErr.status).toBe(303);
			expect(redirectErr.location).toBe('/login?redirect=/dashboard');
		}
	});

	it('builds the Artist QR and Back Page URL from the configured app URL, not the Host header', async () => {
		await seedDatabase();
		const fixture = await createFreshArtistSession(crypto.randomBytes(3).toString('hex'));
		const req = new Request('https://evil.example/dashboard', {
			headers: { cookie: fixture.cookie, host: 'evil.example' }
		});
		const data = (await (load as any)({ request: req, url: new URL(req.url) })) as any;
		expect(data.artistBackPageUrl).toBe(`${getConfig().core.appUrl}/a/${fixture.slug}`);
		expect(data.artistBackPageUrl).not.toContain('evil.example');
		expect(data.artistQrSvg).not.toContain('evil.example');
	});

	it('shows tip-tap counts, labelled as taps, with no dollar figures (ADR 0008)', async () => {
		await seedDatabase();
		const fixture = await createFreshArtistSession(crypto.randomBytes(3).toString('hex'));
		const issueId = crypto.randomUUID();
		const now = new Date();

		await db.insert(schema.issues).values({
			id: issueId,
			artistId: fixture.artistId,
			slug: `${fixture.slug}-bk-2026-11-17`,
			city: 'Brooklyn',
			venue: 'Union Pool',
			date: '2026-11-17',
			timezone: 'America/New_York',
			coverNote: 'Late set',
			secretKey: crypto.randomBytes(16).toString('hex'),
			status: 'published',
			approveFirst: false,
			createdAt: now,
			updatedAt: now
		});

		const tap = (issue: string | null, cents: number) => ({
			id: crypto.randomUUID(),
			artistId: fixture.artistId,
			issueId: issue,
			amountSelectedCents: cents,
			createdAt: now
		});
		await db
			.insert(schema.tipTaps)
			.values([tap(issueId, 500), tap(issueId, 1000), tap(issueId, 2000), tap(null, 500)]);

		const req = new Request('http://localhost:4173/dashboard', {
			headers: { cookie: fixture.cookie }
		});
		const data = (await (load as any)({ request: req, url: new URL(req.url) })) as any;

		expect(data.latestRecap.tipTaps).toBe(3);
		expect(data.issues[0].tipTaps).toBe(3);
		expect(data.generalRow.tipTaps).toBe(1);
		expect(data.totalTipTaps).toBe(4);
		// No money anywhere in the load: no gross, fees, net, payouts or a ledger.
		// Check property names only: values such as a random hex secretKey can contain "fee".
		const keys = [data.latestRecap, data.generalRow, ...data.issues].flatMap((o: object) => Object.keys(o));
		for (const key of keys) {
			expect(key).not.toMatch(/gross|fee|^net|payout|amountSelected|tipSummary/i);
		}
		expect(data.tipLedger).toBeUndefined();

		const { body } = render(DashboardPage, {
			props: { data: { ...data, features: ALL_FEATURES_ON, emailConfirmation: null } }
		});
		const text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
		expect(text).toContain('3 tip taps');
		expect(text).toContain('1 tip tap');
		expect(text).toContain('Check Venmo for what came in.');
		expect(text).not.toMatch(/Gross|Net Artist Payout|Stripe|5% platform/);
		// No dollar sign next to tip-tap data.
		expect(text).not.toMatch(/\$\s*\d[^<]{0,40}tip taps?|tip taps?[^<]{0,40}\$\s*\d/i);
	});

	it('supports hide, restore, reply, deleteReply, blockFan, and unblockFan moderation actions', async () => {
		await seedDatabase();
		const fixture = await createFreshArtistSession(crypto.randomBytes(3).toString('hex'));

		const fanUser = await db.query.users.findFirst({
			where: eq(schema.users.email, 'maya@example.com')
		});
		expect(fanUser).toBeDefined();
		if (!fanUser) return;

		const noteId = crypto.randomUUID();
		await db.insert(schema.notes).values({
			id: noteId,
			artistId: fixture.artistId,
			issueId: null,
			fanUserId: fanUser.id,
			body: 'Loved the acoustic encore!',
			status: NoteStatus.Live,
			flagCount: 0,
			flagImmune: false,
			createdAt: new Date()
		});

		const postAction = async (
			actionFn: (arg: any) => unknown,
			fields: Record<string, string>
		) => {
			const formData = new FormData();
			for (const [k, v] of Object.entries(fields)) {
				formData.set(k, v);
			}
			const req = new Request('http://localhost:4173/dashboard', {
				method: 'POST',
				headers: { cookie: fixture.cookie },
				body: formData
			});
			return actionFn({ request: req } as any);
		};

		// 1. Reply & deleteReply
		const replyRes = await postAction(actions.reply, {
			noteId,
			body: 'Thank you for coming out!'
		});
		expect(replyRes).toEqual({ success: true });

		const delReplyRes = await postAction(actions.deleteReply, { noteId });
		expect(delReplyRes).toEqual({ success: true });
		const replyRow = await db.query.noteReplies.findFirst({
			where: eq(schema.noteReplies.noteId, noteId)
		});
		expect(replyRow).toBeUndefined();

		// 2. Non-destructive hide & restore
		const hideRes = await postAction(actions.hide, { noteId });
		expect(hideRes).toEqual({ success: true });
		const hiddenRow = await db.query.notes.findFirst({
			where: eq(schema.notes.id, noteId)
		});
		expect(hiddenRow?.status).toBe(NoteStatus.Hidden);

		const restoreRes = await postAction(actions.restore, { noteId });
		expect(restoreRes).toEqual({ success: true });
		const restoredRow = await db.query.notes.findFirst({
			where: eq(schema.notes.id, noteId)
		});
		expect(restoredRow?.status).toBe(NoteStatus.Live);
		expect(restoredRow?.flagImmune).toBe(true);

		// 3. Block fan -> appears in load.blockedFans -> unblockFan removes block
		const blockRes = await postAction(actions.blockFan, { fanUserId: fanUser.id });
		expect(blockRes).toEqual({ success: true });

		const dashReq = new Request('http://localhost:4173/dashboard', {
			headers: { cookie: fixture.cookie }
		});
		const loadedBlocked = (await (load as any)({
			request: dashReq,
			url: new URL(dashReq.url)
		})) as any;
		expect(loadedBlocked.blockedFans).toHaveLength(1);
		expect(loadedBlocked.blockedFans[0].fanUserId).toBe(fanUser.id);

		const unblockRes = await postAction(actions.unblockFan, { fanUserId: fanUser.id });
		expect(unblockRes).toEqual({ success: true });

		const loadedUnblocked = (await (load as any)({
			request: dashReq,
			url: new URL(dashReq.url)
		})) as any;
		expect(loadedUnblocked.blockedFans).toEqual([]);
	});
});
