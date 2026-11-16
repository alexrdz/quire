import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { db, schema } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { auth } from '$lib/server/auth';

export const load: ServerLoad = async ({ request }) => {
	const session = await auth.api.getSession({
		headers: request.headers
	});

	if (!session?.user) {
		throw redirect(303, '/login?redirect=/dashboard/template');
	}

	const artist = await db.query.artists.findFirst({
		where: eq(schema.artists.userId, session.user.id)
	});

	if (!artist) {
		throw redirect(303, '/login');
	}

	return {
		artist
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		const session = await auth.api.getSession({
			headers: request.headers
		});
		if (!session?.user) return fail(401, { error: 'Unauthorized' });

		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.userId, session.user.id)
		});
		if (!artist) return fail(401, { error: 'Artist not found' });

		const formData = await request.formData();
		const accentColor = String(formData.get('accentColor') || '#05D9E8');
		const typePairing = String(formData.get('typePairing') || 'sans-serif');
		const bio = String(formData.get('bio') || '');
		const tipPresetsJson = String(formData.get('tipPresetsJson') || '[3, 5, 10, 20]');

		await db
			.update(schema.artists)
			.set({
				accentColor,
				typePairing,
				bio,
				tipPresetsJson,
				updatedAt: new Date()
			})
			.where(eq(schema.artists.id, artist.id));

		return { success: true };
	}
};
