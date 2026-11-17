import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { type Result, type DomainError, ok, err } from '$domain/types';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'quire-media';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

const hasR2Credentials = Boolean(
	R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY
);

let s3Client: S3Client | null = null;
if (hasR2Credentials) {
	s3Client = new S3Client({
		region: 'auto',
		endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: R2_ACCESS_KEY_ID!,
			secretAccessKey: R2_SECRET_ACCESS_KEY!
		}
	});
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/avif',
	'image/svg+xml'
]);

export const ALLOWED_AUDIO_MIME_TYPES = new Set([
	'audio/mpeg',
	'audio/mp3',
	'audio/mp4',
	'audio/wav',
	'audio/x-wav',
	'audio/ogg',
	'audio/webm',
	'audio/aac'
]);

export const ALLOWED_MIME_TYPES = new Set([
	...ALLOWED_IMAGE_MIME_TYPES,
	...ALLOWED_AUDIO_MIME_TYPES
]);

const MIME_TO_EXT: Record<string, string> = {
	'image/jpeg': '.jpg',
	'image/png': '.png',
	'image/webp': '.webp',
	'image/avif': '.avif',
	'image/svg+xml': '.svg',
	'audio/mpeg': '.mp3',
	'audio/mp3': '.mp3',
	'audio/mp4': '.m4a',
	'audio/wav': '.wav',
	'audio/x-wav': '.wav',
	'audio/ogg': '.ogg',
	'audio/webm': '.webm',
	'audio/aac': '.aac'
};

const EXT_TO_MIME: Record<string, string> = {
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.avif': 'image/avif',
	'.svg': 'image/svg+xml',
	'.mp3': 'audio/mpeg',
	'.m4a': 'audio/mp4',
	'.mp4': 'audio/mp4',
	'.wav': 'audio/wav',
	'.ogg': 'audio/ogg',
	'.webm': 'audio/webm',
	'.aac': 'audio/aac'
};

export type MediaKindFilter = 'image' | 'audio' | 'any';

export interface UploadOptions {
	filename: string;
	contentType: string;
	buffer: Buffer;
	allowedKind?: MediaKindFilter;
}

export interface UploadResult {
	url: string;
	key: string;
}

function normalizeMimeType(contentType: string, filename: string): string {
	const base = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
	if (base && base !== 'application/octet-stream') {
		return base;
	}
	const ext = path.extname(filename).trim().toLowerCase();
	return EXT_TO_MIME[ext] ?? base;
}

function validateMediaTypeAndSize(
	mimeType: string,
	byteLength: number,
	allowedKind: MediaKindFilter = 'any'
): Result<{ isAudio: boolean }, DomainError> {
	if (byteLength <= 0) {
		return err({
			code: 'EMPTY_FILE',
			message: 'Uploaded file is empty.'
		});
	}

	if (!ALLOWED_MIME_TYPES.has(mimeType)) {
		return err({
			code: 'UNSUPPORTED_MEDIA_TYPE',
			message: `File type '${mimeType || 'unknown'}' is not supported. Allowed images: JPEG, PNG, WebP, AVIF, SVG. Allowed audio: MP3, M4A/MP4, WAV, OGG, WebM, AAC.`
		});
	}

	const isAudio = ALLOWED_AUDIO_MIME_TYPES.has(mimeType);
	const isImage = ALLOWED_IMAGE_MIME_TYPES.has(mimeType);

	if (allowedKind === 'image' && !isImage) {
		return err({
			code: 'UNSUPPORTED_MEDIA_TYPE',
			message: `File type '${mimeType}' is not an image. Please upload JPEG, PNG, WebP, AVIF, or SVG.`
		});
	}

	if (allowedKind === 'audio' && !isAudio) {
		return err({
			code: 'UNSUPPORTED_MEDIA_TYPE',
			message: `File type '${mimeType}' is not a supported audio format. Please upload MP3, M4A, WAV, OGG, WebM, or AAC.`
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

	return ok({ isAudio });
}

function resolveSafeExtension(filename: string, mimeType: string): string {
	const rawExt = path.extname(filename).trim().toLowerCase();
	if (/^\.[a-z0-9]{1,8}$/.test(rawExt)) {
		return rawExt;
	}
	return MIME_TO_EXT[mimeType] ?? '.bin';
}

/**
 * Uploads a validated image or audio buffer to Cloudflare R2 if configured,
 * or falls back to local /static/uploads in development (ADR 0004).
 */
export async function uploadMedia(
	options: UploadOptions
): Promise<Result<UploadResult, DomainError>> {
	const normalizedMime = normalizeMimeType(options.contentType, options.filename);
	const validation = validateMediaTypeAndSize(
		normalizedMime,
		options.buffer.byteLength,
		options.allowedKind ?? 'any'
	);

	if (!validation.ok) {
		return validation;
	}

	const ext = resolveSafeExtension(options.filename, normalizedMime);
	const uniqueKey = `${crypto.randomUUID()}${ext}`;

	// 1. Cloudflare R2 Upload
	if (hasR2Credentials && s3Client) {
		try {
			await s3Client.send(
				new PutObjectCommand({
					Bucket: R2_BUCKET_NAME,
					Key: uniqueKey,
					Body: options.buffer,
					ContentType: normalizedMime
				})
			);

			const publicUrl = R2_PUBLIC_URL
				? `${R2_PUBLIC_URL.replace(/\/$/, '')}/${uniqueKey}`
				: `https://${R2_BUCKET_NAME}.r2.dev/${uniqueKey}`;

			return ok({ url: publicUrl, key: uniqueKey });
		} catch (error) {
			return err({
				code: 'R2_UPLOAD_FAILED',
				message: `Failed to upload to Cloudflare R2: ${String(error)}`
			});
		}
	}

	// 2. Local Fallback (/static/uploads/)
	try {
		const uploadsDir = path.resolve(process.cwd(), 'static/uploads');
		await fs.mkdir(uploadsDir, { recursive: true });
		const filePath = path.join(uploadsDir, uniqueKey);
		await fs.writeFile(filePath, options.buffer);

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
 * Checks size and MIME type before buffering into memory.
 */
export async function uploadFormFile(
	file: File,
	options?: { kind?: MediaKindFilter }
): Promise<Result<UploadResult, DomainError>> {
	if (!file || typeof file.arrayBuffer !== 'function' || file.size <= 0) {
		return err({
			code: 'EMPTY_FILE',
			message: 'Please select a non-empty file to upload.'
		});
	}

	const allowedKind = options?.kind ?? 'any';
	const normalizedMime = normalizeMimeType(file.type || '', file.name || '');
	const preflight = validateMediaTypeAndSize(normalizedMime, file.size, allowedKind);
	if (!preflight.ok) {
		return preflight;
	}

	const arrayBuffer = await file.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);

	return uploadMedia({
		filename: file.name || `upload${MIME_TO_EXT[normalizedMime] ?? ''}`,
		contentType: normalizedMime,
		buffer,
		allowedKind
	});
}
