import { describe, it, expect } from 'vitest';
import { load } from '../../../src/routes/dashboard/+page.server';
import { db, schema } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { seedDatabase } from '$lib/server/seed';
import crypto from 'node:crypto';
import { makeSignature } from 'better-auth/crypto';

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
		const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

		await db.insert(schema.sessions).values({
			id: crypto.randomUUID(),
			userId: demoArtist.userId,
			token: sessionToken,
			expiresAt,
			createdAt: new Date(),
			updatedAt: new Date()
		});

		const secret = process.env.BETTER_AUTH_SECRET || 'quire_development_secret_at_least_32_characters_long';
		const signature = await makeSignature(sessionToken, secret);
		const signedCookie = `${sessionToken}.${signature}`;

		const req = new Request('http://localhost:4173/dashboard', {
			headers: {
				cookie: `better-auth.session_token=${signedCookie}`
			}
		});

		const data = (await (load as any)({ request: req })) as any;
		expect(data.artist).toBeDefined();
		expect(data.artist.displayName).toBe('The Neon Velvet');
		expect(data.issues).toBeDefined();
		expect(data.issues.length).toBeGreaterThan(0);
		expect(data.pendingNotes).toBeDefined();
		expect(data.latestRecap).toBeDefined();
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
