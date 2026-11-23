/**
 * Direct-to-storage video uploads (ADR 0010).
 *
 * A clip is 15 to 50 MB, far over the ~6 MB a Netlify Function accepts, so the
 * bytes go from the Artist's browser straight to R2:
 *
 * 1. `presignVideoUpload`: the usual upload gates, then a short-lived PUT URL for
 *    `pending/<artistId>/<uuid>.<ext>` that signs the declared type and size.
 * 2. The browser PUTs the bytes there itself.
 * 3. `finalizeVideoUpload`: checks the key is this Artist's, the stored size, and
 *    the type from the first bytes, then copies the file to its public key and
 *    deletes the pending one. Any refusal deletes the pending file too.
 *
 * Without R2 (development, test, a local Demo) the same flow runs against the
 * local stand-in in `storage.ts`, whose PUT endpoint is `acceptLocalVideoPut`.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { type DomainError, type Result, err, ok } from '$domain/types';
import { ArtistAccountStatus } from '$domain/account';
import { featureUnavailableMessage } from '$lib/features';
import { finalizeVideoUploadSchema, presignVideoUploadSchema } from '$lib/schemas/upload';
import { getConfig } from '../config';
import { db, schema } from '../db';
import { EMAIL_CONFIRMATION_REQUIRED, isEmailConfirmed } from '../email/verification';
import { consumeRateLimit } from './rate-limit';
import {
	ALLOWED_VIDEO_MIME_TYPES,
	MAX_VIDEO_BYTES,
	MIME_TO_EXT,
	type MediaStore,
	detectMediaType,
	localPathFor,
	mediaStore,
	usesLocalUploadStandIn,
	verifyLocalPutGrant
} from './storage';

/** How long a presigned PUT stays valid. */
export const VIDEO_PRESIGN_TTL_SECONDS = 10 * 60;

/** How much of the file finalize reads to detect its type. WebM keeps its track list near the start. */
export const VIDEO_SNIFF_BYTES = 64 * 1024;

/** How long a finalized upload id is accepted by the Quick Issue and Bookbinder forms. */
export const VIDEO_UPLOAD_ID_MAX_AGE_SECONDS = 24 * 60 * 60;

/** The extension for each declared type, used only for the pending key. The public key uses the detected type. */
const DECLARED_EXT: Record<string, string> = {
	'video/mp4': 'mp4',
	'video/webm': 'webm',
	'video/quicktime': 'mov'
};

/** `pending/<artistId>/<uuid>.<ext>`: the only keys presign hands out and finalize accepts. */
const PENDING_KEY = /^pending\/([A-Za-z0-9_-]{1,64})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(mp4|webm|mov)$/;

export function pendingVideoKey(artistId: string, uuid: string, contentType: string): string {
	return `pending/${artistId}/${uuid}.${DECLARED_EXT[contentType]}`;
}

/** The pending key's owner and uuid, or null when it is not a pending video key. */
export function parsePendingVideoKey(key: string): { artistId: string; uuid: string } | null {
	const match = PENDING_KEY.exec(key);
	return match ? { artistId: match[1]!, uuid: match[2]! } : null;
}

/** HTTP status for each refusal code, shared by the upload endpoints. */
export const VIDEO_UPLOAD_HTTP_STATUS: Record<string, number> = {
	UNAUTHORIZED: 401,
	ARTIST_REQUIRED: 403,
	EMAIL_NOT_CONFIRMED: 403,
	FORBIDDEN_UPLOAD_KEY: 403,
	INVALID_REQUEST: 400,
	INVALID_UPLOAD_KEY: 400,
	EMPTY_FILE: 400,
	SIZE_MISMATCH: 400,
	UPLOAD_NOT_FOUND: 404,
	FILE_TOO_LARGE: 413,
	UNSUPPORTED_MEDIA_TYPE: 415,
	RATE_LIMITED: 429,
	UPLOADS_UNAVAILABLE: 503,
	STORAGE_FAILED: 502
};

const MESSAGES = {
	unauthorized: 'Sign in to upload a video.',
	artistRequired: 'Active artist account required.',
	invalid: 'That upload request was not understood.',
	tooLarge: 'Video file exceeds the 50MB maximum upload size.',
	notVideo: 'This file is not a supported video format. Please upload MP4, WebM or MOV.',
	badKey: 'That upload could not be found. Please upload the video again.',
	notYours: 'That upload belongs to another account.',
	notFound: 'The video did not finish uploading. Please try again.',
	empty: 'The uploaded video is empty. Please try again.',
	storage: 'The video could not be saved. Please try again.'
} as const;

/** The signed-in user, as the upload endpoints see them. */
export interface Uploader {
	id: string;
	emailVerified?: boolean | null;
}

interface UploadArtist {
	artistId: string;
	store: MediaStore;
}

/** The gates every step shares: uploads on, a signed-in active Artist, a confirmed email (decision 31). */
async function gate(user: Uploader | null): Promise<Result<UploadArtist, DomainError>> {
	const config = getConfig();
	const store = config.features.uploads ? mediaStore() : null;
	if (!store) {
		return err({ code: 'UPLOADS_UNAVAILABLE', message: featureUnavailableMessage('uploads', config.mode) });
	}
	if (!user) return err({ code: 'UNAUTHORIZED', message: MESSAGES.unauthorized });

	const artist = await db.query.artists.findFirst({ where: eq(schema.artists.userId, user.id) });
	if (!artist || artist.accountStatus === ArtistAccountStatus.Closed) {
		return err({ code: 'ARTIST_REQUIRED', message: MESSAGES.artistRequired });
	}
	if (!isEmailConfirmed(user)) {
		return err({ code: 'EMAIL_NOT_CONFIRMED', message: EMAIL_CONFIRMATION_REQUIRED.upload });
	}
	return ok({ artistId: artist.id, store });
}

export interface PresignedVideoUpload {
	/** PUT the bytes here, with exactly these headers. */
	uploadUrl: string;
	method: 'PUT';
	headers: { 'content-type': string };
	/** Send this to finalize once the PUT succeeds. */
	key: string;
	expiresAt: string;
}

/**
 * Step 1: an upload slot for a signed-in Artist. Refuses when uploads are off,
 * the email is unconfirmed, the type is not MP4/WebM/MOV, the size is over
 * MAX_VIDEO_BYTES, or the Artist is over the video upload rate limit.
 */
export async function presignVideoUpload(
	user: Uploader | null,
	input: unknown,
	now: Date = new Date()
): Promise<Result<PresignedVideoUpload, DomainError>> {
	const gated = await gate(user);
	if (!gated.ok) return gated;
	const { artistId, store } = gated.value;

	const parsed = presignVideoUploadSchema.safeParse(input);
	if (!parsed.success) {
		const typeIssue = parsed.error.issues.find((issue) => issue.path[0] === 'contentType');
		return typeIssue
			? err({ code: 'UNSUPPORTED_MEDIA_TYPE', message: typeIssue.message })
			: err({ code: 'INVALID_REQUEST', message: parsed.error.issues[0]?.message ?? MESSAGES.invalid });
	}
	const { contentType, size } = parsed.data;
	if (size > MAX_VIDEO_BYTES) return err({ code: 'FILE_TOO_LARGE', message: MESSAGES.tooLarge });

	const limit = await consumeRateLimit('videoUploadArtist', artistId, now);
	if (!limit.allowed) return err({ code: 'RATE_LIMITED', message: limit.message });

	const key = pendingVideoKey(artistId, crypto.randomUUID(), contentType);
	try {
		const uploadUrl = await store.presignPut(key, contentType, size, VIDEO_PRESIGN_TTL_SECONDS);
		return ok({
			uploadUrl,
			method: 'PUT',
			headers: { 'content-type': contentType },
			key,
			expiresAt: new Date(now.getTime() + VIDEO_PRESIGN_TTL_SECONDS * 1000).toISOString()
		});
	} catch (error) {
		console.error('[video-upload] presign failed', error);
		return err({ code: 'STORAGE_FAILED', message: MESSAGES.storage });
	}
}

export interface FinalizedVideoUpload {
	/** The public URL to store on the page. */
	url: string;
	/** Opaque proof that this Artist finalized this upload; the forms check it with `verifyVideoUploadId`. */
	uploadId: string;
	contentType: string;
}

/**
 * B1-T23 adds the location check here (ADR 0010, "Checked on the server"): it
 * reads the file's metadata and refuses a video that still carries a location.
 * Until then every video passes.
 */
export async function refuseVideoWithLocation(
	_store: MediaStore,
	_pendingKey: string,
	_contentType: string
): Promise<Result<void, DomainError>> {
	return ok(undefined);
}

/**
 * Step 3: verifies the uploaded bytes and publishes them. The key must be a
 * pending key of this Artist; the stored file must exist, be non-empty and at
 * most MAX_VIDEO_BYTES; its first bytes must be a video; and it must pass the
 * location check. Then it is copied to `<uuid>.<ext>` (the extension from the
 * detected type) and the pending file is deleted. Any refusal after the key is
 * recognised as a pending video key deletes the pending file.
 */
export async function finalizeVideoUpload(
	user: Uploader | null,
	input: unknown
): Promise<Result<FinalizedVideoUpload, DomainError>> {
	const parsed = finalizeVideoUploadSchema.safeParse(input);
	const pending = parsed.success ? parsePendingVideoKey(parsed.data.key) : null;
	const pendingKey = pending && parsed.success ? parsed.data.key : null;

	// A caller who fails the gates never deletes anything; R2's lifecycle rule
	// removes abandoned pending files after a day (ADR 0010).
	const gated = await gate(user);
	if (!gated.ok) return gated;
	const { artistId, store } = gated.value;

	if (!pending || !pendingKey) return err({ code: 'INVALID_UPLOAD_KEY', message: MESSAGES.badKey });

	const refuse = async (error: DomainError): Promise<Result<never, DomainError>> => {
		try {
			await store.delete(pendingKey);
		} catch (cleanupError) {
			console.error('[video-upload] could not delete a refused pending upload', cleanupError);
		}
		return err(error);
	};

	if (pending.artistId !== artistId) return refuse({ code: 'FORBIDDEN_UPLOAD_KEY', message: MESSAGES.notYours });

	try {
		const stored = await store.head(pendingKey);
		if (!stored) return err({ code: 'UPLOAD_NOT_FOUND', message: MESSAGES.notFound });
		if (stored.size <= 0) return refuse({ code: 'EMPTY_FILE', message: MESSAGES.empty });
		if (stored.size > MAX_VIDEO_BYTES) return refuse({ code: 'SIZE_MISMATCH', message: MESSAGES.tooLarge });

		const head = await store.readStart(pendingKey, VIDEO_SNIFF_BYTES);
		const detected = await detectMediaType(head);
		if (!detected || !ALLOWED_VIDEO_MIME_TYPES.has(detected)) {
			return refuse({ code: 'UNSUPPORTED_MEDIA_TYPE', message: MESSAGES.notVideo });
		}

		const location = await refuseVideoWithLocation(store, pendingKey, detected);
		if (!location.ok) return refuse(location.error);

		const publicKey = `${pending.uuid}${MIME_TO_EXT[detected]}`;
		await store.copy(pendingKey, publicKey, detected);
		await store.delete(pendingKey);

		return ok({ url: store.publicUrl(publicKey), uploadId: signVideoUploadId(artistId, publicKey), contentType: detected });
	} catch (error) {
		console.error('[video-upload] finalize failed', error);
		return refuse({ code: 'STORAGE_FAILED', message: MESSAGES.storage });
	}
}

/* ------------------------------------------------------------------------- */
/* Upload ids                                                                 */
/* ------------------------------------------------------------------------- */

function uploadIdSignature(payload: string): string {
	return crypto
		.createHmac('sha256', getConfig().core.cookieSecret)
		.update(`video-upload-id\u0000${payload}`)
		.digest('base64url');
}

/** `<payload>.<signature>`: the Artist, the public key and when it was finalized, signed. */
export function signVideoUploadId(artistId: string, publicKey: string, now: Date = new Date()): string {
	const payload = Buffer.from(
		JSON.stringify({ a: artistId, k: publicKey, t: Math.floor(now.getTime() / 1000) })
	).toString('base64url');
	return `${payload}.${uploadIdSignature(payload)}`;
}

/**
 * The public key a finalized upload id names, when it was signed by this server
 * for this Artist within VIDEO_UPLOAD_ID_MAX_AGE_SECONDS; otherwise null.
 * For the Quick Issue and Bookbinder forms (B1-T22).
 */
export function verifyVideoUploadId(uploadId: string, artistId: string, now: Date = new Date()): string | null {
	const [payload, signature, extra] = uploadId.split('.');
	if (!payload || !signature || extra !== undefined) return null;
	const expected = Buffer.from(uploadIdSignature(payload));
	const given = Buffer.from(signature);
	if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
	try {
		const { a, k, t } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
		if (a !== artistId || typeof k !== 'string' || typeof t !== 'number') return null;
		const age = Math.floor(now.getTime() / 1000) - t;
		return age >= 0 && age <= VIDEO_UPLOAD_ID_MAX_AGE_SECONDS ? k : null;
	} catch {
		return null;
	}
}

/* ------------------------------------------------------------------------- */
/* The local stand-in's PUT endpoint                                          */
/* ------------------------------------------------------------------------- */

export type LocalPutOutcome = { status: 201 } | { status: 400 | 403 | 404 | 413 | 415; error: DomainError };

/**
 * Step 2 without R2: writes a PUT from a local "presigned" URL into
 * static/uploads. Only where the local stand-in runs (never in production or on
 * Netlify, where it answers 404, as if the route were absent). The URL's signed
 * grant fixes the key, type, exact size and expiry; the request must match it.
 */
export async function acceptLocalVideoPut(request: {
	key: string;
	searchParams: URLSearchParams;
	contentType: string | null;
	contentLength: string | null;
	body: ReadableStream<Uint8Array> | null;
}): Promise<LocalPutOutcome> {
	if (!usesLocalUploadStandIn()) {
		return { status: 404, error: { code: 'NOT_FOUND', message: 'Not found' } };
	}
	if (!parsePendingVideoKey(request.key)) {
		return { status: 400, error: { code: 'INVALID_UPLOAD_KEY', message: MESSAGES.badKey } };
	}
	const grant = verifyLocalPutGrant(request.key, request.searchParams);
	if (!grant) {
		return { status: 403, error: { code: 'FORBIDDEN_UPLOAD_KEY', message: 'This upload link is invalid or has expired.' } };
	}
	if (request.contentType !== grant.contentType) {
		return { status: 415, error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'The upload type does not match the upload link.' } };
	}
	if (Number(request.contentLength) !== grant.size || !request.body) {
		return { status: 400, error: { code: 'SIZE_MISMATCH', message: 'The upload size does not match the upload link.' } };
	}

	const file = localPathFor(request.key);
	await fs.mkdir(path.dirname(file), { recursive: true });
	const handle = await fs.open(file, 'w');
	let written = 0;
	let tooLong = false;
	try {
		const reader = request.body.getReader();
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			written += value.byteLength;
			if (written > grant.size) {
				tooLong = true;
				await reader.cancel();
				break;
			}
			await handle.write(value);
		}
	} finally {
		await handle.close();
	}
	if (tooLong || written !== grant.size) {
		await fs.rm(file, { force: true });
		return {
			status: tooLong ? 413 : 400,
			error: { code: 'SIZE_MISMATCH', message: 'The upload size does not match the upload link.' }
		};
	}
	return { status: 201 };
}
