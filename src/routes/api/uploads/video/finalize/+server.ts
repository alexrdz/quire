import type { RequestHandler } from './$types';
import { finalizeVideoUpload } from '$lib/server/services/video-upload';
import { readUploadRequest, respond } from '../json';

/**
 * Step 3 of a direct video upload (ADR 0010): verifies the uploaded file and
 * publishes it. Any refusal deletes the pending file.
 *
 * Body: JSON `{ key }`, the key presign returned.
 * 200: `{ url, uploadId, contentType }`; the form submits `uploadId`.
 * Refusals: `{ error: { code, message } }` (see VIDEO_UPLOAD_HTTP_STATUS).
 */
export const POST: RequestHandler = async (event) => {
	const request = await readUploadRequest(event);
	if (request instanceof Response) return request;
	return respond(await finalizeVideoUpload(request.user, request.body));
};
