import type { RequestEvent } from '@sveltejs/kit';
import type { DomainError, Result } from '$domain/types';
import { optionalUser } from '$lib/server/guards';
import { VIDEO_UPLOAD_HTTP_STATUS, type Uploader } from '$lib/server/services/video-upload';

/** Upload requests are a few fields of JSON; anything bigger is refused unread. */
const MAX_BODY_BYTES = 2048;

const TOO_LARGE = { ok: false, error: { code: 'REQUEST_TOO_LARGE', message: 'That upload request was too large.' } } as const;

/**
 * Reads at most `limit` bytes of the body, cancelling the stream as soon as it goes
 * over: null when it is longer, so an oversized body is never buffered whole.
 */
async function readCapped(request: Request, limit: number): Promise<string | null> {
	if (!request.body) return '';
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > limit) {
			await reader.cancel().catch(() => undefined);
			return null;
		}
		chunks.push(value);
	}
	const all = new Uint8Array(total);
	let at = 0;
	for (const chunk of chunks) {
		all.set(chunk, at);
		at += chunk.byteLength;
	}
	return new TextDecoder().decode(all);
}

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
	// Refused before reading when the declared length is over the cap, and the read itself
	// stops at the cap, so a missing or false content-length can't make us buffer a big body.
	const declared = Number(event.request.headers.get('content-length'));
	if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return respond(TOO_LARGE);
	const text = await readCapped(event.request, MAX_BODY_BYTES);
	if (text === null) return respond(TOO_LARGE);
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
