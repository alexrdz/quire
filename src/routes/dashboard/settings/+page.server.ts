import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { db, schema } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { auth } from '$lib/server/auth';

export const load: ServerLoad = async ({ request }) => {
	const session = await auth.api.getSession({
		headers: request.headers
	});

	if (!session?.user) {
		throw redirect(303, '/login?redirect=/dashboard/settings');
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
	updateSettings: async ({ request }) => {
		const session = await auth.api.getSession({
			headers: request.headers
		});
		if (!session?.user) return fail(401, { error: 'Unauthorized' });

		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.userId, session.user.id)
		});
		if (!artist) return fail(401, { error: 'Artist not found' });

		const formData = await request.formData();
		const generalWallApproveFirst = formData.get('generalWallApproveFirst') === 'true';
		const simulatePayouts = formData.get('simulatePayouts') === 'true';

		await db
			.update(schema.artists)
			.set({
				generalWallApproveFirst,
				payoutsEnabled: simulatePayouts || artist.payoutsEnabled,
				updatedAt: new Date()
			})
			.where(eq(schema.artists.id, artist.id));

		return { success: true };
	}
};
