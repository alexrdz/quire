import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { type Result, type DomainError, ok, err } from '$domain/types';

import { getConfig } from '$lib/server/config';

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

const OPTIMIZABLE_RASTER_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_RASTER_EDGE_PX = 1600;

interface SharpPipelineLike {
	rotate(): SharpPipelineLike;
	resize(
		width: number,
		height: number,
		options: { fit: 'inside'; withoutEnlargement: boolean }
	): SharpPipelineLike;
	webp(options: { quality: number }): SharpPipelineLike;
	toBuffer(): Promise<Buffer>;
}

type SharpFactory = (input: Buffer) => SharpPipelineLike;

/**
 * Optional server-side raster optimization hook. Uses `sharp` when installed
 * in the deployment runtime to auto-rotate, cap max dimension at 1600px, and
 * convert to WebP when smaller; gracefully passes through the original buffer otherwise.
 */
export async function optimizeRasterImageBuffer(
	buffer: Buffer,
	mimeType: string
): Promise<{ buffer: Buffer; mimeType: string; extOverride?: string }> {
	if (!OPTIMIZABLE_RASTER_MIMES.has(mimeType)) {
		return { buffer, mimeType };
	}

	const moduleName = 'sharp';
	try {
		const mod = (await import(/* @vite-ignore */ moduleName)) as {
			default?: SharpFactory;
		};
		const sharpFn =
			typeof mod?.default === 'function'
				? mod.default
				: ((mod as unknown as SharpFactory) ?? null);
		if (typeof sharpFn !== 'function') {
			return { buffer, mimeType };
		}

		const optimized = await sharpFn(buffer)
			.rotate()
			.resize(MAX_RASTER_EDGE_PX, MAX_RASTER_EDGE_PX, {
				fit: 'inside',
				withoutEnlargement: true
			})
			.webp({ quality: 84 })
			.toBuffer();

		if (optimized.byteLength > 0 && optimized.byteLength < buffer.byteLength) {
			return { buffer: optimized, mimeType: 'image/webp', extOverride: '.webp' };
		}
	} catch {
		// Fallback to original bytes when sharp is absent or image decode fails
	}

	return { buffer, mimeType };
}

/**
 * Uploads a validated image or audio buffer to Cloudflare R2 if configured,
 * or falls back to local /static/uploads in development (ADR 0004).
 */
export async function uploadMedia(
	options: UploadOptions
): Promise<Result<UploadResult, DomainError>> {
	if (!getConfig().features.uploads) {
		return err({ code: 'UPLOADS_UNAVAILABLE', message: FEATURE_UNAVAILABLE.uploads });
	}

	const normalizedMime = normalizeMimeType(options.contentType, options.filename);
	const validation = validateMediaTypeAndSize(
		normalizedMime,
		options.buffer.byteLength,
		options.allowedKind ?? 'any'
	);

	if (!validation.ok) {
		return validation;
	}

	const optimized = await optimizeRasterImageBuffer(options.buffer, normalizedMime);
	const finalBuffer = optimized.buffer;
	const finalMime = optimized.mimeType;
	const ext = optimized.extOverride ?? resolveSafeExtension(options.filename, finalMime);
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

	// 2. Local Fallback (/static/uploads/), development and the Demo only (ADR 0004, decision 27)
	if (getConfig().mode === 'production') {
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
 * Checks size and MIME type before buffering into memory.
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
