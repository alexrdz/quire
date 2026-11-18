import type { LayoutServerLoad } from './$types';
import { getEmailConfirmationStatus } from '$lib/server/email/verification';

/**
 * Shared by every dashboard page: whether the band email still needs confirming
 * (PRODUCTION_PLAN 2.4). Page loads keep their own sign-in redirects.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		emailConfirmation: locals.user ? getEmailConfirmationStatus(locals.user) : null
	};
};
