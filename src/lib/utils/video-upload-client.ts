/**
 * Direct video uploads from the browser (ADR 0010): presign, PUT the bytes straight
 * to storage with progress, then finalize. The form sends only the finalized upload
 * id, never the file, so a clip never travels through a server function.
 */

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

/** PUTs the bytes with progress. XMLHttpRequest, because fetch can't report upload progress. */
function putWithProgress(
	url: string,
	headers: Record<string, string>,
	file: Blob,
	onProgress: (fraction: number) => void,
	signal: AbortSignal
): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', url);
		for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
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
	const slot = await postJson<{ uploadUrl: string; headers: Record<string, string>; key: string }>(
		`${endpoint}/presign`,
		{ contentType, size: file.size },
		signal
	);
	await putWithProgress(slot.uploadUrl, slot.headers, file, onProgress, signal);
	return postJson<FinalizedVideo>(`${endpoint}/finalize`, { key: slot.key }, signal);
}

/** Why a form can't be submitted yet because of its video, or '' when it can. */
export function videoSubmitBlockReason(status: VideoUploadStatus): string {
	if (status === 'uploading') return 'Wait for the video to finish uploading.';
	if (status === 'error') return "The video didn't upload. Retry it, or remove it to continue without it.";
	return '';
}
