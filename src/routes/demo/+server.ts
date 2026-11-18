import { error, redirect, type RequestHandler } from '@sveltejs/kit';
import { allowsSampleData, getConfig } from '$lib/server/config';
import { db, schema } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { seedDatabase } from '$lib/server/seed';
import { createSessionForUser } from '$lib/server/auth';

/** Sample logins: development, test and the Demo only. Not found in production (ADR 0007). */
export const GET: RequestHandler = async ({ cookies, url }) => {
	if (!allowsSampleData(getConfig().mode)) {
		throw error(404, 'Not found');
	}

	await seedDatabase();

	const role = url.searchParams.get('role') || 'artist';
	const redirectTo = url.searchParams.get('redirect');

	if (role === 'fan') {
		const demoFan = await db.query.users.findFirst({
			where: eq(schema.users.email, 'maya@example.com')
		});
		if (!demoFan) {
			throw redirect(303, '/');
		}
		await createSessionForUser(cookies, demoFan.id);
		throw redirect(303, redirectTo || '/me/stubs');
	}

	const demoArtist = await db.query.artists.findFirst({
		where: eq(schema.artists.slug, 'the-neon-velvet'),
		with: { user: true }
	});

	if (!demoArtist) {
		throw redirect(303, '/');
	}

	await createSessionForUser(cookies, demoArtist.userId);

	throw redirect(303, redirectTo || '/dashboard');
};
