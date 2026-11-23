import { test, expect, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { issueForCity } from './helpers/db';
import { LOCAL_UPLOADS_DIR } from './helpers/upload-files';

/**
 * B1-T22 (ADR 0010): the recorder uploads a clip straight to storage, here the local
 * stand-in, with progress, then finalizes it. The form sends only the finalized upload
 * id. Test mode stores uploads in static/uploads, so the stored file can be compared
 * byte for byte. The built preview serves only what static/ held at build time, so the
 * reader's playback itself is checked by hand.
 */

const RUN = Date.now().toString(36);
const CLIP = path.resolve('tests/e2e/fixtures/portrait-clip.webm');
const LOCAL_PUT = '**/api/uploads/local/**';

// A fake camera and microphone, so the recorder can record in headless Chromium.
test.use({
	launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
	permissions: ['camera', 'microphone']
});

async function openQuickIssue(page: Page, city: string) {
	await page.goto('/demo');
	await expect(page).toHaveURL(/\/dashboard/);
	await page.goto('/dashboard/issues/quick');
	await page.getByLabel('City *').fill(city);
	await page.getByLabel('Venue or Busking Spot *').fill('The Camera Roll');
	await page.getByLabel('Gig Date *').fill('2026-11-23');
	return page.locator('.video-recorder-root');
}

async function pickClip(page: Page) {
	const recorder = page.locator('.video-recorder-root');
	await recorder.getByRole('button', { name: 'Upload Video File' }).click();
	const picker = recorder.getByLabel('Choose Video File (MP4, WebM, MOV)');
	// A picker, not a second camera: on phones it opens the camera roll.
	await expect(picker).not.toHaveAttribute('capture');
	await picker.setInputFiles(CLIP);
}

/** Publishes and returns the video src the reader shows. */
async function publishAndRead(page: Page, city: string): Promise<string> {
	await page.getByRole('button', { name: /publish/i }).first().click();
	await expect.poll(async () => (await issueForCity(city))?.slug ?? null, { timeout: 10000 }).not.toBeNull();
	await page.goto(`/i/${(await issueForCity(city))!.slug}`);
	const video = page.locator('.video-screen video');
	await expect(video).toHaveCount(1);
	return (await video.getAttribute('src'))!;
}

test('a picked clip uploads straight to storage, and the Issue shows it', async ({ page }) => {
	const city = `Pickerton ${RUN}`;
	const recorder = await openQuickIssue(page, city);
	const multipart: string[] = [];
	page.on('request', (req) => {
		if (req.method() === 'POST' && req.url().includes('/dashboard/issues/quick') && (req.postData() ?? '').includes('portrait-clip')) {
			multipart.push(req.url());
		}
	});

	await pickClip(page);
	await expect(recorder.getByText('Video Uploaded')).toBeVisible();
	await expect(recorder.getByText('Vertical (9:16)')).toBeVisible();
	await expect(recorder.locator('input[name="videoOrientation"]')).toHaveValue('portrait');
	// The form carries the finalized upload id and no file.
	await expect(recorder.locator('input[name="videoUploadId"]')).toHaveValue(/^[\w-]+\.[\w-]+$/);
	await expect(page.locator('form input[type="file"][name="videoFile"]')).toHaveCount(0);

	const src = await publishAndRead(page, city);
	expect(src).toMatch(/^\/uploads\/[0-9a-f-]{36}\.webm$/);
	await expect(page.locator('.video-screen .video-frame')).toHaveClass(/video-frame-portrait/);
	expect(readFileSync(path.join(LOCAL_UPLOADS_DIR, path.basename(src))).equals(readFileSync(CLIP))).toBe(true);
	expect(multipart, 'the clip never goes through the form action').toEqual([]);
});

test('a recorded clip uploads straight to storage, preferring MP4/H.264, and the Issue shows it', async ({ page }) => {
	const city = `Recordton ${RUN}`;
	const recorder = await openQuickIssue(page, city);
	const prefersMp4 = await page.evaluate(() => MediaRecorder.isTypeSupported('video/mp4;codecs=avc1'));

	await recorder.getByRole('button', { name: 'Open Camera' }).click();
	await recorder.getByRole('button', { name: /Record \(60s max\)/ }).click();
	await page.waitForTimeout(1500);
	await recorder.getByRole('button', { name: 'Stop Recording' }).click();
	await expect(recorder.getByText('Video Uploaded')).toBeVisible();

	const src = await publishAndRead(page, city);
	expect(src).toMatch(new RegExp(`^/uploads/[0-9a-f-]{36}\\.${prefersMp4 ? 'mp4' : 'webm'}$`));
	expect(readFileSync(path.join(LOCAL_UPLOADS_DIR, path.basename(src))).length).toBeGreaterThan(1000);
});

test('Publish waits while a clip uploads, and a failed upload shows Retry', async ({ page }) => {
	const city = `Retryton ${RUN}`;
	const recorder = await openQuickIssue(page, city);
	const publish = page.getByRole('button', { name: /Publish Issue/ });

	// Hold the first PUT, then fail it.
	let release!: () => void;
	const held = new Promise<void>((resolve) => (release = resolve));
	let puts = 0;
	await page.route(LOCAL_PUT, async (route: Route) => {
		puts += 1;
		if (puts === 1) {
			await held;
			await route.fulfill({ status: 500, body: '' });
		} else {
			await route.continue();
		}
	});

	await pickClip(page);
	await expect(recorder.getByText(/Uploading video… \d+%/)).toBeVisible();
	await expect(recorder.getByRole('progressbar')).toBeVisible();
	await expect(recorder.getByRole('button', { name: 'Cancel Upload' })).toBeVisible();
	await expect(publish).toBeDisabled();
	await expect(publish).toHaveAccessibleDescription('Wait for the video to finish uploading.');
	await expect(recorder.locator('input[name="videoUploadId"]')).toHaveCount(0);

	release();
	await expect(recorder.getByRole('alert')).toHaveText("The upload didn't finish. Check your connection and try again.");
	await expect(publish).toBeDisabled();
	await expect(publish).toHaveAccessibleDescription(/didn't upload\. Retry it/);
	await expect(recorder.locator('input[name="videoUploadId"]')).toHaveCount(0);

	await recorder.getByRole('button', { name: 'Retry Upload' }).click();
	await expect(recorder.getByText('Video Uploaded')).toBeVisible();
	await expect(publish).toBeEnabled();
	expect(puts).toBe(2);

	const src = await publishAndRead(page, city);
	expect(src).toMatch(/^\/uploads\/[0-9a-f-]{36}\.webm$/);
});

test('Bookbinder: a picked clip becomes a video page, and the page edits and saves', async ({ page }) => {
	await page.goto('/demo');
	await expect(page).toHaveURL(/\/dashboard/);
	await page.goto('/dashboard');
	const href = await page.locator('a[href^="/dashboard/bookbinder/"]').first().getAttribute('href');
	await page.goto(href!);

	const title = `Picked ${RUN}`;
	await page.locator('#new-kind').selectOption('video');
	const addForm = page.locator('form[action="?/addPage"]');
	await addForm.locator('input[name="title"]').fill(title);
	await addForm.getByRole('button', { name: 'Upload Video File' }).click();
	await addForm.getByLabel('Choose Video File (MP4, WebM, MOV)').setInputFiles(CLIP);
	await expect(addForm.getByText('Video Uploaded')).toBeVisible();
	const added = page.waitForResponse((r) => r.url().includes('?/addPage') && r.request().method() === 'POST');
	await addForm.getByRole('button', { name: '+ Append Page to Zine' }).click();
	expect(await (await added).text()).toContain('"type":"success"');
	await page.reload();

	// The new page's edit form shows its video in the recorder and saves as is.
	// Svelte sets the title as a property, not an attribute, so find the form by the input's value.
	const forms = page.locator('form[action="?/updatePage"]');
	const index = await forms.evaluateAll(
		(all, wanted) => all.findIndex((f) => (f.querySelector('input[name="title"]') as HTMLInputElement | null)?.value === wanted),
		title
	);
	expect(index).toBeGreaterThanOrEqual(0);
	const pageForm = forms.nth(index);
	await expect(pageForm.locator('.video-recorder-root')).toBeVisible();
	const videoUrl = await pageForm.locator('input[name="videoUrl"]').inputValue();
	expect(videoUrl).toMatch(/^\/uploads\/[0-9a-f-]{36}\.webm$/);
	expect(readFileSync(path.join(LOCAL_UPLOADS_DIR, path.basename(videoUrl))).equals(readFileSync(CLIP))).toBe(true);
	const save = pageForm.getByRole('button', { name: 'Save Page Block' });
	await expect(save).toBeEnabled();
	const saved = page.waitForResponse((r) => r.url().includes('?/updatePage') && r.request().method() === 'POST');
	await save.click();
	expect(await (await saved).text()).toContain('"type":"success"');
});
