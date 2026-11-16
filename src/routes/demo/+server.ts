import { redirect, type RequestHandler } from '@sveltejs/kit';
import crypto from 'node:crypto';
import { db, schema } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { seedDatabase } from '$lib/server/seed';
import { makeSignature } from 'better-auth/crypto';

export const GET: RequestHandler = async ({ cookies }) => {
	// Ensure seeded
	await seedDatabase();

	const demoArtist = await db.query.artists.findFirst({
		where: eq(schema.artists.slug, 'the-neon-velvet'),
		with: { user: true }
	});

	if (!demoArtist) {
		throw redirect(303, '/');
	}

	// Create session token for the demo artist user
	const sessionToken = `demo_session_${crypto.randomUUID()}`;
	const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

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

	// Set Better Auth session cookie
	cookies.set('better-auth.session_token', signedCookie, {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 7
	});

	throw redirect(303, '/dashboard');
};
