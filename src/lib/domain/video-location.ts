/**
 * Video location privacy (decision 27, ADR 0010): no video in Quire carries a location.
 *
 * Pure functions over bytes, shared by the browser (which strips a camera-roll clip
 * before uploading it) and the server (which refuses any upload that still has one).
 *
 * MP4 and MOV are ISO base media files: a sequence of boxes ("atoms"), each with a
 * 4-byte size, a 4-byte type and, for 64-bit sizes, an 8-byte size after the type.
 * A location can live in:
 *
 * - `©xyz`: QuickTime user data (`moov/udta/©xyz`) or an iTunes item (`.../ilst/©xyz`).
 * - `loci`: the 3GPP location box in `udta`.
 * - Apple metadata keys: `meta/keys` names the items in `meta/ilst` by index; any item
 *   whose key is a location key (`com.apple.quicktime.location.ISO6709` and friends,
 *   or plain `location`) holds a location. iPhones put this `meta` straight in `moov`;
 *   ffmpeg puts it in `moov/udta`.
 * - XMP: a `uuid` box with the XMP UUID whose packet has GPS fields, often top-level.
 *
 * Stripping never moves a byte: each location box is retyped to `free` (which every
 * reader skips) and its payload is zero-filled. Box sizes, the `stco`/`co64` chunk
 * offsets into `mdat`, and everything else stay exactly as they were, so the file
 * still plays.
 */

/** What the Artist sees when a clip still has a location (browser and server alike). */
export const VIDEO_HAS_LOCATION_MESSAGE =
	"This video still has location data, so we didn't post it. Record it here instead, or turn off location for this clip and try again.";

/** What the Artist sees when a clip's structure can't be read, so it can't be checked. */
export const UNREADABLE_VIDEO_MESSAGE = "We couldn't read this video. Record it here instead, or choose another clip.";

export type VideoLocationKind = 'xyz' | 'loci' | 'keys' | 'xmp';

export interface VideoLocationBox {
	kind: VideoLocationKind;
	/** Absolute offset of the box in the file (the scanned buffer's offset plus `baseOffset`). */
	offset: number;
	/** The whole box, header included. */
	size: number;
	/** Header length: 8, or 16 for a 64-bit size. */
	headerSize: number;
	/** Where it was found, e.g. `moov/udta/meta/ilst/#1 com.apple.quicktime.location.ISO6709`. */
	path: string;
}

export interface BoxHeader {
	type: string;
	/** The whole box, header included. For a size-0 box ("to the end") this is `endOfParent - offset`. */
	size: number;
	headerSize: number;
}

/** Thrown when the bytes are not a well-formed box structure, so the file can't be checked. */
export class VideoStructureError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'VideoStructureError';
	}
}

const XMP_UUID = [0xbe, 0x7a, 0xcf, 0xcb, 0x97, 0xa9, 0x42, 0xe8, 0x9c, 0x71, 0x99, 0x94, 0x91, 0xe3, 0xaf, 0xac];
const FREE = [0x66, 0x72, 0x65, 0x65]; // 'free'

/** Boxes that hold other boxes and may hold a location somewhere inside. */
const CONTAINERS = new Set(['moov', 'trak', 'udta', 'meta']);

function fourCC(bytes: Uint8Array, at: number): string {
	return String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
}

function uint32(bytes: Uint8Array, at: number): number {
	return ((bytes[at] << 24) >>> 0) + (bytes[at + 1] << 16) + (bytes[at + 2] << 8) + bytes[at + 3];
}

function latin1(bytes: Uint8Array, start: number, end: number): string {
	let out = '';
	for (let i = start; i < end; i++) out += String.fromCharCode(bytes[i]);
	return out;
}

/**
 * The box header at `at`, given at least 8 bytes there (16 for a 64-bit size).
 * `end` is the end of the parent (or of the file) for size-0 boxes and bounds checks.
 * Null when fewer than 8 bytes remain. Throws VideoStructureError on a size that
 * can't be right (smaller than its header, or past the parent's end).
 */
export function readBoxHeader(bytes: Uint8Array, at: number, end: number): BoxHeader | null {
	if (end - at < 8 || bytes.length - at < 8) return null;
	let size = uint32(bytes, at);
	const type = fourCC(bytes, at + 4);
	let headerSize = 8;
	if (size === 1) {
		if (bytes.length - at < 16) throw new VideoStructureError(`Truncated 64-bit size for '${type}'.`);
		const high = uint32(bytes, at + 8);
		const low = uint32(bytes, at + 12);
		size = high * 2 ** 32 + low;
		headerSize = 16;
	} else if (size === 0) {
		size = end - at;
	}
	if (size < headerSize || at + size > end) {
		throw new VideoStructureError(`Box '${type}' at ${at} has an impossible size ${size}.`);
	}
	return { type, size, headerSize };
}

/** Where a `meta` box's children start: QuickTime `meta` has none, ISO `meta` has 4 bytes of version and flags. */
function metaChildrenStart(bytes: Uint8Array, payload: number, end: number): number {
	if (end - payload >= 8 && fourCC(bytes, payload + 4) === 'hdlr') return payload;
	if (end - payload >= 12 && fourCC(bytes, payload + 8) === 'hdlr') return payload + 4;
	// No hdlr first: version/flags are zero in practice for ISO meta.
	return uint32(bytes, payload) === 0 ? payload + 4 : payload;
}

/** Whether a metadata key names a location value. */
export function isLocationKey(key: string): boolean {
	const k = key.toLowerCase();
	return (
		k === 'location' ||
		k.startsWith('com.apple.quicktime.location') ||
		k.endsWith('.location') ||
		k.includes('gps') ||
		k.includes('iso6709')
	);
}

/** The key names of a `keys` box (1-based, as `ilst` items refer to them). */
function readKeys(bytes: Uint8Array, payload: number, end: number): Map<number, string> {
	const names = new Map<number, string>();
	// Full box: 4 bytes version/flags, then the entry count.
	if (end - payload < 8) return names;
	const count = uint32(bytes, payload + 4);
	let at = payload + 8;
	for (let index = 1; index <= count && end - at >= 8; index++) {
		const size = uint32(bytes, at);
		if (size < 8 || at + size > end) break;
		names.set(index, latin1(bytes, at + 8, at + size));
		at += size;
	}
	return names;
}

function isXmpUuid(bytes: Uint8Array, payload: number, end: number): boolean {
	if (end - payload < 16) return false;
	for (let i = 0; i < 16; i++) if (bytes[payload + i] !== XMP_UUID[i]) return false;
	return true;
}

function xmpHasGps(bytes: Uint8Array, start: number, end: number): boolean {
	return /GPS(Latitude|Longitude|Altitude|Coordinates|Position)|LocationCreated|LocationShown/i.test(
		latin1(bytes, start, end)
	);
}

function walk(
	bytes: Uint8Array,
	start: number,
	end: number,
	path: string,
	baseOffset: number,
	found: VideoLocationBox[],
	keys: Map<number, string> | null
): void {
	let at = start;
	while (at < end) {
		const header = readBoxHeader(bytes, at, end);
		if (!header) break;
		const { type, size, headerSize } = header;
		const payload = at + headerSize;
		const boxEnd = at + size;
		const here = path ? `${path}/${type}` : type;
		const hit = (kind: VideoLocationKind, label = here) =>
			found.push({ kind, offset: baseOffset + at, size, headerSize, path: label });

		if (type === 'cmov') {
			// A compressed QuickTime movie header can't be checked without inflating it: refuse it.
			throw new VideoStructureError("Compressed movie headers ('cmov') can't be checked.");
		} else if (type === '©xyz') {
			hit('xyz');
		} else if (type === 'loci') {
			hit('loci');
		} else if (type === 'uuid' && isXmpUuid(bytes, payload, boxEnd)) {
			if (xmpHasGps(bytes, payload + 16, boxEnd)) hit('xmp', `${here} (XMP)`);
		} else if (path.endsWith('/ilst') && keys) {
			// An item named by its 1-based index into the sibling `keys` box.
			const index = uint32(bytes, at + 4);
			const key = keys.get(index);
			if (key && isLocationKey(key)) hit('keys', `${path}/#${index} ${key}`);
		} else if (type === 'meta') {
			const children = metaChildrenStart(bytes, payload, boxEnd);
			// Read `keys` first: it may come after `ilst`.
			let metaKeys: Map<number, string> | null = null;
			for (let child = children; child < boxEnd; ) {
				const h = readBoxHeader(bytes, child, boxEnd);
				if (!h) break;
				if (h.type === 'keys') metaKeys = readKeys(bytes, child + h.headerSize, child + h.size);
				child += h.size;
			}
			walk(bytes, children, boxEnd, here, baseOffset, found, metaKeys);
		} else if (type === 'ilst') {
			walk(bytes, payload, boxEnd, here, baseOffset, found, keys);
		} else if (CONTAINERS.has(type)) {
			walk(bytes, payload, boxEnd, here, baseOffset, found, null);
		}
		at = boxEnd;
	}
}

/**
 * Every location box in `bytes`, which holds whole boxes: a whole file, or one
 * top-level box (such as `moov`) read on its own. `baseOffset` is where `bytes`
 * starts in the file, so the offsets returned are file offsets.
 * Throws VideoStructureError when the boxes don't parse.
 */
export function findVideoLocations(bytes: Uint8Array, baseOffset = 0): VideoLocationBox[] {
	const found: VideoLocationBox[] = [];
	walk(bytes, 0, bytes.length, '', baseOffset, found, null);
	return found;
}

/**
 * A copy of `bytes` with every location box retyped to `free` and zero-filled.
 * Same length, same offsets: only the bytes of the location boxes change. When
 * there is no location, the same array is returned untouched.
 */
export function stripVideoLocations(bytes: Uint8Array, baseOffset = 0): { bytes: Uint8Array; removed: VideoLocationBox[] } {
	const removed = findVideoLocations(bytes, baseOffset);
	if (removed.length === 0) return { bytes, removed };
	const out = bytes.slice();
	for (const box of removed) {
		const at = box.offset - baseOffset;
		out.set(FREE, at + 4);
		out.fill(0, at + box.headerSize, at + box.size);
	}
	return { bytes: out, removed };
}

/** Top-level boxes worth reading in full to check for a location: everything but media data and padding. */
export function mayHoldLocation(type: string): boolean {
	return type !== 'mdat' && type !== 'free' && type !== 'skip' && type !== 'wide' && type !== 'ftyp';
}

/* ------------------------------------------------------------------------- */
/* WebM (Matroska)                                                            */
/* ------------------------------------------------------------------------- */

const EBML_SEGMENT = 0x18538067;
const EBML_SEEKHEAD = 0x114d9b74;
const EBML_SEEK = 0x4dbb;
const EBML_SEEK_ID = 0x53ab;
const EBML_SEEK_POSITION = 0x53ac;
const EBML_TAGS = 0x1254c367;

/** An EBML variable-length integer at `at`: its value and length. Null when malformed or truncated. */
function readVint(bytes: Uint8Array, at: number, keepMarker: boolean): { value: number; length: number } | null {
	const first = bytes[at];
	if (first === undefined || first === 0) return null;
	let length = 1;
	while (length <= 8 && !(first & (0x80 >> (length - 1)))) length++;
	if (length > 8 || at + length > bytes.length) return null;
	let value = keepMarker ? first : first & (0xff >> length);
	for (let i = 1; i < length; i++) value = value * 256 + bytes[at + i];
	return { value, length };
}

/**
 * Whether these WebM bytes hold a Matroska tag naming a location (a `TagName` such as
 * LOCATION, RECORDING_LOCATION or anything with GPS). `bytes` may be any part of the
 * file: tags are found wherever they appear in it.
 */
export function webmHasLocationTag(bytes: Uint8Array): boolean {
	for (let i = 0; i + 3 < bytes.length; i++) {
		// TagName is element 0x45A3.
		if (bytes[i] !== 0x45 || bytes[i + 1] !== 0xa3) continue;
		const size = readVint(bytes, i + 2, false);
		if (!size || size.value > 256) continue;
		const start = i + 2 + size.length;
		if (start + size.value > bytes.length) continue;
		const name = latin1(bytes, start, start + size.value);
		if (/^[\x20-\x7e]+$/.test(name) && /location|gps|iso6709|coordinates/i.test(name)) return true;
	}
	return false;
}

/**
 * File offsets of the Tags elements a WebM's SeekHead points to, read from the start
 * of the file (`head`), so a server can range-read them wherever they sit.
 */
export function webmTagsOffsets(head: Uint8Array): number[] {
	// Find the Segment and its data start.
	for (let i = 0; i + 4 < head.length; i++) {
		if (uint32(head, i) !== EBML_SEGMENT) continue;
		const size = readVint(head, i + 4, false);
		if (!size) return [];
		const segmentData = i + 4 + size.length;
		const offsets: number[] = [];
		// SeekHead is near the start of the Segment's data.
		for (let j = segmentData; j + 4 < head.length && j < segmentData + 4096; j++) {
			if (uint32(head, j) !== EBML_SEEKHEAD) continue;
			const shSize = readVint(head, j + 4, false);
			if (!shSize) return offsets;
			const shEnd = Math.min(head.length, j + 4 + shSize.length + shSize.value);
			let k = j + 4 + shSize.length;
			while (k < shEnd) {
				const id = readVint(head, k, true);
				if (!id) break;
				const len = readVint(head, k + id.length, false);
				if (!len) break;
				const body = k + id.length + len.length;
				if (id.value === EBML_SEEK) {
					let seekId = 0;
					let seekPos = -1;
					let m = body;
					while (m < body + len.value) {
						const cid = readVint(head, m, true);
						if (!cid) break;
						const clen = readVint(head, m + cid.length, false);
						if (!clen) break;
						const cbody = m + cid.length + clen.length;
						let v = 0;
						for (let n = 0; n < clen.value; n++) v = v * 256 + head[cbody + n];
						if (cid.value === EBML_SEEK_ID) seekId = v;
						if (cid.value === EBML_SEEK_POSITION) seekPos = v;
						m = cbody + clen.value;
					}
					if (seekId === EBML_TAGS && seekPos >= 0) offsets.push(segmentData + seekPos);
				}
				k = body + len.value;
			}
			return offsets;
		}
		return offsets;
	}
	return [];
}
