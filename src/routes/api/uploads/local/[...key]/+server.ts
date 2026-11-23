import type { RequestHandler } from './$types';
import { acceptLocalVideoPut } from '$lib/server/services/video-upload';

/**
 * The local upload stand-in's PUT target (ADR 0010): development, test and a
 * local Demo, where there is no R2. Everywhere else it answers 404, so it is
 * never a way to write files in production. The URL comes from presign and is
 * signed for one key, type and size.
 */
export const PUT: RequestHandler = async ({ params, url, request }) => {
	const outcome = await acceptLocalVideoPut({
		key: params.key,
		searchParams: url.searchParams,
		contentType: request.headers.get('content-type'),
		contentLength: request.headers.get('content-length'),
		body: request.body
	});
	const headers = { 'cache-control': 'no-store' };
	if (outcome.status === 201) return new Response(null, { status: 201, headers });
	return Response.json({ error: outcome.error }, { status: outcome.status, headers });
};
