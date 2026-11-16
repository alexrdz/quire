import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { db, schema } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const load: ServerLoad = async ({ request, url }) => {
	const session = await auth.api.getSession({
		headers: request.headers
	});

	const redirectTo = url.searchParams.get('redirect') || '/dashboard';

	if (session?.user) {
		throw redirect(303, redirectTo);
	}

	return {
		redirectTo
	};
};

export const actions: Actions = {
	login: async ({ request, url }) => {
		const formData = await request.formData();
		const email = String(formData.get('email') || '');
		const password = String(formData.get('password') || '');
		const redirectTo = url.searchParams.get('redirect') || '/dashboard';

		try {
			await auth.api.signInEmail({
				body: { email, password },
				headers: request.headers
			});
		} catch (err: any) {
			return fail(400, { error: err?.message || 'Invalid email or password.' });
		}

		throw redirect(303, redirectTo);
	},

	signup: async ({ request, url }) => {
		const formData = await request.formData();
		const email = String(formData.get('email') || '');
		const password = String(formData.get('password') || '');
		const name = String(formData.get('name') || '');
		const redirectTo = url.searchParams.get('redirect') || '/dashboard';

		try {
			const res = await auth.api.signUpEmail({
				body: {
					email,
					password,
					name,
					accountType: 'artist'
				},
				headers: request.headers
			});

			if (res?.user) {
				// Create default artist record
				const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
				await db.insert(schema.artists).values({
					id: crypto.randomUUID(),
					userId: res.user.id,
					slug: `${slug}-${Math.floor(Math.random() * 1000)}`,
					displayName: name,
					bio: 'Touring band on Quire.',
					accentColor: '#05D9E8',
					typePairing: 'sans-serif',
					tipPresetsJson: '[3, 5, 10, 20]',
					linksJson: '[]',
					payoutsEnabled: false,
					verified: false,
					generalWallApproveFirst: false,
					createdAt: new Date(),
					updatedAt: new Date()
				});
			}
		} catch (err: any) {
			return fail(400, { error: err?.message || 'Failed to create account.' });
		}

		throw redirect(303, redirectTo);
	}
};
