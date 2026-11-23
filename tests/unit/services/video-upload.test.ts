import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import {
	CopyObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';
import type { Config } from '$lib/server/config';
import { TINY_MP3, TINY_PNG, tinyWebmVideo } from '../helpers/media';

/**
 * ADR 0010 (B1-T21): direct-to-storage video uploads. Presign refuses before any
 * URL exists; finalize verifies the stored bytes and deletes the pending file on
 * every refusal. R2 is exercised with the S3 client mocked; the local stand-in
 * runs for real against static/uploads.
 */
const state = vi.hoisted(() => ({ override: null as null | ((base: Config) => Config) }));

vi.mock('$lib/server/config', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/config')>();
	return {
		...actual,
		getConfig: () => {
			const base = actual.getConfig();
			return state.override ? state.override(base) : base;
		}
	};
});

const { db, schema } = await import('$lib/server/db');
const { seedDatabase } = await import('$lib/server/seed');
const { RATE_LIMITS, resetRateLimitsForTests } = await import('$lib/server/services/rate-limit');
const { MAX_VIDEO_BYTES } = await import('$lib/server/services/storage');
const { r2UploadOrigin } = await import('$lib/server/http/security-headers');
const {
	VIDEO_SNIFF_BYTES,
	VIDEO_UPLOAD_ID_MAX_AGE_SECONDS,
	finalizeVideoUpload,
	presignVideoUpload,
	signVideoUploadId,
	verifyVideoUploadId
} = await import('$lib/server/services/video-upload');
const localPut = await import('../../../src/routes/api/uploads/local/[...key]/+server');
const presignRoute = await import('../../../src/routes/api/uploads/video/presign/+server');

const ACCOUNT = '0123456789abcdef0123456789abcdef';
const R2 = {
	accountId: ACCOUNT,
	accessKeyId: 'test-access-key-id',
	secretAccessKey: 'test-secret-access-key',
	bucketName: 'quire-media',
	publicUrl: 'https://media.quire.test'
};

/** R2 configured, so uploads are on and go to the (mocked) bucket. */
const withR2 = (base: Config): Config => ({
	...base,
	integrations: { ...base.integrations, r2: R2 },
	features: { ...base.features, uploads: true },
	live: { ...base.live, uploads: true }
});

/** Production without R2: uploads off, no local stand-in. */
const productionWithoutR2 = (base: Config): Config => ({
	...base,
	mode: 'production',
	isDeployed: true,
	localUploads: 'none',
	integrations: { ...base.integrations, r2: null },
	features: { ...base.features, uploads: false },
	live: { ...base.live, uploads: false }
});

const createdUserIds: string[] = [];
const uploadsDir = path.resolve(process.cwd(), 'static/uploads');
const localFiles: string[] = [];

beforeAll(async () => {
	await seedDatabase();
});

beforeEach(async () => {
	await resetRateLimitsForTests();
});

afterEach(async () => {
	state.override = null;
	vi.restoreAllMocks();
	while (createdUserIds.length > 0) {
		await db.delete(schema.users).where(eq(schema.users.id, createdUserIds.pop()!));
	}
	while (localFiles.length > 0) {
		await fs.rm(path.join(uploadsDir, localFiles.pop()!), { force: true, recursive: true });
	}
});

async function createArtist({ emailVerified = true, closed = false } = {}) {
	const userId = crypto.randomUUID();
	const artistId = crypto.randomUUID();
	const suffix = crypto.randomBytes(4).toString('hex');
	const now = new Date();
	createdUserIds.push(userId);
	await db.insert(schema.users).values({
		id: userId,
		name: `Video Band ${suffix}`,
		email: `video-${suffix}@example.com`,
		emailVerified,
		accountType: 'artist',
		createdAt: now,
		updatedAt: now
	});
	await db.insert(schema.artists).values({
		id: artistId,
		userId,
		slug: `video-band-${suffix}`,
		displayName: `Video Band ${suffix}`,
		...(closed ? { accountStatus: 'closed' as const } : {}),
		createdAt: now,
		updatedAt: now
	});
	return { user: { id: userId, emailVerified }, artistId };
}

/** A mocked bucket: HEAD, ranged GET, copy and delete against an in-memory map. */
function mockBucket(objects: Record<string, Buffer>, options: { failCopy?: boolean } = {}) {
	const calls: Array<{ op: string; input: Record<string, unknown> }> = [];
	vi.spyOn(S3Client.prototype, 'send').mockImplementation(async (command: unknown) => {
		const input = (command as { input: Record<string, unknown> }).input;
		const key = String(input.Key);
		if (command instanceof HeadObjectCommand) {
			calls.push({ op: 'head', input });
			const body = objects[key];
			if (!body) throw Object.assign(new Error('NotFound'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } });
			return { ContentLength: body.byteLength, ContentType: 'video/mp4' };
		}
		if (command instanceof GetObjectCommand) {
			calls.push({ op: 'get', input });
			const [, end] = /bytes=0-(\d+)/.exec(String(input.Range))!;
			const bytes = objects[key]!.subarray(0, Number(end) + 1);
			return { Body: { transformToByteArray: async () => new Uint8Array(bytes) } };
		}
		if (command instanceof CopyObjectCommand) {
			calls.push({ op: 'copy', input });
			if (options.failCopy) throw new Error('R2 copy failed');
			const source = String(input.CopySource).replace(`${R2.bucketName}/`, '');
			objects[key] = objects[source]!;
			return {};
		}
		if (command instanceof DeleteObjectCommand) {
			calls.push({ op: 'delete', input });
			delete objects[key];
			return {};
		}
		throw new Error(`Unexpected S3 command ${String(command)}`);
	});
	return calls;
}

const pendingKeyFor = (artistId: string, ext = 'webm') => `pending/${artistId}/${crypto.randomUUID()}.${ext}`;

describe('presign refusals', () => {
	it('refuses when uploads are off, and hands out no URL', async () => {
		state.override = productionWithoutR2;
		const { user } = await createArtist();
		const result = await presignVideoUpload(user, { contentType: 'video/mp4', size: 1000 });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('UPLOADS_UNAVAILABLE');
	});

	it('refuses a signed-out request and a user without an active Artist', async () => {
		state.override = withR2;
		const signedOut = await presignVideoUpload(null, { contentType: 'video/mp4', size: 1000 });
		expect(!signedOut.ok && signedOut.error.code).toBe('UNAUTHORIZED');

		const { user } = await createArtist({ closed: true });
		const closed = await presignVideoUpload(user, { contentType: 'video/mp4', size: 1000 });
		expect(!closed.ok && closed.error.code).toBe('ARTIST_REQUIRED');
	});

	it('refuses an unconfirmed email (decision 31)', async () => {
		state.override = withR2;
		const { user } = await createArtist({ emailVerified: false });
		const result = await presignVideoUpload(user, { contentType: 'video/mp4', size: 1000 });
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe('EMAIL_NOT_CONFIRMED');
			expect(result.error.message).toMatch(/Confirm your email to upload/);
		}
	});

	it('refuses more than 50 MB', async () => {
		state.override = withR2;
		const { user } = await createArtist();
		const result = await presignVideoUpload(user, { contentType: 'video/mp4', size: MAX_VIDEO_BYTES + 1 });
		expect(!result.ok && result.error.code).toBe('FILE_TOO_LARGE');
		const atLimit = await presignVideoUpload(user, { contentType: 'video/mp4', size: MAX_VIDEO_BYTES });
		expect(atLimit.ok).toBe(true);
	});

	it('refuses any type but MP4, WebM and MOV, and a malformed size', async () => {
		state.override = withR2;
		const { user } = await createArtist();
		for (const contentType of ['image/png', 'video/x-msvideo', 'text/html', 'video/mp4; codecs=avc1', '']) {
			const result = await presignVideoUpload(user, { contentType, size: 1000 });
			expect(!result.ok && result.error.code, contentType).toBe('UNSUPPORTED_MEDIA_TYPE');
		}
		for (const size of [0, -1, 1.5, '1000', null]) {
			const result = await presignVideoUpload(user, { contentType: 'video/mp4', size });
			expect(!result.ok && result.error.code, String(size)).toBe('INVALID_REQUEST');
		}
	});

	it('refuses an Artist over the video upload rate limit, per Artist', async () => {
		state.override = withR2;
		const { user } = await createArtist();
		const max = RATE_LIMITS.videoUploadArtist.max;
		for (let i = 0; i < max; i++) {
			expect((await presignVideoUpload(user, { contentType: 'video/webm', size: 1000 })).ok, `upload ${i + 1}`).toBe(true);
		}
		const over = await presignVideoUpload(user, { contentType: 'video/webm', size: 1000 });
		expect(!over.ok && over.error.code).toBe('RATE_LIMITED');

		const other = await createArtist();
		expect((await presignVideoUpload(other.user, { contentType: 'video/webm', size: 1000 })).ok).toBe(true);
	});
});

describe('presign on R2', () => {
	it('signs a 10-minute PUT to the upload origin for this Artist’s pending key, fixing type and size', async () => {
		state.override = withR2;
		const { user, artistId } = await createArtist();
		const result = await presignVideoUpload(user, { contentType: 'video/quicktime', size: 23_000_000 });
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const { uploadUrl, key, method, headers } = result.value;
		expect(method).toBe('PUT');
		expect(headers).toEqual({ 'content-type': 'video/quicktime' });
		expect(key).toMatch(new RegExp(`^pending/${artistId}/[0-9a-f-]{36}\\.mov$`));

		const url = new URL(uploadUrl);
		// The CSP's connect-src allows exactly this origin.
		expect(url.origin).toBe(r2UploadOrigin(ACCOUNT));
		expect(url.pathname).toBe(`/${R2.bucketName}/${key}`);
		expect(url.searchParams.get('X-Amz-Expires')).toBe('600');
		expect(url.searchParams.get('X-Amz-SignedHeaders')?.split(';')).toEqual(['content-length', 'content-type', 'host']);
		// No checksum of an empty body pinned to the URL.
		expect([...url.searchParams.keys()].some((name) => /checksum/i.test(name))).toBe(false);
		// The secret never appears in the URL.
		expect(uploadUrl).not.toContain(R2.secretAccessKey);
	});

	it('the endpoint answers JSON, and refuses a signed-out request with 401', async () => {
		state.override = withR2;
		const event = {
			request: new Request('http://localhost/api/uploads/video/presign', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ contentType: 'video/mp4', size: 1000 })
			}),
			locals: {},
			url: new URL('http://localhost/api/uploads/video/presign')
		};
		const response = await presignRoute.POST(event as never);
		expect(response.status).toBe(401);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({ error: { code: 'UNAUTHORIZED', message: expect.any(String) } });
	});

	it('the endpoint reads only JSON', async () => {
		state.override = withR2;
		const event = {
			request: new Request('http://localhost/api/uploads/video/presign', {
				method: 'POST',
				headers: { 'content-type': 'text/plain' },
				body: JSON.stringify({ contentType: 'video/mp4', size: 1000 })
			}),
			locals: {},
			url: new URL('http://localhost/api/uploads/video/presign')
		};
		const response = await presignRoute.POST(event as never);
		expect(response.status).toBe(400);
		expect((await response.json()).error.code).toBe('INVALID_REQUEST');
	});
});

describe('finalize on R2', () => {
	it('publishes a verified video: copies it to its public key, deletes the pending file, and signs an upload id', async () => {
		state.override = withR2;
		const { user, artistId } = await createArtist();
		const pendingKey = pendingKeyFor(artistId, 'webm');
		const objects = { [pendingKey]: Buffer.from(tinyWebmVideo()) };
		const calls = mockBucket(objects);

		const result = await finalizeVideoUpload(user, { key: pendingKey });
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const uuid = pendingKey.split('/')[2]!.replace('.webm', '');
		expect(result.value.url).toBe(`${R2.publicUrl}/${uuid}.webm`);
		expect(result.value.contentType).toBe('video/webm');
		expect(calls.find((c) => c.op === 'get')?.input.Range).toBe(`bytes=0-${VIDEO_SNIFF_BYTES - 1}`);
		expect(calls.find((c) => c.op === 'copy')?.input).toMatchObject({
			Bucket: R2.bucketName,
			Key: `${uuid}.webm`,
			CopySource: `${R2.bucketName}/${pendingKey}`,
			ContentType: 'video/webm'
		});
		expect(calls.filter((c) => c.op === 'delete').map((c) => c.input.Key)).toEqual([pendingKey]);
		expect(Object.keys(objects)).toEqual([`${uuid}.webm`]);
		expect(verifyVideoUploadId(result.value.uploadId, artistId)).toBe(`${uuid}.webm`);
	});

	it("refuses another Artist's key and deletes that pending file", async () => {
		state.override = withR2;
		const owner = await createArtist();
		const other = await createArtist();
		const pendingKey = pendingKeyFor(owner.artistId);
		const objects = { [pendingKey]: Buffer.from(tinyWebmVideo()) };
		const calls = mockBucket(objects);

		const result = await finalizeVideoUpload(other.user, { key: pendingKey });
		expect(!result.ok && result.error.code).toBe('FORBIDDEN_UPLOAD_KEY');
		expect(calls.map((c) => c.op)).toEqual(['delete']);
		expect(objects).toEqual({});
	});

	it('refuses a stored size over 50 MB, and an empty file, deleting the pending file', async () => {
		state.override = withR2;
		const { user, artistId } = await createArtist();

		const bigKey = pendingKeyFor(artistId, 'mp4');
		const big = { [bigKey]: Buffer.alloc(MAX_VIDEO_BYTES + 1) };
		let calls = mockBucket(big);
		const tooBig = await finalizeVideoUpload(user, { key: bigKey });
		expect(!tooBig.ok && tooBig.error.code).toBe('SIZE_MISMATCH');
		expect(calls.map((c) => c.op)).toEqual(['head', 'delete']);
		expect(big).toEqual({});

		vi.restoreAllMocks();
		const emptyKey = pendingKeyFor(artistId, 'mp4');
		const empty = { [emptyKey]: Buffer.alloc(0) };
		calls = mockBucket(empty);
		const none = await finalizeVideoUpload(user, { key: emptyKey });
		expect(!none.ok && none.error.code).toBe('EMPTY_FILE');
		expect(calls.map((c) => c.op)).toEqual(['head', 'delete']);
	});

	it('refuses bytes that are not a video, whatever the key says, deleting the pending file', async () => {
		state.override = withR2;
		const { user, artistId } = await createArtist();
		for (const [label, bytes] of [
			['png', TINY_PNG],
			['mp3', TINY_MP3],
			['html', new TextEncoder().encode('<!doctype html><script>alert(1)</script>')]
		] as const) {
			vi.restoreAllMocks();
			const pendingKey = pendingKeyFor(artistId, 'mp4');
			const objects = { [pendingKey]: Buffer.from(bytes) };
			const calls = mockBucket(objects);
			const result = await finalizeVideoUpload(user, { key: pendingKey });
			expect(!result.ok && result.error.code, label).toBe('UNSUPPORTED_MEDIA_TYPE');
			expect(calls.map((c) => c.op), label).toEqual(['head', 'get', 'delete']);
			expect(objects, label).toEqual({});
		}
	});

	it('deletes the pending file when the copy fails', async () => {
		state.override = withR2;
		const { user, artistId } = await createArtist();
		const pendingKey = pendingKeyFor(artistId);
		const objects = { [pendingKey]: Buffer.from(tinyWebmVideo()) };
		const calls = mockBucket(objects, { failCopy: true });
		vi.spyOn(console, 'error').mockImplementation(() => undefined);

		const result = await finalizeVideoUpload(user, { key: pendingKey });
		expect(!result.ok && result.error.code).toBe('STORAGE_FAILED');
		expect(calls.map((c) => c.op)).toEqual(['head', 'get', 'copy', 'delete']);
		expect(objects).toEqual({});
	});

	it('never deletes a key that is not a pending video key', async () => {
		state.override = withR2;
		const { user, artistId } = await createArtist();
		for (const key of ['photo.webp', `${crypto.randomUUID()}.mp4`, `pending/${artistId}/../x.mp4`, `pending/${artistId}/a.mp4`]) {
			vi.restoreAllMocks();
			const calls = mockBucket({});
			const result = await finalizeVideoUpload(user, { key });
			expect(!result.ok && result.error.code, key).toBe('INVALID_UPLOAD_KEY');
			expect(calls, key).toEqual([]);
		}
	});

	it('answers not found, without deleting, when nothing was uploaded', async () => {
		state.override = withR2;
		const { user, artistId } = await createArtist();
		const calls = mockBucket({});
		const result = await finalizeVideoUpload(user, { key: pendingKeyFor(artistId) });
		expect(!result.ok && result.error.code).toBe('UPLOAD_NOT_FOUND');
		expect(calls.map((c) => c.op)).toEqual(['head']);
	});

	it('refuses a caller who fails the gates without touching storage', async () => {
		state.override = withR2;
		const owner = await createArtist({ emailVerified: false });
		const calls = mockBucket({ [pendingKeyFor(owner.artistId)]: Buffer.from(tinyWebmVideo()) });
		const result = await finalizeVideoUpload(owner.user, { key: pendingKeyFor(owner.artistId) });
		expect(!result.ok && result.error.code).toBe('EMAIL_NOT_CONFIRMED');
		expect((await finalizeVideoUpload(null, { key: 'x' })).ok).toBe(false);
		expect(calls).toEqual([]);
	});
});

describe('upload ids', () => {
	it('verify only for the same Artist, unaltered, within a day', () => {
		const artistId = crypto.randomUUID();
		const now = new Date('2026-11-23T12:00:00Z');
		const id = signVideoUploadId(artistId, 'abc.mp4', now);
		expect(verifyVideoUploadId(id, artistId, now)).toBe('abc.mp4');
		expect(verifyVideoUploadId(id, crypto.randomUUID(), now)).toBeNull();
		const later = new Date(now.getTime() + (VIDEO_UPLOAD_ID_MAX_AGE_SECONDS + 1) * 1000);
		expect(verifyVideoUploadId(id, artistId, later)).toBeNull();

		const [payload, signature] = id.split('.');
		const forged = Buffer.from(JSON.stringify({ a: artistId, k: 'other.mp4', t: Math.floor(now.getTime() / 1000) })).toString(
			'base64url'
		);
		expect(verifyVideoUploadId(`${forged}.${signature}`, artistId, now)).toBeNull();
		expect(verifyVideoUploadId(`${payload}.x${signature!.slice(1)}`, artistId, now)).toBeNull();
		expect(verifyVideoUploadId('', artistId, now)).toBeNull();
		expect(verifyVideoUploadId(`${id}.extra`, artistId, now)).toBeNull();
	});
});

describe('the local stand-in (development, test, a local Demo)', () => {
	function put(uploadUrl: string, body: Uint8Array, headers: Record<string, string>) {
		const url = new URL(uploadUrl, 'http://localhost:5173');
		const key = decodeURIComponent(url.pathname.replace('/api/uploads/local/', ''));
		const request = new Request(url, { method: 'PUT', headers, body: body.slice().buffer as ArrayBuffer });
		return localPut.PUT({ params: { key }, url, request } as never);
	}

	it('runs the same presign, PUT, finalize flow against static/uploads', async () => {
		const { user, artistId } = await createArtist();
		const bytes = tinyWebmVideo();
		const presigned = await presignVideoUpload(user, { contentType: 'video/webm', size: bytes.byteLength });
		expect(presigned.ok).toBe(true);
		if (!presigned.ok) return;
		localFiles.push(`pending/${artistId}`);
		expect(presigned.value.uploadUrl).toMatch(new RegExp(`^/api/uploads/local/pending/${artistId}/[0-9a-f-]{36}\\.webm\\?`));

		const response = await put(presigned.value.uploadUrl, bytes, {
			'content-type': 'video/webm',
			'content-length': String(bytes.byteLength)
		});
		expect(response.status).toBe(201);

		const finalized = await finalizeVideoUpload(user, { key: presigned.value.key });
		expect(finalized.ok).toBe(true);
		if (!finalized.ok) return;
		const publicName = finalized.value.url.replace('/uploads/', '');
		localFiles.push(publicName);
		expect(finalized.value.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.webm$/);
		expect(new Uint8Array(await fs.readFile(path.join(uploadsDir, publicName)))).toEqual(bytes);
		await expect(fs.stat(path.join(uploadsDir, presigned.value.key))).rejects.toThrow();
		expect(verifyVideoUploadId(finalized.value.uploadId, artistId)).toBe(publicName);
	});

	it('refuses a PUT that does not match its signed link', async () => {
		const { user, artistId } = await createArtist();
		localFiles.push(`pending/${artistId}`);
		const bytes = tinyWebmVideo();
		const presigned = await presignVideoUpload(user, { contentType: 'video/webm', size: bytes.byteLength });
		if (!presigned.ok) throw new Error('presign failed');
		const good = { 'content-type': 'video/webm', 'content-length': String(bytes.byteLength) };

		// Another type than the link signed.
		expect((await put(presigned.value.uploadUrl, bytes, { ...good, 'content-type': 'video/mp4' })).status).toBe(415);
		// More bytes than the link signed.
		const longer = new Uint8Array(bytes.byteLength + 10);
		expect((await put(presigned.value.uploadUrl, longer, { ...good, 'content-length': String(longer.byteLength) })).status).toBe(400);
		// A tampered size, key or signature.
		const tampered = presigned.value.uploadUrl.replace(`size=${bytes.byteLength}`, `size=${bytes.byteLength + 10}`);
		expect((await put(tampered, longer, { ...good, 'content-length': String(longer.byteLength) })).status).toBe(403);
		const otherKey = presigned.value.uploadUrl.replace(/[0-9a-f-]{36}\.webm/, crypto.randomUUID() + '.webm');
		expect((await put(otherKey, bytes, good)).status).toBe(403);
		const badSig = presigned.value.uploadUrl.replace(/sig=[^&]+/, 'sig=AAAA');
		expect((await put(badSig, bytes, good)).status).toBe(403);
		// Not a pending video key at all.
		expect((await put('/api/uploads/local/evil.html?sig=x', bytes, good)).status).toBe(400);

		// Nothing was written.
		await expect(fs.stat(path.join(uploadsDir, presigned.value.key))).rejects.toThrow();
	});

	it('refuses an expired link', async () => {
		const { user, artistId } = await createArtist();
		localFiles.push(`pending/${artistId}`);
		const bytes = tinyWebmVideo();
		const presigned = await presignVideoUpload(user, { contentType: 'video/webm', size: bytes.byteLength });
		if (!presigned.ok) throw new Error('presign failed');
		vi.useFakeTimers({ now: Date.now() + 11 * 60 * 1000, toFake: ['Date'] });
		try {
			const response = await put(presigned.value.uploadUrl, bytes, {
				'content-type': 'video/webm',
				'content-length': String(bytes.byteLength)
			});
			expect(response.status).toBe(403);
		} finally {
			vi.useRealTimers();
		}
	});

	it('is unreachable in production: the PUT answers 404 and writes nothing', async () => {
		const { user, artistId } = await createArtist();
		localFiles.push(`pending/${artistId}`);
		const bytes = tinyWebmVideo();
		const presigned = await presignVideoUpload(user, { contentType: 'video/webm', size: bytes.byteLength });
		if (!presigned.ok) throw new Error('presign failed');

		for (const override of [
			productionWithoutR2,
			// Even if a production deploy somehow had localUploads set, the mode forbids the stand-in.
			(base: Config): Config => ({ ...productionWithoutR2(base), localUploads: 'local' }),
			// And with R2 configured anywhere, uploads go to R2, never to local disk.
			withR2
		]) {
			state.override = override;
			const response = await put(presigned.value.uploadUrl, bytes, {
				'content-type': 'video/webm',
				'content-length': String(bytes.byteLength)
			});
			expect(response.status).toBe(404);
		}
		await expect(fs.stat(path.join(uploadsDir, presigned.value.key))).rejects.toThrow();
	});
});
