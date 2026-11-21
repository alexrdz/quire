import fs from 'node:fs';
import path from 'node:path';

/**
 * Real media bytes for upload tests. Uploads detect the type from the bytes,
 * so a file header alone is no longer enough (PRODUCTION_PLAN.md 1.4).
 */
const fixture = (name: string) => fs.readFileSync(path.resolve('tests/fixtures', name));

export const TINY_PNG = new Uint8Array(fixture('tiny.png'));
export const TINY_JPEG = new Uint8Array(fixture('tiny.jpg'));
export const TINY_MP3 = new Uint8Array(fixture('tiny.mp3'));

export function tinyWebmVideo(): Uint8Array {
	const el = (id: number[], body: Buffer) =>
		Buffer.concat([Buffer.from(id), Buffer.from([0x80 | body.length]), body]);
	const docType = el([0x42, 0x82], Buffer.from('webm'));
	const header = el([0x1a, 0x45, 0xdf, 0xa3], docType);
	const entries = [1, 2].map((type, i) =>
		el([0xae], Buffer.concat([el([0xd7], Buffer.from([i + 1])), el([0x83], Buffer.from([type]))]))
	);
	const tracks = el([0x16, 0x54, 0xae, 0x6b], Buffer.concat(entries));
	const segment = Buffer.concat([
		Buffer.from([0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]),
		tracks
	]);
	return new Uint8Array(Buffer.concat([header, segment, Buffer.alloc(64)]));
}
