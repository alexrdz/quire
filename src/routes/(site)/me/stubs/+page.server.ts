import { type ServerLoad } from '@sveltejs/kit';
import { db, schema } from '$lib/server/db';
import { eq, desc } from 'drizzle-orm';
import { requireFanPage } from '$lib/server/guards';

export const load: ServerLoad = async (event) => {
	const { user } = requireFanPage(event);

	const collectionEntries = await db.query.collections.findMany({
		where: eq(schema.collections.fanUserId, user.id),
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
		user: user,
		stamped,
		saved
	};
};
