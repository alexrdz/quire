import { afterEach, describe, it, expect } from 'vitest';
import { actions, load } from '../../../src/routes/dashboard/+page.server';
import { db, schema } from '$lib/server/db';
import { authSecret } from '$lib/server/auth';
import { eq } from 'drizzle-orm';
import { seedDatabase } from '$lib/server/seed';
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
		expect(data.artistBackPageUrl).toBe('http://localhost:4173/a/the-neon-velvet');
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
		expect(initial.artistBackPageUrl).toBe(`http://localhost:4173/a/${fixture.slug}`);

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
});
