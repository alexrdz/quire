import { type ServerLoad } from '@sveltejs/kit';
import { db, schema } from '$lib/server/db';
import { eq, desc } from 'drizzle-orm';
import { requireFanPage, toViewer } from '$lib/server/guards';
import { isPubliclyReadable } from '$domain/issue';

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

	// Never a draft, even one saved before drafts were closed off (B1-T34).
	const readable = collectionEntries.filter((entry) => entry.issue && isPubliclyReadable(entry.issue));
	const stamped = readable.filter((entry) => entry.kind === 'stamped');
	const saved = readable.filter((entry) => entry.kind === 'saved');

	return {
		viewer: toViewer(user),
		stamped,
		saved
	};
};
