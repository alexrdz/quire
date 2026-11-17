import { test, expect } from '@playwright/test';
import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

let javascript: string;
let stylesheet: string;

test.beforeAll(async () => {
	const root = fileURLToPath(new URL('../..', import.meta.url));
	const entry = '\0quire-fluid-preview';
	// mount the actual frontend component; no server, api fixtures, or runtime stubs.
	const output = await build({
		root,
		configFile: false,
		logLevel: 'error',
		resolve: { alias: { $lib: `${root}/src/lib` } },
		plugins: [{
			name: 'fluid-component-preview',
			resolveId: (id) => id === 'virtual:fluid-preview' ? entry : undefined,
			load: (id) => id === entry ? `
				import { mount } from 'svelte';
				import Page from '${root}/src/routes/(site)/+page.svelte';
				import '${root}/src/app.css';
				mount(Page, { target: document.body });
			` : undefined
		}, svelte()],
		build: {
			write: false,
			minify: false,
			cssCodeSplit: false,
			rollupOptions: {
				input: 'virtual:fluid-preview',
				output: { format: 'iife', name: 'FluidPreview', inlineDynamicImports: true }
			}
		}
	});
	const result = Array.isArray(output) ? output[0] : output;
	if (!('output' in result)) throw new Error('expected an in-memory preview bundle');
	javascript = result.output.filter((item) => item.type === 'chunk').map((item) => item.code).join('\n');
	stylesheet = result.output.flatMap((item) =>
		item.type === 'asset' && item.fileName.endsWith('.css') ? [item.source] : []).join('\n');
});

test.beforeEach(async ({ page }) => {
	await page.route('https://images.unsplash.com/**', (route) => route.abort());
	await page.setContent('<!doctype html><html lang="en"><head></head><body></body></html>');
	await page.addStyleTag({ content: stylesheet });
	await page.addScriptTag({ content: javascript });
	await expect(page.locator('h1')).toBeVisible();
});

test('real landing and simulator remain usable at narrow, intermediate, and wide widths', async ({ page }) => {
	for (const width of [320, 390, 768, 859, 860, 861, 1023, 1024, 1025, 1240, 1600]) {
		await page.setViewportSize({ width, height: 1000 });
		expect(await page.locator('.phone-frame').evaluate((el) => el.scrollWidth <= el.clientWidth),
			`phone overflow at ${width}`).toBe(true);
		for (const tab of ['Photo', 'Notes', 'Wall', 'Track']) {
			await page.getByRole('button', { name: tab, exact: true }).click();
			await expect(page.locator('.card-page')).toBeVisible();
			expect(await page.locator('.card-page').evaluate((el) => el.scrollWidth <= el.clientWidth),
				`${tab} overflow at ${width}`).toBe(true);
		}
		await page.getByRole('button', { name: '1-Tap Tip', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Support The Neon Velvet' })).toBeVisible();
		await page.getByRole('button', { name: 'Close', exact: true }).click();
	}
});

test('enlarged landing text reflows without clipping core content', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 1000 });
	await page.addStyleTag({ content: 'html { font-size: 200%; }' });
	await expect(page.locator('h1')).toBeVisible();
	expect(await page.locator('.hero-headline').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
	const bounds = await page.locator('.card-headline').evaluate((el) => {
		const card = el.closest('.card-page')!.getBoundingClientRect();
		const text = el.getBoundingClientRect();
		return { top: text.top >= card.top, bottom: text.bottom <= card.bottom };
	});
	expect(bounds).toEqual({ top: true, bottom: true });
	await page.getByRole('button', { name: 'Notes', exact: true }).click();
	await expect(page.locator('.notes-scrollable-area')).toBeVisible();
	expect(await page.locator('.notes-scrollable-area').evaluate((el) =>
		el.clientHeight > 0 && el.scrollWidth <= el.clientWidth)).toBe(true);
});
