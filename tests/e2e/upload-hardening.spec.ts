import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { postAction, type FieldValue } from './helpers/actions';
import { issueCountForCity, latestPhotoUrlForCity } from './helpers/db';
import {
	APPENDED_SCRIPT,
	FAKE_AUDIO,
	LOCAL_UPLOADS_DIR,
	MALICIOUS_IMAGE_UPLOADS,
	TINY_PNG,
	localUploadFiles
} from './helpers/upload-files';

/**
 * Malicious uploads through the real form actions (PRODUCTION_PLAN 1.4 and
 * Phase 5), in test mode, where uploads are on and use local storage. The
 * production-mode server has uploads off, so this is where the validator
 * itself is checked end to end: SVG, polyglots, wrong MIME and oversize files
 * are refused with their message and write nothing.
 */

// Unique per run, so no cleanup write is needed (local.db is rebuilt on a fresh gate anyway).
const RUN = Date.now().toString(36);
const REFUSED_CITY = `Refusalville ${RUN}`;
const ACCEPTED_CITY = `Reencodeville ${RUN}`;

function quickIssueFields(city: string, file: FieldValue) {
	return { city, venue: 'The Validator', date: '2026-11-20', timezone: 'America/New_York', saveMode: 'published', photoFile: file };
}

test('every malicious image is refused with its message and writes nothing', async ({ page, baseURL }) => {
	await page.goto('/demo');
	await expect(page).toHaveURL(/\/dashboard/);
	const filesBefore = localUploadFiles();

	for (const upload of MALICIOUS_IMAGE_UPLOADS) {
		const result = await postAction(page.request, baseURL!, '/dashboard/issues/quick', quickIssueFields(REFUSED_CITY, upload.file));
		expect(result.httpStatus, upload.label).toBeLessThan(500);
		expect(result, upload.label).toMatchObject({ type: 'failure', status: 400 });
		expect(result.data, upload.label).toMatch(upload.testModeMessage);
	}
	expect(await issueCountForCity(REFUSED_CITY)).toBe(0);
	expect(localUploadFiles()).toEqual(filesBefore);
});

test('text sent as audio is refused and writes nothing', async ({ page, baseURL }) => {
	await page.goto('/demo');
	const filesBefore = localUploadFiles();
	const result = await postAction(page.request, baseURL!, '/dashboard/template?/addTemplatePage', {
		kind: 'audio',
		title: 'Fake audio',
		audioFile: FAKE_AUDIO.file
	});
	expect(result, FAKE_AUDIO.label).toMatchObject({ type: 'failure', status: 400 });
	expect(result.data).toMatch(FAKE_AUDIO.testModeMessage);
	expect(localUploadFiles()).toEqual(filesBefore);
});

test('a real PNG with an appended script is stored re-encoded as WebP, without the script', async ({ page, baseURL }) => {
	await page.goto('/demo');
	const result = await postAction(
		page.request,
		baseURL!,
		'/dashboard/issues/quick',
		quickIssueFields(ACCEPTED_CITY, {
			name: 'x.html',
			mimeType: 'text/html',
			buffer: Buffer.concat([TINY_PNG, Buffer.from(APPENDED_SCRIPT)])
		})
	);
	expect(result.httpStatus).toBeLessThan(500);
	expect(['redirect', 'success']).toContain(result.type);

	const url = await latestPhotoUrlForCity(ACCEPTED_CITY);
	expect(url).toMatch(/^\/uploads\/[A-Za-z0-9-]+\.webp$/);
	const stored = path.join(LOCAL_UPLOADS_DIR, path.basename(url!));
	try {
		const bytes = fs.readFileSync(stored);
		expect(bytes.subarray(0, 4).toString('latin1')).toBe('RIFF');
		expect(bytes.subarray(8, 12).toString('latin1')).toBe('WEBP');
		expect(bytes.includes(Buffer.from(APPENDED_SCRIPT))).toBe(false);
	} finally {
		fs.rmSync(stored, { force: true });
	}
});
