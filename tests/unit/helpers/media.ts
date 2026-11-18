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
