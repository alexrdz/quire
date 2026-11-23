import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { issueForCity } from './helpers/db';
import { LOCAL_UPLOADS_DIR } from './helpers/upload-files';

/**
 * B1-T19: a video chosen through the recorder's "Upload Video File" picker is
 * submitted like a recording. #41 left the picker unnamed, so the form dropped
 * the file and published the Issue without it. Test mode stores uploads
 * locally (static/uploads), so the stored file can be compared byte for byte.
 */

const RUN = Date.now().toString(36);
const CLIP = path.resolve('tests/e2e/fixtures/portrait-clip.webm');

test('a clip chosen through the Quick Issue picker is published as a portrait video page', async ({ page }) => {
	const city = `Pickerton ${RUN}`;
	await page.goto('/demo');
	await expect(page).toHaveURL(/\/dashboard/);
	await page.goto('/dashboard/issues/quick');
	await page.getByLabel('City *').fill(city);
	await page.getByLabel('Venue or Busking Spot *').fill('The Camera Roll');
	await page.getByLabel('Gig Date *').fill('2026-11-23');

	const recorder = page.locator('.video-recorder-root');
	await recorder.getByRole('button', { name: 'Upload Video File' }).click();
	const picker = recorder.getByLabel('Choose Video File (MP4, WebM, MOV)');
	// A picker, not a second camera: on phones it opens the camera roll (the recorder covers the camera).
	await expect(picker).not.toHaveAttribute('capture');
	await picker.setInputFiles(CLIP);

	// The chosen file is on the one input the form sends, and its shape sets the orientation.
	await expect(recorder.getByText('Vertical (9:16)')).toBeVisible();
	const named = recorder.locator('input[type="file"][name="videoFile"]');
	expect(await named.evaluate((el: HTMLInputElement) => el.files?.[0]?.name)).toBe('portrait-clip.webm');
	await expect(recorder.locator('input[name="videoOrientation"]')).toHaveValue('portrait');

	await page.getByRole('button', { name: /publish/i }).first().click();
	await expect.poll(async () => (await issueForCity(city))?.slug ?? null, { timeout: 10000 }).not.toBeNull();
	const slug = (await issueForCity(city))!.slug;

	await page.goto(`/i/${slug}`);
	const video = page.locator('.video-screen video');
	await expect(video).toHaveCount(1);
	const src = await video.getAttribute('src');
	expect(src).toMatch(/^\/uploads\/[0-9a-f-]{36}\.webm$/);
	await expect(page.locator('.video-screen .video-frame')).toHaveClass(/video-frame-portrait/);

	// The stored file is the chosen clip, unchanged. (The built preview serves only what
	// static/ held at build time, so playback itself is checked by hand, not here.)
	const stored = readFileSync(path.join(LOCAL_UPLOADS_DIR, path.basename(src!)));
	expect(stored.equals(readFileSync(CLIP))).toBe(true);
});
