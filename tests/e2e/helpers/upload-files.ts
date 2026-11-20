import fs from 'node:fs';
import path from 'node:path';
import type { FieldValue } from './actions';

/**
 * Upload fixtures for the e2e upload checks (PRODUCTION_PLAN 1.4 and Phase 5).
 * The same cases as tests/unit/services/upload-hardening.test.ts, sent through
 * the real form actions instead of the storage service.
 */
type FileField = Exclude<FieldValue, string>;

/** A valid 1x1 PNG. */
export const TINY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
	'base64'
);

export const APPENDED_SCRIPT = '<script>alert(document.cookie)</script>';

export interface UploadCase {
	label: string;
	file: FileField;
	/** The message test mode answers with (production answers the uploads-off message for all). */
	testModeMessage: RegExp;
}

export const MALICIOUS_IMAGE_UPLOADS: UploadCase[] = [
	{
		label: 'SVG with a script',
		file: {
			name: 'logo.svg',
			mimeType: 'image/svg+xml',
			buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
		},
		testModeMessage: /This file type is not supported/
	},
	{
		label: 'SVG named photo.png',
		file: {
			name: 'photo.png',
			mimeType: 'image/png',
			buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>')
		},
		testModeMessage: /This file type is not supported/
	},
	{
		label: 'GIF/JS polyglot',
		file: {
			name: 'cat.gif',
			mimeType: 'image/gif',
			buffer: Buffer.from('GIF89a/*\x01\x00\x01\x00\x00\x00\x00*/=1;alert(document.domain)//', 'latin1')
		},
		testModeMessage: /This file type is not supported|This image could not be read/
	},
	{
		label: 'PNG signature followed by HTML',
		file: {
			name: 'photo.png',
			mimeType: 'image/png',
			buffer: Buffer.concat([
				Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
				Buffer.from('<html><script>alert(1)</script></html>')
			])
		},
		testModeMessage: /This file type is not supported|This image could not be read/
	},
	{
		label: 'HTML labelled image/png (wrong MIME)',
		file: {
			name: 'x.png',
			mimeType: 'image/png',
			buffer: Buffer.from('<!doctype html><script>alert(document.cookie)</script>')
		},
		testModeMessage: /This file type is not supported/
	},
	{
		label: 'oversize PNG (over 10 MB)',
		file: {
			name: 'huge.png',
			mimeType: 'image/png',
			buffer: Buffer.concat([TINY_PNG, Buffer.alloc(10 * 1024 * 1024 + 1)])
		},
		testModeMessage: /exceeds the 10MB maximum/
	}
];

/** An audio upload that is really text (wrong MIME for the audio field). */
export const FAKE_AUDIO: UploadCase = {
	label: 'text labelled audio/mpeg',
	file: { name: 'song.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('this is not audio at all') },
	testModeMessage: /This file type is not supported|not a supported audio format/
};

/** Where the test-mode server writes local uploads (it runs from the repository root). */
export const LOCAL_UPLOADS_DIR = path.resolve(process.cwd(), 'static/uploads');

/** The files in the local uploads folder, so a spec can check a refused upload wrote nothing. */
export function localUploadFiles(): Set<string> {
	try {
		return new Set(fs.readdirSync(LOCAL_UPLOADS_DIR).filter((f) => f !== '.gitkeep'));
	} catch {
		return new Set();
	}
}
