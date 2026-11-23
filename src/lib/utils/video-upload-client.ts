/**
 * Direct video uploads from the browser (ADR 0010): strip any location, presign, PUT
 * the bytes straight to storage with progress, then finalize. The form sends only the
 * finalized upload id, never the file, so a clip never travels through a server function.
 */

import {
	mayHoldLocation,
	readBoxHeader,
	stripVideoLocations,
	UNREADABLE_VIDEO_MESSAGE,
	VIDEO_HAS_LOCATION_MESSAGE,
	VideoStructureError,
	webmHasLocationTag
} from '$domain/video-location';

export { VIDEO_HAS_LOCATION_MESSAGE, UNREADABLE_VIDEO_MESSAGE };

/** The largest metadata box read whole in the browser; real ones are well under 1 MB. */
const MAX_METADATA_BOX_BYTES = 32 * 1024 * 1024;

/** Where a clip is: no new clip, uploading, failed, or uploaded and finalized. */
export type VideoUploadStatus = 'none' | 'uploading' | 'error' | 'ready';

export type VideoContentType = 'video/mp4' | 'video/webm' | 'video/quicktime';

export interface FinalizedVideo {
	url: string;
	uploadId: string;
	contentType: string;
}

/** A refusal or failure with a message fit to show the Artist. */
export class VideoUploadError extends Error {
	constructor(
		message: string,
		readonly code: string,
		/** False when trying again won't help (too big, wrong type, location data): the Artist must pick another clip. */
		readonly retryable: boolean
	) {
		super(message);
		this.name = 'VideoUploadError';
	}
}

/** Codes from presign and finalize that the same clip will hit again on a retry. */
const FINAL_CODES = new Set([
	'UNSUPPORTED_MEDIA_TYPE',
	'FILE_TOO_LARGE',
	'FORBIDDEN_UPLOAD_KEY',
	'VIDEO_HAS_LOCATION',
	'UNREADABLE_VIDEO',
	'UPLOADS_UNAVAILABLE',
	'EMAIL_NOT_CONFIRMED',
	'ARTIST_REQUIRED',
	'UNAUTHORIZED'
]);

const NETWORK_MESSAGE = "The upload didn't finish. Check your connection and try again.";

/**
 * Recording formats in order of preference: MP4 with H.264/AAC first, so clips recorded
 * on Android or desktop Chrome also play on iPhones, then WebM where MP4 can't be recorded.
 */
export const RECORDING_MIME_PREFERENCE = [
	'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
	'video/mp4;codecs=avc1,mp4a.40.2',
	'video/mp4;codecs=avc1',
	'video/webm;codecs=vp9,opus',
	'video/webm;codecs=vp8,opus',
	'video/webm',
	'video/mp4'
] as const;

/** The first recording format the browser supports, or '' to let MediaRecorder choose. */
export function pickRecordingMimeType(isTypeSupported: (type: string) => boolean): string {
	return RECORDING_MIME_PREFERENCE.find((type) => isTypeSupported(type)) ?? '';
}

/**
 * The upload type for a file: its MIME type without parameters, or its extension when
 * the browser gives no type (some camera-roll pickers). Null when it isn't MP4, WebM or MOV.
 */
export function videoContentTypeOf(file: { type: string; name?: string }): VideoContentType | null {
	const base = file.type.split(';')[0].trim().toLowerCase();
	if (base === 'video/mp4' || base === 'video/x-m4v') return 'video/mp4';
	if (base === 'video/webm') return 'video/webm';
	if (base === 'video/quicktime') return 'video/quicktime';
	if (base) return null;
	const ext = file.name?.split('.').pop()?.toLowerCase();
	if (ext === 'mp4' || ext === 'm4v') return 'video/mp4';
	if (ext === 'webm') return 'video/webm';
	if (ext === 'mov') return 'video/quicktime';
	return null;
}

async function bytesOf(blob: Blob): Promise<Uint8Array> {
	return new Uint8Array(await blob.arrayBuffer());
}

/**
 * A copy of an MP4 or MOV with every location blanked in place (decision 27): same size,
 * same offsets, still plays. Only the top-level boxes that can hold metadata are read
 * (never `mdat`), so even a 50 MB clip costs a few small reads. A WebM with a location
 * tag is refused: WebM can't be blanked in place as safely, and recordings never have one.
 */
export async function prepareVideoForUpload(
	file: Blob & { name?: string },
	contentType: VideoContentType
): Promise<Blob> {
	try {
		if (contentType === 'video/webm') {
			if (webmHasLocationTag(await bytesOf(file))) {
				throw new VideoUploadError(VIDEO_HAS_LOCATION_MESSAGE, 'VIDEO_HAS_LOCATION', false);
			}
			return file;
		}
		const parts: BlobPart[] = [];
		let changed = false;
		let at = 0;
		for (let boxes = 0; at < file.size; boxes++) {
			if (boxes > 1000) throw new VideoStructureError('Too many top-level boxes.');
			const head = await bytesOf(file.slice(at, at + 16));
			const header = readBoxHeader(head, 0, file.size - at);
			if (!header) throw new VideoStructureError('Trailing bytes after the last box.');
			const end = at + header.size;
			if (mayHoldLocation(header.type)) {
				if (header.size > MAX_METADATA_BOX_BYTES) throw new VideoStructureError(`'${header.type}' is too large to check.`);
				const box = await bytesOf(file.slice(at, end));
				const { bytes, removed } = stripVideoLocations(box, at);
				if (removed.length > 0) {
					changed = true;
					parts.push(bytes as Uint8Array<ArrayBuffer>);
				} else {
					parts.push(file.slice(at, end));
				}
			} else {
				parts.push(file.slice(at, end));
			}
			at = end;
		}
		if (!changed) return file;
		return Object.assign(new Blob(parts, { type: file.type || contentType }), { name: file.name });
	} catch (error) {
		if (error instanceof VideoStructureError) throw new VideoUploadError(UNREADABLE_VIDEO_MESSAGE, 'UNREADABLE_VIDEO', false);
		throw error;
	}
}

async function postJson<T>(url: string, body: unknown, signal: AbortSignal): Promise<T> {
	let response: Response;
	try {
		response = await fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body),
			credentials: 'same-origin',
			signal
		});
	} catch (error) {
		if (signal.aborted) throw error;
		throw new VideoUploadError(NETWORK_MESSAGE, 'NETWORK', true);
	}
	const data = await response.json().catch(() => null);
	if (!response.ok) {
		const code: string = data?.error?.code ?? 'UPLOAD_FAILED';
		const message: string = data?.error?.message ?? NETWORK_MESSAGE;
		throw new VideoUploadError(message, code, !FINAL_CODES.has(code));
	}
	return data as T;
}

/**
 * PUTs the bytes with progress. XMLHttpRequest, because fetch can't report upload progress.
 * R2's CORS rule allows only PUT with Content-Type (and the browser's own Content-Length),
 * so this sends exactly the Content-Type presign signed, nothing else, and no credentials.
 * Any CORS or network failure lands in onerror and is shown with Retry, never silently.
 */
function putWithProgress(
	url: string,
	contentType: string,
	file: Blob,
	onProgress: (fraction: number) => void,
	signal: AbortSignal
): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', url);
		xhr.withCredentials = false;
		xhr.setRequestHeader('Content-Type', contentType);
		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
		};
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				onProgress(1);
				resolve();
			} else {
				reject(new VideoUploadError(NETWORK_MESSAGE, `PUT_${xhr.status}`, true));
			}
		};
		xhr.onerror = () => reject(new VideoUploadError(NETWORK_MESSAGE, 'NETWORK', true));
		xhr.onabort = () => reject(new DOMException('The upload was cancelled.', 'AbortError'));
		signal.addEventListener('abort', () => xhr.abort(), { once: true });
		xhr.send(file);
	});
}

/**
 * Uploads one clip: presign, PUT with progress, finalize. Resolves with the finalized
 * upload, or rejects with a VideoUploadError (shown to the Artist) or an AbortError
 * when `signal` cancels it.
 */
export async function uploadVideo(
	file: Blob & { name?: string },
	options: { onProgress?: (fraction: number) => void; signal: AbortSignal; endpoint?: string }
): Promise<FinalizedVideo> {
	const { signal, onProgress = () => {}, endpoint = '/api/uploads/video' } = options;
	const contentType = videoContentTypeOf(file);
	if (!contentType) {
		throw new VideoUploadError('Choose an MP4, WebM or MOV video.', 'UNSUPPORTED_MEDIA_TYPE', false);
	}
	onProgress(0);
	// Location comes off on the phone, before anything leaves it (ADR 0010).
	const upload = await prepareVideoForUpload(file, contentType);
	if (signal.aborted) throw new DOMException('The upload was cancelled.', 'AbortError');
	const slot = await postJson<{ uploadUrl: string; headers: Record<string, string>; key: string }>(
		`${endpoint}/presign`,
		{ contentType, size: upload.size },
		signal
	);
	// The signed type: presign echoes it in headers['content-type'] and it must match exactly.
	await putWithProgress(slot.uploadUrl, slot.headers['content-type'] ?? contentType, upload, onProgress, signal);
	return postJson<FinalizedVideo>(`${endpoint}/finalize`, { key: slot.key }, signal);
}

/** Why a form can't be submitted yet because of its video, or '' when it can. */
export function videoSubmitBlockReason(status: VideoUploadStatus): string {
	if (status === 'uploading') return 'Wait for the video to finish uploading.';
	if (status === 'error') return "The video didn't upload. Retry it, or remove it to continue without it.";
	return '';
}
