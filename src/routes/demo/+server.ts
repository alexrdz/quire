import { redirect, type RequestHandler } from '@sveltejs/kit';
import crypto from 'node:crypto';
import { db, schema } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { seedDatabase } from '$lib/server/seed';

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

	// Set Better Auth session cookie
	cookies.set('better-auth.session_token', sessionToken, {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 7
	});

	throw redirect(303, '/dashboard');
};
