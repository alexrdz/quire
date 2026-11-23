import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findVideoLocations, stripVideoLocations } from '$domain/video-location';
import {
	pickRecordingMimeType,
	prepareVideoForUpload,
	videoContentTypeOf,
	VideoUploadError,
	VIDEO_HAS_LOCATION_MESSAGE
} from '$lib/utils/video-upload-client';

/**
 * B1-T23: the browser blanks a clip's location before presign, reading only the
 * metadata boxes (never mdat), and refuses a WebM that has a location tag.
 */

const DIR = path.resolve('tests/fixtures/video');
const blobOf = (name: string, type: string) =>
	Object.assign(new Blob([readFileSync(path.join(DIR, name))], { type }), { name });
const bytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

const WITH_LOCATION = readdirSync(DIR).filter((n) => /\.(mp4|mov)$/.test(n) && n !== 'clean.mp4');

describe('prepareVideoForUpload', () => {
	it.each(WITH_LOCATION)('%s: uploads without a location, same size, same as stripping the whole file', async (name) => {
		const type = name.endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
		const original = blobOf(name, type);
		const prepared = await prepareVideoForUpload(original, type);
		expect(prepared.size).toBe(original.size);
		const out = await bytes(prepared);
		expect(findVideoLocations(out)).toEqual([]);
		// Box by box gives exactly what stripping the whole file at once gives.
		const whole = stripVideoLocations(await bytes(original)).bytes;
		expect(Buffer.from(out).equals(Buffer.from(whole))).toBe(true);
	});

	it('passes a clip with no location through as the same Blob', async () => {
		const clean = blobOf('clean.mp4', 'video/mp4');
		expect(await prepareVideoForUpload(clean, 'video/mp4')).toBe(clean);
		const recording = Object.assign(new Blob([readFileSync(path.resolve('tests/e2e/fixtures/portrait-clip.webm'))], { type: 'video/webm' }), { name: 'r.webm' });
		expect(await prepareVideoForUpload(recording, 'video/webm')).toBe(recording);
	});

	it('refuses a WebM with a location tag, and says why', async () => {
		const tagged = blobOf('tagged-location.webm', 'video/webm');
		const error = await prepareVideoForUpload(tagged, 'video/webm').catch((e) => e);
		expect(error).toBeInstanceOf(VideoUploadError);
		expect(error).toMatchObject({ code: 'VIDEO_HAS_LOCATION', retryable: false, message: VIDEO_HAS_LOCATION_MESSAGE });
	});

	it('refuses an MP4 whose boxes it cannot read, rather than uploading it unchecked', async () => {
		const junk = Object.assign(new Blob([new Uint8Array([0, 0, 0, 4, 0x66, 0x74, 0x79, 0x70, 1, 2, 3])]), { name: 'x.mp4' });
		const error = await prepareVideoForUpload(junk, 'video/mp4').catch((e) => e);
		expect(error).toMatchObject({ code: 'UNREADABLE_VIDEO', retryable: false });
	});
});

describe('recording format and file types', () => {
	it('prefers MP4 with H.264 (AAC first), then WebM', () => {
		const supports = (list: string[]) => (t: string) => list.includes(t);
		expect(pickRecordingMimeType(supports(['video/webm', 'video/mp4;codecs=avc1,mp4a.40.2']))).toBe('video/mp4;codecs=avc1,mp4a.40.2');
		expect(pickRecordingMimeType(supports(['video/webm;codecs=vp9,opus', 'video/mp4;codecs=avc1']))).toBe('video/mp4;codecs=avc1');
		expect(pickRecordingMimeType(supports(['video/webm;codecs=vp8,opus']))).toBe('video/webm;codecs=vp8,opus');
		expect(pickRecordingMimeType(supports([]))).toBe('');
	});

	it('reads the upload type from the MIME type, or the extension when there is none', () => {
		expect(videoContentTypeOf({ type: 'video/webm;codecs=vp9,opus' })).toBe('video/webm');
		expect(videoContentTypeOf({ type: 'video/x-m4v' })).toBe('video/mp4');
		expect(videoContentTypeOf({ type: '', name: 'IMG_0001.MOV' })).toBe('video/quicktime');
		expect(videoContentTypeOf({ type: 'image/png', name: 'a.mp4' })).toBeNull();
	});
});
