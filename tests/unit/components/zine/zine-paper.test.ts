import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { MAX_TEXT_TILT, zineTilt } from '$lib/components/zine/reader';

const baseCss = fs.readFileSync(path.resolve('src/lib/styles/layers/base.css'), 'utf8');

function token(name: string): string {
	const match = baseCss.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
	if (!match) throw new Error(`${name} is not a hex token`);
	return match[1];
}

/** WCAG 2 relative luminance and contrast ratio. */
function luminance(hex: string): number {
	const [r, g, b] = [1, 3, 5].map((i) => {
		const c = parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

describe('zineTilt (ADR 0009)', () => {
	it('is deterministic and keeps text within about 2 degrees', () => {
		for (let i = 0; i < 100; i++) {
			expect(zineTilt(i)).toBe(zineTilt(i));
			expect(Math.abs(zineTilt(i))).toBeLessThanOrEqual(MAX_TEXT_TILT);
		}
	});

	it('scales into a given limit and varies from scrap to scrap', () => {
		for (let i = 0; i < 50; i++) expect(Math.abs(zineTilt(i, 1.5))).toBeLessThanOrEqual(1.5);
		expect(new Set(Array.from({ length: 10 }, (_, i) => zineTilt(i))).size).toBeGreaterThan(5);
	});

	it('lies flat when asked for no tilt', () => {
		expect(zineTilt(3, 0)).toBe(0);
		expect(zineTilt(3, -2)).toBe(0);
	});
});

describe('reader paper and ink contrast (WCAG AA)', () => {
	it('typed slips and labels: dark ink on light paper', () => {
		expect(contrast(token('--zine-scrap-light-ink'), token('--zine-scrap-light'))).toBeGreaterThanOrEqual(4.5);
	});

	it('text on dark paper and dark scraps', () => {
		for (const ground of ['--zine-paper-dark', '--zine-scrap-dark']) {
			expect(contrast(token('--paper'), token(ground)), `--paper on ${ground}`).toBeGreaterThanOrEqual(4.5);
			expect(contrast(token('--ink-muted'), token(ground)), `--ink-muted on ${ground}`).toBeGreaterThanOrEqual(4.5);
			expect(contrast(token('--highlight'), token(ground)), `--highlight on ${ground}`).toBeGreaterThanOrEqual(4.5);
		}
	});
});

describe('accent faces (ADR 0009)', () => {
	it('are self-hosted woff2 with font-display swap and their licenses', () => {
		for (const [family, file, license] of [
			['Special Elite', 'special-elite-latin.woff2', 'LICENSE-SpecialElite.txt'],
			['Permanent Marker', 'permanent-marker-latin.woff2', 'LICENSE-PermanentMarker.txt']
		]) {
			const face = baseCss.match(new RegExp(`@font-face\\s*{[^}]*font-family:\\s*'${family}'[^}]*}`));
			expect(face?.[0], family).toContain(`url('/fonts/${file}') format('woff2')`);
			expect(face?.[0], family).toContain('font-display: swap');
			expect(fs.existsSync(path.resolve('static/fonts', file)), file).toBe(true);
			expect(fs.readFileSync(path.resolve('static/fonts', license), 'utf8'), license).toContain('Apache License');
		}
		expect(baseCss).toMatch(/--font-type:\s*'Special Elite'/);
		expect(baseCss).toMatch(/--font-marker:\s*'Permanent Marker'/);
	});
});
