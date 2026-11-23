import type { RequestEvent } from '@sveltejs/kit';
import type { DomainError, Result } from '$domain/types';
import { optionalUser } from '$lib/server/guards';
import { VIDEO_UPLOAD_HTTP_STATUS, type Uploader } from '$lib/server/services/video-upload';

/** Upload requests are a few fields of JSON; anything bigger is refused unread. */
const MAX_BODY_BYTES = 2048;

/**
 * The signed-in user and the JSON body of a video upload request. Only
 * `application/json` is read: a cross-site form can't send it without a CORS
 * preflight, which Quire never grants.
 */
export async function readUploadRequest(
	event: Pick<RequestEvent, 'request' | 'locals' | 'url'>
): Promise<{ user: Uploader | null; body: unknown } | Response> {
	if (!event.request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
		return respond({ ok: false, error: { code: 'INVALID_REQUEST', message: 'Send the upload request as JSON.' } });
	}
	const text = await event.request.text();
	if (text.length > MAX_BODY_BYTES) {
		return respond({ ok: false, error: { code: 'INVALID_REQUEST', message: 'That upload request was not understood.' } });
	}
	let body: unknown = null;
	try {
		body = JSON.parse(text);
	} catch {
		return respond({ ok: false, error: { code: 'INVALID_REQUEST', message: 'That upload request was not understood.' } });
	}
	return { user: optionalUser(event)?.user ?? null, body };
}

/** `{ ...value }` with 200, or `{ error: { code, message } }` with the code's status. Never cached. */
export function respond<T extends object>(result: Result<T, DomainError>): Response {
	const headers = { 'cache-control': 'no-store' };
	if (result.ok) return Response.json(result.value, { status: 200, headers });
	const { code, message } = result.error;
	return Response.json({ error: { code, message } }, { status: VIDEO_UPLOAD_HTTP_STATUS[code] ?? 400, headers });
}
