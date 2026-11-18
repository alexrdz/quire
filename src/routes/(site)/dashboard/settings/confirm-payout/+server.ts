import { redirect, type RequestHandler } from '@sveltejs/kit';

/**
 * Retired with Stripe (ADR 0008): Venmo changes are confirmed at
 * /dashboard/settings/confirm-venmo. Old payout links land on Settings.
 */
export const GET: RequestHandler = () => {
	throw redirect(303, '/dashboard/settings');
};
