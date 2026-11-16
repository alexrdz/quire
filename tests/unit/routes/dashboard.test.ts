import { describe, it, expect } from 'vitest';
import { load } from '../../../src/routes/dashboard/+page.server';
import { db, schema } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { seedDatabase } from '$lib/server/seed';
import crypto from 'node:crypto';

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

		const req = new Request('http://localhost:4173/dashboard', {
			headers: {
				cookie: `better-auth.session_token=${sessionToken}`
			}
		});

		try {
			const data = await (load as any)({ request: req });
			console.log('LOAD RETURNED DATA:', Object.keys(data));
			expect(data.artist).toBeDefined();
		} catch (err: any) {
			console.error('LOAD THREW ERROR:', err);
			throw err;
		}
	});
});
