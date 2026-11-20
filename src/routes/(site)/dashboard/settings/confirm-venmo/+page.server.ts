import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { requireArtist } from '$lib/server/guards';
import { confirmVenmoChange, inspectVenmoChange } from '$lib/server/services/venmo';

/**
 * Confirms a Venmo username change or removal (ADR 0008, V.3).
 * The load only checks the link and shows the change. Opening the link (or a
 * mail scanner prefetching it) changes nothing; the POST action applies it.
 *
 * Both the load and the action use the redirecting guard: an Artist whose
 * session expired before tapping Confirm signs in and comes back to the link.
 */
export const load: ServerLoad = async (event) => {
	const { url } = event;
	const { artist } = await requireArtist(event);
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
	default: async (event) => {
		const { request, url } = event;
		const { user, artist } = await requireArtist(event);
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
