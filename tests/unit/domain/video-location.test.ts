import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	findVideoLocations,
	isLocationKey,
	readBoxHeader,
	stripVideoLocations,
	VideoStructureError,
	webmHasLocationTag,
	webmTagsOffsets,
	type VideoLocationKind
} from '$domain/video-location';

/**
 * B1-T23: every location form is found and blanked in place; sizes and offsets never
 * change; a file without a location passes through untouched. The fixtures were made
 * with ffmpeg and exiftool (tests/fixtures/video/README.md).
 */

const DIR = path.resolve('tests/fixtures/video');
const load = (name: string) => new Uint8Array(readFileSync(path.join(DIR, name)));

/** Top-level boxes: type, offset and size. */
function topLevel(bytes: Uint8Array) {
	const boxes: Array<{ type: string; offset: number; size: number }> = [];
	for (let at = 0; at < bytes.length; ) {
		const h = readBoxHeader(bytes, at, bytes.length)!;
		boxes.push({ type: h.type, offset: at, size: h.size });
		at += h.size;
	}
	return boxes;
}

/** Every chunk offset in every stco/co64 box: they point into mdat and must not move. */
function chunkOffsets(bytes: Uint8Array): number[] {
	const offsets: number[] = [];
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	for (let i = 4; i + 12 < bytes.length; i++) {
		const type = String.fromCharCode(bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]);
		if (type !== 'stco' && type !== 'co64') continue;
		const count = view.getUint32(i + 8);
		for (let n = 0; n < count; n++) {
			offsets.push(type === 'stco' ? view.getUint32(i + 12 + n * 4) : Number(view.getBigUint64(i + 12 + n * 8)));
		}
	}
	return offsets;
}

const FIXTURES: Array<[string, VideoLocationKind[], string]> = [
	['xyz-faststart.mov', ['xyz'], 'QuickTime ©xyz in moov/udta, moov before mdat'],
	['xyz-moov-at-end.mov', ['xyz'], 'QuickTime ©xyz in moov/udta, moov after mdat'],
	['ilst-xyz.mp4', ['xyz'], 'iTunes ©xyz item in moov/udta/meta/ilst'],
	['keys-moov-meta.mov', ['keys'], 'Apple keys in moov/meta (the iPhone layout)'],
	['keys-udta-loci-faststart.mp4', ['keys', 'keys', 'loci'], 'keys ISO6709 + location in moov/udta/meta, and loci'],
	['keys-udta-moov-at-end.mov', ['keys'], 'keys ISO6709 in moov/udta/meta, moov after mdat'],
	['xmp-gps.mp4', ['xmp'], 'XMP GPS in a top-level uuid box']
];

describe('MP4 and MOV location stripping', () => {
	it.each(FIXTURES)('%s: finds and blanks every location (%s)', (name, kinds) => {
		const original = load(name);
		const found = findVideoLocations(original);
		expect(found.map((f) => f.kind).sort()).toEqual([...kinds].sort());

		const { bytes: stripped, removed } = stripVideoLocations(original);
		expect(removed).toEqual(found);
		// Same length, same top-level boxes at the same offsets, same chunk offsets into mdat.
		expect(stripped.length).toBe(original.length);
		const removedAt = new Set(removed.map((b) => b.offset));
		expect(topLevel(stripped).map(({ offset, size }) => [offset, size])).toEqual(
			topLevel(original).map(({ offset, size }) => [offset, size])
		);
		expect(topLevel(stripped).filter((b) => !removedAt.has(b.offset))).toEqual(
			topLevel(original).filter((b) => !removedAt.has(b.offset))
		);
		expect(chunkOffsets(stripped)).toEqual(chunkOffsets(original));
		expect(chunkOffsets(original).length).toBeGreaterThan(0);

		// Only the bytes of the location boxes changed (each kept its size field).
		const inside = (i: number) => removed.some((b) => i >= b.offset + 4 && i < b.offset + b.size);
		for (let i = 0; i < original.length; i++) {
			if (!inside(i) && stripped[i] !== original[i]) throw new Error(`byte ${i} changed outside a location box`);
		}
		for (const box of removed) {
			const type = String.fromCharCode(...stripped.subarray(box.offset + 4, box.offset + 8));
			expect(type).toBe('free');
			expect(stripped.subarray(box.offset + box.headerSize, box.offset + box.size).every((b) => b === 0)).toBe(true);
		}

		// Nothing is left, and the stripped file has no coordinates in it anywhere.
		expect(findVideoLocations(stripped)).toEqual([]);
		const text = Buffer.from(stripped).toString('latin1');
		expect(text).not.toMatch(/\+40\.71|40\.7128|GPSLatitude/);
	});

	it('a file with no location passes through byte-identical, as the same array', () => {
		const clean = load('clean.mp4');
		const copy = clean.slice();
		const result = stripVideoLocations(clean);
		expect(result.removed).toEqual([]);
		expect(result.bytes).toBe(clean);
		expect(Buffer.from(result.bytes).equals(Buffer.from(copy))).toBe(true);
	});

	it('scans a moov read on its own, reporting file offsets (moov after mdat)', () => {
		const file = load('xyz-moov-at-end.mov');
		const moov = topLevel(file).find((b) => b.type === 'moov')!;
		expect(moov.offset).toBeGreaterThan(topLevel(file).find((b) => b.type === 'mdat')!.offset);
		const alone = findVideoLocations(file.subarray(moov.offset, moov.offset + moov.size), moov.offset);
		expect(alone).toEqual(findVideoLocations(file));
	});

	it('handles 64-bit box sizes', () => {
		// A 64-bit-size udta holding a 20-byte ©xyz (2-byte text length, 2-byte language, 8 bytes of text).
		const xyz = new Uint8Array([0, 0, 0, 20, 0xa9, 0x78, 0x79, 0x7a, 0, 8, 0x15, 0xc7, ...Buffer.from('+40.7-74')]);
		expect(xyz.length).toBe(20);
		const udta = new Uint8Array(16 + xyz.length);
		udta.set([0, 0, 0, 1, ...Buffer.from('udta'), 0, 0, 0, 0, 0, 0, 0, udta.length]);
		udta.set(xyz, 16);
		const found = findVideoLocations(udta);
		expect(found).toEqual([{ kind: 'xyz', offset: 16, size: 20, headerSize: 8, path: 'udta/©xyz' }]);
		expect(findVideoLocations(stripVideoLocations(udta).bytes)).toEqual([]);
	});

	it('refuses a structure it cannot read, rather than passing it', () => {
		const file = load('xyz-faststart.mov');
		const truncated = file.slice(0, 200);
		expect(() => findVideoLocations(truncated)).toThrow(VideoStructureError);
		const bad = file.slice();
		bad.set([0, 0, 0, 4], 0); // a box smaller than its header
		expect(() => findVideoLocations(bad)).toThrow(VideoStructureError);
	});

	it('refuses a compressed movie header (cmov), which it cannot check', () => {
		const cmov = new Uint8Array([0, 0, 0, 24, ...Buffer.from('moov'), 0, 0, 0, 16, ...Buffer.from('cmov'), 1, 2, 3, 4, 5, 6, 7, 8]);
		expect(() => findVideoLocations(cmov)).toThrow(VideoStructureError);
	});

	it('knows which metadata keys are locations', () => {
		for (const key of [
			'com.apple.quicktime.location.ISO6709',
			'com.apple.quicktime.location.accuracy.horizontal',
			'location',
			'com.example.gps',
			'org.example.location'
		]) {
			expect(isLocationKey(key), key).toBe(true);
		}
		for (const key of ['com.apple.quicktime.make', 'com.apple.quicktime.creationdate', 'title']) {
			expect(isLocationKey(key), key).toBe(false);
		}
	});
});

describe('WebM location tags', () => {
	it('finds a LOCATION tag, and none in a plain recording', () => {
		expect(webmHasLocationTag(load('tagged-location.webm'))).toBe(true);
		expect(webmHasLocationTag(new Uint8Array(readFileSync(path.resolve('tests/e2e/fixtures/portrait-clip.webm'))))).toBe(false);
	});

	it("finds the Tags element through the SeekHead, wherever it sits", () => {
		const file = load('tagged-location.webm');
		const offsets = webmTagsOffsets(file.subarray(0, 4096));
		expect(offsets).toHaveLength(1);
		const at = offsets[0];
		expect([...file.subarray(at, at + 4)]).toEqual([0x12, 0x54, 0xc3, 0x67]);
		expect(webmHasLocationTag(file.subarray(at))).toBe(true);
	});
});
