import { error, redirect, type RequestHandler } from '@sveltejs/kit';
import { getConfig } from '$lib/server/config';
import { processIssueScan } from '$lib/server/services/stamping';

export const GET: RequestHandler = async ({ params, url, cookies }) => {
	const slug = params.slug;
	if (!slug) {
		throw error(400, 'Issue slug is required.');
	}

	const secretKey = url.searchParams.get('k');
	if (!secretKey) {
		throw error(400, 'Physical QR scan secret parameter "k" is missing.');
	}

	const result = await processIssueScan(slug, secretKey, new Date());
	if (!result.ok) {
		throw error(403, result.error.message);
	}

	// Set secure HTTP-only signed attendance cookie (valid for 30 days)
	cookies.set(`quire_scan_${slug}`, result.value.token, {
		path: '/',
		httpOnly: true,
		secure: getConfig().isDeployed,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 30
	});

	throw redirect(303, result.value.redirectUrl);
};
