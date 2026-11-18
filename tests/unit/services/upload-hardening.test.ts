import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import {
	ALLOWED_IMAGE_MIME_TYPES,
	MAX_RASTER_EDGE_PX,
	MIME_TO_EXT,
	uploadFormFile,
	uploadMedia
} from '$lib/server/services/storage';

/** PRODUCTION_PLAN.md 1.4: the type comes from the bytes and every image is re-encoded to WebP. */
const uploadedKeys: string[] = [];
const uploadsDir = path.resolve(process.cwd(), 'static/uploads');

afterEach(async () => {
	while (uploadedKeys.length > 0) {
		const key = uploadedKeys.pop()!;
		await fs.unlink(path.join(uploadsDir, key)).catch(() => {});
	}
});

async function readStored(key: string): Promise<Buffer> {
	uploadedKeys.push(key);
	return fs.readFile(path.join(uploadsDir, key));
}

async function tinyPng(): Promise<Buffer> {
	return sharp({ create: { width: 4, height: 4, channels: 3, background: '#05d9e8' } })
		.png()
		.toBuffer();
}

/** True when an EXIF block carries a GPS IFD pointer (tag 0x8825) in either byte order. */
function hasGpsPointer(exif: Buffer | undefined): boolean {
	if (!exif) return false;
	return exif.includes(Buffer.from([0x25, 0x88])) || exif.includes(Buffer.from([0x88, 0x25]));
}

describe('upload type detection', () => {
	it('rejects x.html labelled image/png', async () => {
		const file = new File(['<!doctype html><script>alert(document.cookie)</script>'], 'x.html', {
			type: 'image/png'
		});
		const result = await uploadFormFile(file, { kind: 'image' });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
	});

	it('rejects HTML even when named photo.png', async () => {
		const result = await uploadMedia({
			filename: 'photo.png',
			contentType: 'image/png',
			buffer: Buffer.from('<html><body onload="alert(1)"></body></html>'),
			allowedKind: 'image'
		});
		expect(result.ok).toBe(false);
	});

	it('rejects SVG, whatever it is called', async () => {
		const svg = Buffer.from(
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><circle cx="5" cy="5" r="4"/></svg>'
		);
		for (const [filename, contentType] of [
			['poster.svg', 'image/svg+xml'],
			['poster.png', 'image/png']
		]) {
			const result = await uploadMedia({ filename, contentType, buffer: svg, allowedKind: 'image' });
			expect(result.ok, filename).toBe(false);
			if (!result.ok) expect(result.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
		}
	});

	it('no longer lists SVG anywhere', () => {
		expect(ALLOWED_IMAGE_MIME_TYPES.has('image/svg+xml')).toBe(false);
		expect(Object.keys(MIME_TO_EXT)).not.toContain('image/svg+xml');
		expect(Object.values(MIME_TO_EXT)).not.toContain('.svg');
	});

	it('rejects a GIF/JS polyglot', async () => {
		const polyglot = Buffer.from('GIF89a/*\x01\x00\x01\x00\x00\x00\x00*/=1;alert(document.domain)//', 'latin1');
		const result = await uploadMedia({
			filename: 'cat.gif',
			contentType: 'image/gif',
			buffer: polyglot,
			allowedKind: 'image'
		});
		expect(result.ok).toBe(false);
	});

	it('rejects a PNG signature followed by an HTML payload', async () => {
		const polyglot = Buffer.concat([
			Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
			Buffer.from('<html><script>alert(1)</script></html>')
		]);
		const result = await uploadMedia({ buffer: polyglot, allowedKind: 'image' });
		expect(result.ok).toBe(false);
	});

	it('neutralises a valid PNG carrying an appended script by re-encoding', async () => {
		const payload = '<script>alert(document.cookie)</script>';
		const polyglot = Buffer.concat([await tinyPng(), Buffer.from(payload)]);
		const result = await uploadMedia({
			filename: 'x.html',
			contentType: 'text/html',
			buffer: polyglot,
			allowedKind: 'image'
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.key.endsWith('.webp')).toBe(true);
		const stored = await readStored(result.value.key);
		expect(stored.includes(Buffer.from(payload))).toBe(false);
		expect((await sharp(stored).metadata()).format).toBe('webp');
	});

	it('takes the extension from the bytes, never the filename', async () => {
		const result = await uploadMedia({
			filename: 'evil.html',
			contentType: 'text/html',
			buffer: await tinyPng(),
			allowedKind: 'image'
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		uploadedKeys.push(result.value.key);
		expect(result.value.key).toMatch(/^[0-9a-f-]{36}\.webp$/);
		expect(result.value.url).toBe(`/uploads/${result.value.key}`);
	});
});

describe('image re-encoding', () => {
	it('returns a JPEG with GPS EXIF as WebP with no metadata, capped at 1600px', async () => {
		const fixture = await fs.readFile(path.resolve('tests/fixtures/gps-exif.jpg'));
		const before = await sharp(fixture).metadata();
		expect(before.format).toBe('jpeg');
		expect(hasGpsPointer(before.exif)).toBe(true);
		expect(before.width).toBeGreaterThan(MAX_RASTER_EDGE_PX);

		const file = new File([fixture], 'holiday.jpg', { type: 'image/jpeg' });
		const result = await uploadFormFile(file, { kind: 'image' });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.key.endsWith('.webp')).toBe(true);

		const stored = await readStored(result.value.key);
		const after = await sharp(stored).metadata();
		expect(after.format).toBe('webp');
		expect(after.exif).toBeUndefined();
		expect(after.icc).toBeUndefined();
		expect(after.xmp).toBeUndefined();
		expect(Math.max(after.width ?? 0, after.height ?? 0)).toBe(MAX_RASTER_EDGE_PX);
		expect(stored.includes(Buffer.from('QuireTestCam'))).toBe(false);
	});
});

describe('audio magic bytes', () => {
	function wavHeader(): Buffer {
		const header = Buffer.alloc(44);
		header.write('RIFF', 0);
		header.writeUInt32LE(36, 4);
		header.write('WAVE', 8);
		header.write('fmt ', 12);
		header.writeUInt32LE(16, 16);
		header.writeUInt16LE(1, 20);
		header.writeUInt16LE(1, 22);
		header.writeUInt32LE(8000, 24);
		header.writeUInt32LE(8000, 28);
		header.writeUInt16LE(1, 32);
		header.writeUInt16LE(8, 34);
		header.write('data', 36);
		header.writeUInt32LE(0, 40);
		return Buffer.concat([header, Buffer.alloc(256, 0x80)]);
	}

	it('accepts real WAV bytes and stores them as .wav', async () => {
		const result = await uploadMedia({
			filename: 'take.mp3',
			contentType: 'audio/mpeg',
			buffer: wavHeader(),
			allowedKind: 'audio'
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		uploadedKeys.push(result.value.key);
		expect(result.value.key.endsWith('.wav')).toBe(true);
	});

	it('rejects text labelled audio/mpeg', async () => {
		const file = new File(['<script>alert(1)</script>'], 'song.mp3', { type: 'audio/mpeg' });
		const result = await uploadFormFile(file, { kind: 'audio' });
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
	});

	it('rejects an image uploaded where audio is expected', async () => {
		const result = await uploadMedia({ buffer: await tinyPng(), allowedKind: 'audio' });
		expect(result.ok).toBe(false);
	});
});
