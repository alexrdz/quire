import type { RequestHandler } from './$types';
import { presignVideoUpload } from '$lib/server/services/video-upload';
import { readUploadRequest, respond } from '../json';

/**
 * Step 1 of a direct video upload (ADR 0010): a short-lived PUT URL for a
 * signed-in Artist with a confirmed email.
 *
 * Body: JSON `{ contentType: 'video/mp4' | 'video/webm' | 'video/quicktime', size }`.
 * 200: `{ uploadUrl, method: 'PUT', headers, key, expiresAt }`.
 * Refusals: `{ error: { code, message } }` (see VIDEO_UPLOAD_HTTP_STATUS).
 */
export const POST: RequestHandler = async (event) => {
	const request = await readUploadRequest(event);
	if (request instanceof Response) return request;
	return respond(await presignVideoUpload(request.user, request.body));
};
