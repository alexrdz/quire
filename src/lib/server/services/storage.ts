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

const ALLOWED_MIME_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/avif',
	'image/svg+xml'
]);

export interface UploadOptions {
	filename: string;
	contentType: string;
	buffer: Buffer;
}

/**
 * Uploads media file to Cloudflare R2 if configured,
 * or falls back to local /static/uploads in development (ADR 0004).
 */
export async function uploadMedia(
	options: UploadOptions
): Promise<Result<{ url: string; key: string }, DomainError>> {
	if (!ALLOWED_MIME_TYPES.has(options.contentType)) {
		return err({
			code: 'UNSUPPORTED_MEDIA_TYPE',
			message: `File type '${options.contentType}' is not supported. Only WebP, AVIF, PNG, JPEG, and SVG images are allowed.`
		});
	}

	const ext = path.extname(options.filename) || '.webp';
	const uniqueKey = `${crypto.randomUUID()}${ext}`;

	// 1. Cloudflare R2 Upload
	if (hasR2Credentials && s3Client) {
		try {
			await s3Client.send(
				new PutObjectCommand({
					Bucket: R2_BUCKET_NAME,
					Key: uniqueKey,
					Body: options.buffer,
					ContentType: options.contentType
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
