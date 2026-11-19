import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { ArtistAccountStatus } from '$domain/account';
import { db, schema } from '$lib/server/db';
import { auth } from '$lib/server/auth';
import { resolveSafeRedirect } from '$schemas/auth';
import { confirmVenmoChange, inspectVenmoChange, VENMO_CONFIRM_PATH } from '$lib/server/services/venmo';

/**
 * Confirms a Venmo username change or removal (ADR 0008, V.3).
 * The load only checks the link and shows the change. Opening the link (or a
 * mail scanner prefetching it) changes nothing; the POST action applies it.
 */
async function requireArtist(request: Request, url: URL) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) {
		const back = resolveSafeRedirect(`${VENMO_CONFIRM_PATH}${url.search}`, '/dashboard/settings');
		throw redirect(303, `/login?redirect=${encodeURIComponent(back)}`);
	}
	const artist = await db.query.artists.findFirst({
		where: eq(schema.artists.userId, session.user.id)
	});
	if (!artist) throw redirect(303, '/login');
	if (artist.accountStatus === ArtistAccountStatus.Closed) throw redirect(303, '/login?closed=1');
	return { user: session.user, artist };
}

export const load: ServerLoad = async ({ request, url }) => {
	const { artist } = await requireArtist(request, url);
	const token = url.searchParams.get('token');
	const pending = await inspectVenmoChange({ rawToken: token, artist });

	if (!pending.ok) {
		return {
			artist,
			status: 'error' as const,
			errorCode: pending.error.code,
			errorMessage: pending.error.message,
			token: null
		};
	}
	return {
		artist,
		status: 'pending' as const,
		oldUsername: pending.value.oldUsername,
		newUsername: pending.value.newUsername,
		expiresAt: pending.value.expiresAt.toISOString(),
		token
	};
};

export const actions: Actions = {
	default: async ({ request, url }) => {
		const { user, artist } = await requireArtist(request, url);
		const formData = await request.formData();
		const token = String(formData.get('token') ?? '') || url.searchParams.get('token');

		const result = await confirmVenmoChange({ rawToken: token, artist, user });
		if (!result.ok) {
			return fail(result.error.code === 'WRONG_ACCOUNT' ? 403 : 400, {
				confirmError: result.error.message,
				errorCode: result.error.code
			});
		}
		throw redirect(303, `/dashboard/settings?venmo=${result.value.newUsername ? 'changed' : 'removed'}`);
	}
};
