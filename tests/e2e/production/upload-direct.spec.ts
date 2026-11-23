import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { FEATURE_UNAVAILABLE } from '../../../src/lib/features';
import { signInWithPassword } from '../helpers/actions';
import { createProductionArtist, resetProductionRateLimits, type ProductionArtist } from '../helpers/production-db';

/**
 * ADR 0010 (B1-T21) in production mode with no R2 keys: the direct video upload
 * endpoints refuse with the uploads-off message, and the local upload stand-in
 * is unreachable. Its PUT answers 404 and writes nothing to static/uploads, even
 * for a signed-in Artist with a confirmed email.
 */

let artist: ProductionArtist;

test.beforeAll(async () => {
	await resetProductionRateLimits();
	artist = await createProductionArtist({ displayName: 'Direct Upload Band', venmoUsername: null });
});

test('presign and finalize refuse with the uploads-off message', async ({ page }) => {
	await signInWithPassword(page, artist.email, artist.password);

	const presign = await page.request.post('/api/uploads/video/presign', {
		data: { contentType: 'video/mp4', size: 20_000_000 }
	});
	expect(presign.status()).toBe(503);
	expect(await presign.json()).toEqual({ error: { code: 'UPLOADS_UNAVAILABLE', message: FEATURE_UNAVAILABLE.uploads } });

	const finalize = await page.request.post('/api/uploads/video/finalize', {
		data: { key: `pending/${artist.artistId}/${crypto.randomUUID()}.mp4` }
	});
	expect(finalize.status()).toBe(503);
	expect((await finalize.json()).error.code).toBe('UPLOADS_UNAVAILABLE');
});

test('the local upload stand-in is not reachable in production', async ({ page }) => {
	await signInWithPassword(page, artist.email, artist.password);
	const key = `pending/${artist.artistId}/${crypto.randomUUID()}.webm`;
	const body = Buffer.alloc(64, 1);
	const params = new URLSearchParams({ type: 'video/webm', size: String(body.byteLength), expires: '9999999999', sig: 'x' });

	const response = await page.request.put(`/api/uploads/local/${key}?${params}`, {
		headers: { 'content-type': 'video/webm' },
		data: body
	});
	expect(response.status()).toBe(404);
	// The production server runs from the repository, so its stand-in would write here.
	expect(fs.existsSync(path.resolve('static/uploads', key))).toBe(false);
});

test('the CSP allows no upload origin without R2', async ({ request }) => {
	const response = await request.get('/');
	const csp = response.headers()['content-security-policy'] ?? '';
	expect(csp).toMatch(/connect-src 'self';/);
	expect(csp).not.toContain('r2.cloudflarestorage.com');
});
