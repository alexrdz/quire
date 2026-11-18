import { redirect, type RequestHandler } from '@sveltejs/kit';
import { clearSessionCookie } from '$lib/server/auth';
import { resolveSafeRedirect } from '$schemas/auth';

/**
 * Sign out is POST-only (PRODUCTION_PLAN 2.2), so a link or image tag on another
 * site cannot sign anyone out. There is no GET handler: SvelteKit answers GET with 405.
 */
export const POST: RequestHandler = async ({ cookies, request, url }) => {
	let rawRedirect: unknown = url.searchParams.get('redirect');
	const contentType = request.headers.get('content-type') ?? '';
	if (
		contentType.includes('application/x-www-form-urlencoded') ||
		contentType.includes('multipart/form-data')
	) {
		const formData = await request.formData().catch(() => null);
		rawRedirect = formData?.get('redirectTo') ?? rawRedirect;
	}

	await clearSessionCookie(cookies);
	throw redirect(303, resolveSafeRedirect(rawRedirect, '/'));
};
