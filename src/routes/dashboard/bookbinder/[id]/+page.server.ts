import { error, fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import crypto from 'node:crypto';
import { db, schema } from '$lib/server/db';
import { eq, and, asc } from 'drizzle-orm';
import { auth } from '$lib/server/auth';

export const load: ServerLoad = async ({ params, request }) => {
	const session = await auth.api.getSession({
		headers: request.headers
	});

	if (!session?.user) {
		throw redirect(303, `/login?redirect=/dashboard/bookbinder/${params.id}`);
	}

	const artist = await db.query.artists.findFirst({
		where: eq(schema.artists.userId, session.user.id)
	});

	if (!artist) {
		throw redirect(303, '/login');
	}

	const issue = await db.query.issues.findFirst({
		where: and(eq(schema.issues.id, params.id!), eq(schema.issues.artistId, artist.id)),
		with: {
			issuePages: {
				orderBy: [asc(schema.issuePages.position)]
			}
		}
	});

	if (!issue) {
		throw error(404, 'Issue not found or unauthorized');
	}

	return {
		artist,
		issue,
		pages: issue.issuePages
	};
};

export const actions: Actions = {
	save: async ({ request, params }) => {
		const session = await auth.api.getSession({
			headers: request.headers
		});
		if (!session?.user) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const coverNote = String(formData.get('coverNote') || '');
		const city = String(formData.get('city') || '');
		const venue = String(formData.get('venue') || '');

		await db
			.update(schema.issues)
			.set({
				coverNote,
				city,
				venue,
				updatedAt: new Date()
			})
			.where(eq(schema.issues.id, params.id!));

		return { success: true };
	},

	addPage: async ({ request, params }) => {
		const session = await auth.api.getSession({
			headers: request.headers
		});
		if (!session?.user) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const kind = String(formData.get('kind') || 'text');
		const body = String(formData.get('body') || '');

		// Find highest position
		const pages = await db.query.issuePages.findMany({
			where: eq(schema.issuePages.issueId, params.id!)
		});
		const position = pages.length + 1;

		await db.insert(schema.issuePages).values({
			id: crypto.randomUUID(),
			issueId: params.id!,
			position,
			kind,
			contentJson: JSON.stringify({ body, songs: ['Song 1', 'Song 2', 'Song 3'] }),
			createdAt: new Date()
		});

		return { success: true };
	},

	deletePage: async ({ request }) => {
		const session = await auth.api.getSession({
			headers: request.headers
		});
		if (!session?.user) return fail(401, { error: 'Unauthorized' });

		const formData = await request.formData();
		const pageId = String(formData.get('pageId') || '');

		await db.delete(schema.issuePages).where(eq(schema.issuePages.id, pageId));

		return { success: true };
	}
};
