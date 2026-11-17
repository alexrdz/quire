import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const layer = (name: string) => readFileSync(
	fileURLToPath(new URL(`../../src/lib/styles/layers/${name}.css`, import.meta.url)), 'utf8'
);
const css = `${layer('base')}\n${layer('layouts')}`;
const widths = [280, 320, 390, 560, 768, 859, 860, 861, 1023, 1024, 1025, 1240, 1600];

// this stylesheet fixture verifies the real tokens/primitives, not application workflows.
test('type, spacing, and gutters interpolate continuously and stop at their endpoints', async ({ page }) => {
	await page.setContent(`
		<style>${css}</style>
		<main data-container>
			<section data-stack="gap:md"><p>Fluid body text</p><p>Second paragraph</p></section>
		</main>
	`);
	for (const width of widths) {
		await page.setViewportSize({ width, height: 900 });
		const values = await page.locator('main').evaluate((element) => {
			const stack = element.querySelector('section')!;
			const body = getComputedStyle(document.body);
			return {
				font: parseFloat(body.fontSize),
				gutter: parseFloat(getComputedStyle(element).paddingInlineStart),
				gap: parseFloat(getComputedStyle(stack).gap),
				overflow: document.documentElement.scrollWidth > innerWidth
			};
		});
		const progress = Math.max(0, Math.min(1, (width - 320) / 920));
		expect(values.font, `body at ${width}`).toBeCloseTo(16 + 2 * progress, 2);
		expect(values.gap, `gap at ${width}`).toBeCloseTo(24 + 3 * progress, 2);
		expect(values.gutter, `gutter at ${width}`).toBeCloseTo(16 + 20 * progress, 2);
		expect(values.overflow, `overflow at ${width}`).toBe(false);
	}
});

test('compact space steps actually grow, and aliases resolve in the browser', async ({ page }) => {
	await page.setContent(`
		<style>${css}</style>
		<main data-stack="gap:4xs">
			<div data-box="padding:compact">Compact box</div>
			<div data-cluster="gap:2xs"><span>One</span><span>Two</span></div>
		</main>
	`);
	const values = [];
	for (const width of [320, 780, 1240]) {
		await page.setViewportSize({ width, height: 900 });
		values.push(await page.locator('main').evaluate((element) => ({
			gap: parseFloat(getComputedStyle(element).gap),
			padding: parseFloat(getComputedStyle(element.querySelector('[data-box]')!).paddingInlineStart),
			cluster: parseFloat(getComputedStyle(element.querySelector('[data-cluster]')!).gap)
		})));
	}
	for (const key of ['gap', 'padding', 'cluster'] as const) {
		expect(values[0][key]).toBeLessThan(values[1][key]);
		expect(values[1][key]).toBeLessThan(values[2][key]);
	}
});

test('larger default font preferences and 200% text sizing retain readable, reflowing content', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 900 });
	for (const rootSize of [16, 20, 32]) {
		await page.setContent(`
			<style>${css}\nhtml { font-size: ${rootSize}px; }</style>
			<main data-container><section data-stack="gap:sm">
				<p>Body text must wrap naturally without being clipped when text is enlarged.</p>
				<p>A second paragraph preserves the vertical rhythm.</p>
			</section></main>
		`);
		const values = await page.locator('p').first().evaluate((element) => ({
			font: parseFloat(getComputedStyle(element).fontSize),
			overflow: document.documentElement.scrollWidth > innerWidth,
			height: element.getBoundingClientRect().height
		}));
		expect(values.font).toBeGreaterThanOrEqual(rootSize);
		expect(values.overflow).toBe(false);
		expect(values.height).toBeGreaterThan(values.font);
	}
});
