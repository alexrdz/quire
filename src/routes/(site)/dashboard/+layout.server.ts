import type { LayoutServerLoad } from './$types';
import { getEmailConfirmationStatus } from '$lib/server/email/verification';
import { requireArtist } from '$lib/server/guards';

/**
 * Shared by every dashboard page: the Artist guard, and whether the band email
 * still needs confirming (PRODUCTION_PLAN 2.4).
 *
 * The guard here is defense in depth only. Layout loads do not run for form
 * actions and run in parallel with page loads, so every dashboard page load and
 * action still calls its own guard (see $lib/server/guards).
 */
export const load: LayoutServerLoad = async (event) => {
	const { user } = await requireArtist(event);
	return {
		emailConfirmation: getEmailConfirmationStatus(user)
	};
};
