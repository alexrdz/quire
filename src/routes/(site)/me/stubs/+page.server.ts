import { redirect, type ServerLoad } from '@sveltejs/kit';
import { db, schema } from '$lib/server/db';
import { eq, desc } from 'drizzle-orm';
import { auth } from '$lib/server/auth';

export const load: ServerLoad = async ({ request }) => {
	const session = await auth.api.getSession({
		headers: request.headers
	});

	if (!session?.user) {
		throw redirect(303, '/login?redirect=/me/stubs');
	}

	const collectionEntries = await db.query.collections.findMany({
		where: eq(schema.collections.fanUserId, session.user.id),
		orderBy: [desc(schema.collections.createdAt)],
		with: {
			issue: {
				with: {
					artist: true
				}
			}
		}
	});

	const stamped = collectionEntries.filter((entry) => entry.kind === 'stamped');
	const saved = collectionEntries.filter((entry) => entry.kind === 'saved');

	return {
		user: session.user,
		stamped,
		saved
	};
};
