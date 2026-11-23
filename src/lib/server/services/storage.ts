import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {
	S3Client,
	PutObjectCommand,
	HeadObjectCommand,
	GetObjectCommand,
	CopyObjectCommand,
	DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { type Result, type DomainError, ok, err } from '$domain/types';

import { allowsStandIn, getConfig, type Integrations } from '$lib/server/config';

import { featureUnavailableMessage } from '$lib/features';

type R2Settings = NonNullable<Integrations['r2']>;

let cachedClient: { id: string; settings: R2Settings; client: S3Client } | null = null;

/**
 * The R2 settings and an S3 client for them, or null without R2. Built on first
 * use from the current config. Path-style, so a presigned PUT goes to the account
 * endpoint (`r2UploadOrigin` in security-headers.ts, the CSP's connect-src).
 * Checksums only when an operation requires one: otherwise the SDK would pin a
 * presigned PUT to the checksum of an empty body.
 */
function r2Target(): { settings: R2Settings; client: S3Client } | null {
	const settings = getConfig().integrations.r2;
	if (!settings) return null;
	const id = `${settings.accountId}\u0000${settings.accessKeyId}\u0000${settings.secretAccessKey}`;
	if (cachedClient?.id !== id) {
		cachedClient = {
			id,
			settings,
			client: new S3Client({
				region: 'auto',
				endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
				forcePathStyle: true,
				requestChecksumCalculation: 'WHEN_REQUIRED',
				credentials: {
					accessKeyId: settings.accessKeyId,
					secretAccessKey: settings.secretAccessKey
				}
			})
		};
	}
	return { settings, client: cachedClient.client };
}

function r2PublicUrl(settings: R2Settings, key: string): string {
	return settings.publicUrl ? `${settings.publicUrl}/${key}` : `https://${settings.bucketName}.r2.dev/${key}`;
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
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

export const ALLOWED_VIDEO_MIME_TYPES = new Set([
	'video/mp4',
	'video/webm',
	'video/quicktime'
]);

export const ALLOWED_MIME_TYPES = new Set([
	...ALLOWED_IMAGE_MIME_TYPES,
	...ALLOWED_AUDIO_MIME_TYPES,
	...ALLOWED_VIDEO_MIME_TYPES
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
	'audio/aac': '.aac',
	'video/mp4': '.mp4',
	'video/webm': '.webm',
	'video/quicktime': '.mov'
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
	webm: 'video/webm',
	aac: 'audio/aac',
	mov: 'video/quicktime',
	mp4: 'video/mp4'
};

export type MediaKindFilter = 'image' | 'audio' | 'video' | 'any';

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
	'This file type is not supported. Allowed images: JPEG, PNG, WebP, AVIF. Allowed audio: MP3, M4A, WAV, OGG, WebM, AAC. Allowed video: MP4, WebM, MOV.';

/**
 * Detects the media type from the file's magic bytes. Client filename and MIME
 * are never consulted, so `x.html` labelled `image/png` or an SVG is rejected.
 */
export async function detectMediaType(buffer: Buffer): Promise<string | null> {
	const detected = await fileTypeFromBuffer(buffer);
	if (!detected) return null;
	if (detected.ext === 'mp4') {
		return detected.mime.startsWith('audio/') ? 'audio/mp4' : 'video/mp4';
	}
	if (detected.ext === 'webm') {
		return isAudioOnlyWebm(buffer) ? 'audio/webm' : 'video/webm';
	}
	if (detected.ext === 'mov') {
		return 'video/quicktime';
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
	if (kind === 'image') return MAX_IMAGE_BYTES;
	if (kind === 'audio') return MAX_AUDIO_BYTES;
	if (kind === 'video') return MAX_VIDEO_BYTES;
	return Math.max(MAX_IMAGE_BYTES, MAX_AUDIO_BYTES, MAX_VIDEO_BYTES);
}

function validateDetectedMedia(
	mimeType: string | null,
	byteLength: number,
	allowedKind: MediaKindFilter
): Result<{ mimeType: string; isAudio: boolean; isVideo: boolean; isImage: boolean }, DomainError> {
	if (byteLength <= 0) {
		return err({ code: 'EMPTY_FILE', message: 'Uploaded file is empty.' });
	}

	if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
		return err({ code: 'UNSUPPORTED_MEDIA_TYPE', message: UNSUPPORTED_MESSAGE });
	}

	const isImage = ALLOWED_IMAGE_MIME_TYPES.has(mimeType);
	const isAudio = ALLOWED_AUDIO_MIME_TYPES.has(mimeType);
	const isVideo = ALLOWED_VIDEO_MIME_TYPES.has(mimeType);

	if (allowedKind === 'image' && !isImage) {
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

	if (allowedKind === 'video' && !isVideo) {
		return err({
			code: 'UNSUPPORTED_MEDIA_TYPE',
			message: 'This file is not a supported video format. Please upload MP4, WebM or MOV.'
		});
	}

	const maxBytes = isVideo ? MAX_VIDEO_BYTES : isAudio ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES;
	if (byteLength > maxBytes) {
		return err({
			code: 'FILE_TOO_LARGE',
			message: isVideo
				? 'Video file exceeds the 50MB maximum upload size.'
				: isAudio
					? 'Audio file exceeds the 25MB maximum upload size.'
					: 'Image file exceeds the 10MB maximum upload size.'
		});
	}

	return ok({ mimeType, isAudio, isVideo, isImage });
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
		return err({ code: 'UPLOADS_UNAVAILABLE', message: featureUnavailableMessage('uploads', config.mode) });
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
	if (validation.value.isImage) {
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
	const r2 = r2Target();
	if (r2) {
		try {
			await r2.client.send(
				new PutObjectCommand({
					Bucket: r2.settings.bucketName,
					Key: uniqueKey,
					Body: finalBuffer,
					ContentType: finalMime
				})
			);

			return ok({ url: r2PublicUrl(r2.settings, uniqueKey), key: uniqueKey });
		} catch (error) {
			return err({
				code: 'R2_UPLOAD_FAILED',
				message: `Failed to upload to Cloudflare R2: ${String(error)}`
			});
		}
	}

	// 2. Local fallback (/static/uploads/): development, test and a local Demo only
	// (ADR 0004, ADR 0007, decision 27). Never on Netlify, whose disk can't keep files.
	if (!allowsStandIn('uploads', config.mode) || config.localUploads !== 'local') {
		return err({ code: 'UPLOADS_UNAVAILABLE', message: featureUnavailableMessage('uploads', config.mode) });
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
	const config = getConfig();
	if (!config.features.uploads) {
		return err({ code: 'UPLOADS_UNAVAILABLE', message: featureUnavailableMessage('uploads', config.mode) });
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
					: allowedKind === 'video'
						? 'Video file exceeds the 50MB maximum upload size.'
						: 'File exceeds the maximum upload size.'
		});
	}

	const buffer = Buffer.from(await file.arrayBuffer());
	return uploadMedia({ buffer, allowedKind });
}

/* ---------------------------------------------------------------------------
   Direct video uploads (ADR 0010): where the bytes go and how they move
   --------------------------------------------------------------------------- */

/** What a HEAD of a stored object says. */
export interface StoredObject {
	size: number;
	contentType: string | null;
}

/**
 * The storage operations the direct video upload needs, the same for R2 and the
 * local stand-in, so the browser flow is identical everywhere (ADR 0010).
 * Keys are relative to the bucket (R2) or to static/uploads (local).
 */
export interface MediaStore {
	kind: 'r2' | 'local';
	/** A URL the browser PUTs exactly `size` bytes of `contentType` to, valid for `expiresInSeconds`. */
	presignPut(key: string, contentType: string, size: number, expiresInSeconds: number): Promise<string>;
	/** Null when there is no such object. */
	head(key: string): Promise<StoredObject | null>;
	/** Up to the first `bytes` bytes of the object. */
	readStart(key: string, bytes: number): Promise<Buffer>;
	/** Copies `fromKey` to `toKey`, stored as `contentType`. */
	copy(fromKey: string, toKey: string, contentType: string): Promise<void>;
	/** Deletes the object; a missing object is not an error. */
	delete(key: string): Promise<void>;
	publicUrl(key: string): string;
}

/** Path-safe keys only: no `..`, no leading slash, nothing but `[A-Za-z0-9._-]` segments. */
const SAFE_KEY = /^(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

function assertSafeKey(key: string): void {
	if (!SAFE_KEY.test(key) || key.split('/').includes('..')) throw new Error(`Unsafe storage key: ${key}`);
}

function isNotFound(error: unknown): boolean {
	const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
	return e?.name === 'NotFound' || e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404;
}

function r2Store(r2: { settings: R2Settings; client: S3Client }): MediaStore {
	const Bucket = r2.settings.bucketName;
	return {
		kind: 'r2',
		async presignPut(key, contentType, size, expiresInSeconds) {
			assertSafeKey(key);
			// Content-Type and Content-Length are signed, so R2 refuses any other type or size.
			return getSignedUrl(
				r2.client,
				new PutObjectCommand({ Bucket, Key: key, ContentType: contentType, ContentLength: size }),
				{ expiresIn: expiresInSeconds, signableHeaders: new Set(['content-type', 'content-length']) }
			);
		},
		async head(key) {
			assertSafeKey(key);
			try {
				const head = await r2.client.send(new HeadObjectCommand({ Bucket, Key: key }));
				return { size: Number(head.ContentLength ?? 0), contentType: head.ContentType ?? null };
			} catch (error) {
				if (isNotFound(error)) return null;
				throw error;
			}
		},
		async readStart(key, bytes) {
			assertSafeKey(key);
			const object = await r2.client.send(new GetObjectCommand({ Bucket, Key: key, Range: `bytes=0-${bytes - 1}` }));
			const body = object.Body ? await object.Body.transformToByteArray() : new Uint8Array();
			return Buffer.from(body).subarray(0, bytes);
		},
		async copy(fromKey, toKey, contentType) {
			assertSafeKey(fromKey);
			assertSafeKey(toKey);
			await r2.client.send(
				new CopyObjectCommand({
					Bucket,
					Key: toKey,
					CopySource: `${Bucket}/${fromKey}`,
					ContentType: contentType,
					MetadataDirective: 'REPLACE'
				})
			);
		},
		async delete(key) {
			assertSafeKey(key);
			await r2.client.send(new DeleteObjectCommand({ Bucket, Key: key }));
		},
		publicUrl: (key) => r2PublicUrl(r2.settings, key)
	};
}

/** The URL path the local stand-in accepts PUTs on (`src/routes/api/uploads/local/[...key]`). */
export const LOCAL_PUT_PATH = '/api/uploads/local';

/** static/uploads, where the local stand-in keeps every file, pending or public. */
export function localUploadsDir(): string {
	return path.resolve(process.cwd(), 'static/uploads');
}

/** The file for `key` inside static/uploads; throws for any key that could leave it. */
export function localPathFor(key: string): string {
	assertSafeKey(key);
	const dir = localUploadsDir();
	const file = path.resolve(dir, key);
	if (!file.startsWith(dir + path.sep)) throw new Error(`Unsafe storage key: ${key}`);
	return file;
}

/** What a local PUT URL promises: the key, type, exact size and expiry, signed with the cookie secret. */
export interface LocalPutGrant {
	key: string;
	contentType: string;
	size: number;
	/** Unix seconds. */
	expires: number;
}

function localPutSignature(grant: LocalPutGrant): string {
	return crypto
		.createHmac('sha256', getConfig().core.cookieSecret)
		.update(`local-video-put\u0000${grant.key}\u0000${grant.contentType}\u0000${grant.size}\u0000${grant.expires}`)
		.digest('base64url');
}

/**
 * Reads and checks a local PUT URL's grant: a valid signature for this key, not
 * expired. The caller still checks the request's own type and length against it.
 */
export function verifyLocalPutGrant(key: string, params: URLSearchParams, now = new Date()): LocalPutGrant | null {
	const contentType = params.get('type') ?? '';
	const size = Number(params.get('size'));
	const expires = Number(params.get('expires'));
	const given = params.get('sig') ?? '';
	if (!Number.isSafeInteger(size) || size <= 0 || !Number.isSafeInteger(expires)) return null;
	const grant = { key, contentType, size, expires };
	const expected = Buffer.from(localPutSignature(grant));
	const actual = Buffer.from(given);
	if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
	if (expires * 1000 <= now.getTime()) return null;
	return grant;
}

/**
 * The local stand-in (development, test and a local Demo; never deployed): files
 * in static/uploads, and "presigned" PUTs to Quire's own LOCAL_PUT_PATH, signed
 * so only the Artist who asked can write that one key, at that type and size.
 */
function localStore(): MediaStore {
	return {
		kind: 'local',
		async presignPut(key, contentType, size, expiresInSeconds) {
			assertSafeKey(key);
			const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
			const params = new URLSearchParams({ type: contentType, size: String(size), expires: String(expires) });
			params.set('sig', localPutSignature({ key, contentType, size, expires }));
			return `${LOCAL_PUT_PATH}/${key}?${params}`;
		},
		async head(key) {
			try {
				const stat = await fs.stat(localPathFor(key));
				return stat.isFile() ? { size: stat.size, contentType: null } : null;
			} catch {
				return null;
			}
		},
		async readStart(key, bytes) {
			const handle = await fs.open(localPathFor(key), 'r');
			try {
				const buffer = Buffer.alloc(bytes);
				const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
				return buffer.subarray(0, bytesRead);
			} finally {
				await handle.close();
			}
		},
		async copy(fromKey, toKey) {
			const to = localPathFor(toKey);
			await fs.mkdir(path.dirname(to), { recursive: true });
			await fs.copyFile(localPathFor(fromKey), to);
		},
		async delete(key) {
			await fs.rm(localPathFor(key), { force: true });
		},
		publicUrl: (key) => `/uploads/${key}`
	};
}

/** True when this server is the local upload stand-in: no R2, and a mode that allows it. */
export function usesLocalUploadStandIn(): boolean {
	const config = getConfig();
	return !r2Target() && allowsStandIn('uploads', config.mode) && config.localUploads === 'local';
}

/** R2 when configured, else the local stand-in where allowed, else null (uploads are off). */
export function mediaStore(): MediaStore | null {
	const r2 = r2Target();
	if (r2) return r2Store(r2);
	return usesLocalUploadStandIn() ? localStore() : null;
}
