import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import { auditSources, cssDeclarations, readSources, tokenFile } from '../../../scripts/check-fluid-sizing';
import Stack from '../../../src/lib/components/layout/Stack.svelte';
import Cluster from '../../../src/lib/components/layout/Cluster.svelte';
import Box from '../../../src/lib/components/layout/Box.svelte';

const tokens = {
	path: tokenFile,
	content: ':root { --step-0: clamp(1rem, 0.956522rem + 0.217391vw, 1.125rem); --space-s: var(--step-0); }'
};
const fixture = (content: string) => ({ path: 'src/example.svelte', content: `<style>${content}</style>` });

describe('fluid sizing audit', () => {
	it('accepts shared aliases, zero, auto, and unitless line heights', () => {
		expect(auditSources([tokens, fixture('.a { --gap: var(--space-s); font-size: var(--step-0); gap: var(--gap); margin: 0 auto; line-height: 1.5; }')])).toEqual([]);
	});

	it.each([
		'.a { font-size: 1rem; }',
		'.a { padding: 0 12px; }',
		'.a { margin-inline: 2%; }',
		'.a { gap: var(--space-s, 1rem); }',
		'.a { font: 700 1rem/1.5 sans-serif; }',
		'.a { font: caption; }',
		'.a { font-size: large; }',
		'.a { --bypass: 1rem; font-size: var(--bypass); }',
		'.a { --bypass: 1rem; --alias: var(--bypass); gap: var(--alias); }',
		'.a { gap: var(--missing); }',
		'.a { --a: var(--b); --b: var(--a); gap: var(--a); }',
		'.a { font-size: clamp(1rem, 1rem + 1vw, 2rem); }',
		'@media (min-width: 40rem) { .a { font-size: var(--step-0); } }',
		'@container card (inline-size > 30rem) { .a { --gap: var(--space-s); gap: var(--gap); } }'
	])('rejects sizing escape: %s', (css) => {
		expect(auditSources([tokens, fixture(css)]).length).toBeGreaterThan(0);
	});

	it('retains structural and print queries', () => {
		expect(auditSources([tokens, fixture(`
			@media (min-width: 40rem) { .a { display: none; } }
			@media print { .a { font-size: var(--step-0); } }
		`)])).toEqual([]);
	});

	it('rejects fake constant clamps', () => {
		expect(auditSources([{ path: tokenFile, content: ':root { --space-s: clamp(1rem, 1rem + 0vw, 1rem); }' }])).not.toEqual([]);
	});

	it.each([
		'<p style="font-size: 12px">text</p>',
		'<p style:padding="1rem">text</p>',
		'<p style:font-size={size}>text</p>'
	])('rejects inline sizing: %s', (content) => {
		expect(auditSources([{ path: 'src/example.svelte', content }]).length).toBeGreaterThan(0);
	});

	it('keeps runtime playback and color styles outside the spacing contract', () => {
		expect(auditSources([{ path: 'src/example.svelte', content: '<div style:color={color} style:inline-size={`${progress}%`}></div>' }])).toEqual([]);
	});

	it('passes the complete browser source inventory', () => {
		expect(auditSources(readSources())).toEqual([]);
	});
});

describe('utopia scale', () => {
	const declarations = cssDeclarations(readSources().find((s) => s.path === tokenFile)!);
	const root = new Map(declarations.filter((d) => d.selector === ':root').map((d) => [d.property, d.value]));

	it('uses the configured 320–1240 interpolation endpoints for every type and space clamp', () => {
		for (const [name, value] of root) {
			if (!/^--(?:step-|text-|space-)/.test(name) || !value.startsWith('clamp(')) continue;
			const match = value.match(/^clamp\(([\d.]+)rem, ([\d.-]+)rem \+ ([\d.]+)vw, ([\d.]+)rem\)$/)!;
			expect(match, name).not.toBeNull();
			const [, lo, intercept, slope, hi] = match.map(Number);
			expect(lo, name).toBeLessThan(hi);
			expect(intercept * 16 + slope * 3.2, name).toBeCloseTo(lo * 16, 3);
			expect(intercept * 16 + slope * 12.4, name).toBeCloseTo(hi * 16, 3);
		}
	});

	it('keeps all canonical aliases defined and acyclic', () => {
		function resolve(name: string, chain: string[] = []): string {
			expect(chain, name).not.toContain(name);
			const value = root.get(name);
			expect(value, name).toBeDefined();
			const ref = value!.match(/^var\((--[\w-]+)\)$/);
			return ref ? resolve(ref[1], [...chain, name]) : value!;
		}
		for (const name of root.keys()) {
			if (/^--(?:text-|space-|page-padding-|layout-container-padding-)/.test(name)) {
				expect(resolve(name), name).toMatch(/^clamp\(/);
			}
		}
	});

	it.each(['4xs', '3xs', 'compact', '2xs'] as const)('exposes compact %s spacing through primitives', (size) => {
		expect(render(Box, { props: { padding: size } }).html).toContain(`padding:${size}`);
		expect(render(Stack, { props: { gap: size } }).html).toContain(`gap:${size}`);
		expect(render(Cluster, { props: { gap: size } }).html).toContain(`gap:${size}`);
	});
});
