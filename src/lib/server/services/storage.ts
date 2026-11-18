import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { type Result, type DomainError, ok, err } from '$domain/types';

import { allowsStandIn, getConfig } from '$lib/server/config';

import { FEATURE_UNAVAILABLE } from '$lib/features';

const r2 = getConfig().integrations.r2;

const s3Client: S3Client | null = r2
	? new S3Client({
			region: 'auto',
			endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: r2.accessKeyId,
				secretAccessKey: r2.secretAccessKey
			}
		})
	: null;

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_RASTER_EDGE_PX = 1600;

/** Raster formats accepted as input. Every one is re-encoded to WebP before storage. SVG is never accepted. */
export const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export const ALLOWED_AUDIO_MIME_TYPES = new Set([
	'audio/mpeg',
	'audio/mp4',
	'audio/wav',
	'audio/ogg',
	'audio/webm',
	'audio/aac'
]);

export const ALLOWED_MIME_TYPES = new Set([
	...ALLOWED_IMAGE_MIME_TYPES,
	...ALLOWED_AUDIO_MIME_TYPES
]);

/** The only source of stored file extensions. Keys are canonical MIME types detected from bytes. */
export const MIME_TO_EXT: Record<string, string> = {
	'image/jpeg': '.jpg',
	'image/png': '.png',
	'image/webp': '.webp',
	'image/avif': '.avif',
	'audio/mpeg': '.mp3',
	'audio/mp4': '.m4a',
	'audio/wav': '.wav',
	'audio/ogg': '.ogg',
	'audio/webm': '.webm',
	'audio/aac': '.aac'
};

/**
 * Maps a `file-type` detection (by its extension) to the canonical MIME we accept.
 * Anything not listed is rejected, whatever the client claimed.
 */
const DETECTED_EXT_TO_MIME: Record<string, string> = {
	jpg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
	avif: 'image/avif',
	mp3: 'audio/mpeg',
	m4a: 'audio/mp4',
	wav: 'audio/wav',
	ogg: 'audio/ogg',
	oga: 'audio/ogg',
	opus: 'audio/ogg',
	// file-type reports every WebM as video/webm; detectMediaType only accepts audio-only ones.
	webm: 'audio/webm',
	aac: 'audio/aac'
};

export type MediaKindFilter = 'image' | 'audio' | 'any';

export interface UploadOptions {
	/** Ignored for typing: kept only for callers' logs. The type comes from the bytes. */
	filename?: string;
	/** Ignored for typing: the client's claim is never trusted. */
	contentType?: string;
	buffer: Buffer;
	allowedKind?: MediaKindFilter;
}

export interface UploadResult {
	url: string;
	key: string;
}

const UNSUPPORTED_MESSAGE =
	'This file type is not supported. Allowed images: JPEG, PNG, WebP, AVIF. Allowed audio: MP3, M4A, WAV, OGG, WebM, AAC.';

/**
 * Detects the media type from the file's magic bytes. Client filename and MIME
 * are never consulted, so `x.html` labelled `image/png` or an SVG is rejected.
 */
export async function detectMediaType(buffer: Buffer): Promise<string | null> {
	const detected = await fileTypeFromBuffer(buffer);
	if (!detected) return null;
	if (detected.ext === 'mp4') {
		// Only audio-branded MP4 containers count as audio.
		return detected.mime.startsWith('audio/') ? 'audio/mp4' : null;
	}
	if (detected.ext === 'webm') {
		// Browser recordings are WebM; reject any that carry a video (or unknown) track.
		return isAudioOnlyWebm(buffer) ? 'audio/webm' : null;
	}
	return DETECTED_EXT_TO_MIME[detected.ext] ?? null;
}

const EBML_SEGMENT = 0x18538067;
const EBML_TRACKS = 0x1654ae6b;
const EBML_TRACK_ENTRY = 0xae;
const EBML_TRACK_TYPE = 0x83;
const EBML_CLUSTER = 0x1f43b675;
const MATROSKA_TRACK_TYPE_AUDIO = 2;

/** Reads an EBML variable-length integer at `offset`. Element IDs keep their marker bit; sizes drop it. */
function readVint(
	buffer: Buffer,
	offset: number,
	keepMarker: boolean
): { value: number; length: number; unknown: boolean } | null {
	const first = buffer[offset];
	if (first === undefined || first === 0) return null;
	const length = Math.clz32(first) - 23;
	if (length > 8 || offset + length > buffer.length) return null;
	let value = keepMarker ? first : first & (0xff >> length);
	let allOnes = value === 0xff >> length;
	for (let i = 1; i < length; i++) {
		const byte = buffer[offset + i]!;
		value = value * 256 + byte;
		allOnes &&= byte === 0xff;
	}
	return { value, length, unknown: !keepMarker && allOnes };
}

/** Segment > Tracks > TrackEntry is three levels; one spare. Deeper nesting is malformed. */
const MAX_WEBM_DEPTH = 4;

/**
 * True when a WebM file declares at least one track and every track is audio.
 * Walks Segment > Tracks > TrackEntry > TrackType and stops at the first Cluster,
 * so only the header is read. Never throws: malformed, truncated or over-nested
 * input returns false, so the upload fails as UNSUPPORTED_MEDIA_TYPE instead of a 500.
 */
export function isAudioOnlyWebm(buffer: Buffer): boolean {
	const trackTypes: number[] = [];

	const walk = (start: number, end: number, depth: number): boolean => {
		if (depth > MAX_WEBM_DEPTH) return false;
		let offset = start;
		while (offset < end) {
			const id = readVint(buffer, offset, true);
			if (!id) return false;
			const size = readVint(buffer, offset + id.length, false);
			if (!size) return false;
			const dataStart = offset + id.length + size.length;
			const dataEnd = size.unknown ? end : Math.min(end, dataStart + size.value);

			if (id.value === EBML_CLUSTER) return true;
			if (id.value === EBML_SEGMENT || id.value === EBML_TRACKS || id.value === EBML_TRACK_ENTRY) {
				if (!walk(dataStart, dataEnd, depth + 1)) return false;
				if (id.value === EBML_TRACKS) return true;
			} else if (id.value === EBML_TRACK_TYPE) {
				const width = size.value;
				if (width < 1 || width > 6 || dataStart + width > buffer.length) return false;
				trackTypes.push(buffer.readUIntBE(dataStart, width));
			}
			if (size.unknown) return true;
			offset = dataEnd;
		}
		return true;
	};

	try {
		if (!walk(0, buffer.length, 0)) return false;
	} catch {
		return false;
	}
	return trackTypes.length > 0 && trackTypes.every((type) => type === MATROSKA_TRACK_TYPE_AUDIO);
}

function maxBytesFor(kind: MediaKindFilter): number {
	return kind === 'image' ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;
}

function validateDetectedMedia(
	mimeType: string | null,
	byteLength: number,
	allowedKind: MediaKindFilter
): Result<{ mimeType: string; isAudio: boolean }, DomainError> {
	if (byteLength <= 0) {
		return err({ code: 'EMPTY_FILE', message: 'Uploaded file is empty.' });
	}

	if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
		return err({ code: 'UNSUPPORTED_MEDIA_TYPE', message: UNSUPPORTED_MESSAGE });
	}

	const isAudio = ALLOWED_AUDIO_MIME_TYPES.has(mimeType);

	if (allowedKind === 'image' && isAudio) {
		return err({
			code: 'UNSUPPORTED_MEDIA_TYPE',
			message: 'This file is not an image. Please upload JPEG, PNG, WebP or AVIF.'
		});
	}

	if (allowedKind === 'audio' && !isAudio) {
		return err({
			code: 'UNSUPPORTED_MEDIA_TYPE',
			message: 'This file is not a supported audio format. Please upload MP3, M4A, WAV, OGG, WebM or AAC.'
		});
	}

	const maxBytes = isAudio ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES;
	if (byteLength > maxBytes) {
		return err({
			code: 'FILE_TOO_LARGE',
			message: isAudio
				? 'Audio file exceeds the 25MB maximum upload size.'
				: 'Image file exceeds the 10MB maximum upload size.'
		});
	}

	return ok({ mimeType, isAudio });
}

/**
 * Decodes and re-encodes a raster image as WebP with its longest edge capped at
 * 1600px. Re-encoding drops EXIF, GPS, ICC comments and any bytes appended after
 * the image data, which neutralises polyglots. Fails when the bytes do not decode.
 */
export async function reencodeImageToWebp(buffer: Buffer): Promise<Result<Buffer, DomainError>> {
	try {
		const output = await sharp(buffer, { failOn: 'error', limitInputPixels: 50_000_000 })
			.rotate()
			.resize(MAX_RASTER_EDGE_PX, MAX_RASTER_EDGE_PX, { fit: 'inside', withoutEnlargement: true })
			.webp({ quality: 84 })
			.toBuffer();
		return ok(output);
	} catch {
		return err({
			code: 'INVALID_IMAGE',
			message: 'This image could not be read. Please upload a valid JPEG, PNG, WebP or AVIF.'
		});
	}
}

/**
 * Uploads an image or audio buffer to Cloudflare R2 if configured, or to local
 * /static/uploads in development, test and the Demo (ADR 0004, ADR 0007).
 * The type is detected from the bytes; images are always stored as WebP.
 */
export async function uploadMedia(
	options: UploadOptions
): Promise<Result<UploadResult, DomainError>> {
	const config = getConfig();
	if (!config.features.uploads) {
		return err({ code: 'UPLOADS_UNAVAILABLE', message: FEATURE_UNAVAILABLE.uploads });
	}

	const detectedMime = await detectMediaType(options.buffer);
	const validation = validateDetectedMedia(
		detectedMime,
		options.buffer.byteLength,
		options.allowedKind ?? 'any'
	);
	if (!validation.ok) {
		return validation;
	}

	let finalBuffer = options.buffer;
	let finalMime = validation.value.mimeType;
	if (!validation.value.isAudio) {
		const reencoded = await reencodeImageToWebp(options.buffer);
		if (!reencoded.ok) {
			return reencoded;
		}
		finalBuffer = reencoded.value;
		finalMime = 'image/webp';
	}

	const ext = MIME_TO_EXT[finalMime];
	const uniqueKey = `${crypto.randomUUID()}${ext}`;

	// 1. Cloudflare R2 Upload
	if (r2 && s3Client) {
		try {
			await s3Client.send(
				new PutObjectCommand({
					Bucket: r2.bucketName,
					Key: uniqueKey,
					Body: finalBuffer,
					ContentType: finalMime
				})
			);

			const publicUrl = r2.publicUrl
				? `${r2.publicUrl}/${uniqueKey}`
				: `https://${r2.bucketName}.r2.dev/${uniqueKey}`;

			return ok({ url: publicUrl, key: uniqueKey });
		} catch (error) {
			return err({
				code: 'R2_UPLOAD_FAILED',
				message: `Failed to upload to Cloudflare R2: ${String(error)}`
			});
		}
	}

	// 2. Local fallback (/static/uploads/): development, test and the Demo only (ADR 0004, ADR 0007, decision 27)
	if (!allowsStandIn('uploads', config.mode)) {
		return err({ code: 'UPLOADS_UNAVAILABLE', message: FEATURE_UNAVAILABLE.uploads });
	}
	try {
		const uploadsDir = path.resolve(process.cwd(), 'static/uploads');
		await fs.mkdir(uploadsDir, { recursive: true });
		const filePath = path.join(uploadsDir, uniqueKey);
		await fs.writeFile(filePath, finalBuffer);

		return ok({
			url: `/uploads/${uniqueKey}`,
			key: uniqueKey
		});
	} catch (error) {
		return err({
			code: 'LOCAL_UPLOAD_FAILED',
			message: `Failed to save file to local uploads: ${String(error)}`
		});
	}
}

/**
 * Validates and uploads a Web/SvelteKit FormData File to Cloudflare R2 or /static/uploads.
 * Checks the size before buffering; the type is then detected from the bytes.
 */
export async function uploadFormFile(
	file: File,
	options?: { kind?: MediaKindFilter }
): Promise<Result<UploadResult, DomainError>> {
	if (!getConfig().features.uploads) {
		return err({ code: 'UPLOADS_UNAVAILABLE', message: FEATURE_UNAVAILABLE.uploads });
	}

	if (!file || typeof file.arrayBuffer !== 'function' || file.size <= 0) {
		return err({
			code: 'EMPTY_FILE',
			message: 'Please select a non-empty file to upload.'
		});
	}

	const allowedKind = options?.kind ?? 'any';
	if (file.size > maxBytesFor(allowedKind)) {
		return err({
			code: 'FILE_TOO_LARGE',
			message:
				allowedKind === 'image'
					? 'Image file exceeds the 10MB maximum upload size.'
					: 'File exceeds the 25MB maximum upload size.'
		});
	}

	const buffer = Buffer.from(await file.arrayBuffer());
	return uploadMedia({ buffer, allowedKind });
}
