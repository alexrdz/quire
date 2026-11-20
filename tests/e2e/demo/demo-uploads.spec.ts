import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { latestPhotoUrlForCity, previewDatabasePath } from '../helpers/db';

/**
 * P4L-T06: a local Demo (this e2e server: no Netlify variables, no R2 keys) keeps
 * the local static/uploads stand-in. On Netlify the same Demo turns uploads off
 * (unit tests: tests/unit/server/demo-site.test.ts).
 */

const TINY_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);

test('a local Demo stores uploads in static/uploads', async ({ page }) => {
	const city = `Demo Uploadville ${Date.now()}`;
	await page.goto('/demo');
	await expect(page).toHaveURL(/\/dashboard/);
	await page.goto('/dashboard/issues/quick');
	const input = page.locator('input[name="photoFile"]');
	await expect(input).toBeEnabled();
	await expect(page.locator('[data-feature="uploads"]')).toHaveCount(0);

	await page.locator('input[name="city"]').fill(city);
	await page.locator('input[name="venue"]').fill('The Demo Room');
	await page.locator('input[name="date"]').fill('2026-11-21');
	await input.setInputFiles({ name: 'stage.png', mimeType: 'image/png', buffer: TINY_PNG });
	await page.locator('button[name="saveMode"][value="published"]').click();

	const demoDb = `file:${previewDatabasePath('demo')}`;
	await expect.poll(() => latestPhotoUrlForCity(city, demoDb), { timeout: 10000 }).toMatch(/^\/uploads\/.+\.webp$/);
	// The server wrote it to static/uploads. (`vite preview` serves the built
	// static folder, so a runtime upload is checked on disk, not over HTTP.)
	const url = (await latestPhotoUrlForCity(city, demoDb))!;
	const file = path.resolve('static', url.slice(1));
	try {
		expect(fs.existsSync(file), file).toBe(true);
	} finally {
		fs.rmSync(file, { force: true });
	}
});
