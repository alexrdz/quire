import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'svelte/compiler';

export const tokenFile = 'src/lib/styles/layers/base.css';

export interface Source {
	path: string;
	content: string;
}

interface CssNode {
	type: string;
	start: number;
	end: number;
	property?: string;
	value?: string;
	name?: string;
	prelude?: { start: number; end: number } | string;
	block?: { children: CssNode[] };
}

interface Declaration {
	path: string;
	line: number;
	selector: string;
	property: string;
	value: string;
	sizeQuery: boolean;
}

const spacing = /^(?:(?:scroll-)?(?:margin|padding)(?:-[\w-]+)?|(?:row-|column-)?gap)$/;
const sizing = /^(?:font-size|font|line-height|letter-spacing)$/;
const spatialToken = /^--(?:space-|page-padding-|layout-container-padding-)|^--[\w-]*(?:gap|padding|margin)$/;
const length = /(?:\d|\.)\s*(?:(?:px|r?em|[sld]?v[whib]|cq[whib]|ch|ex|pt|pc|cm|mm|in)\b|%)/i;
const refs = (value: string) => [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]);

// the one negative pixel margin is an accessibility technique, not design spacing.
export const exceptions = [{
	path: 'src/lib/styles/layers/utilities.css',
	selector: '.visually-hidden',
	property: 'margin',
	value: '-1px !important',
	reason: 'preserve the screen-reader-only clipping technique'
}];

export function cssDeclarations(source: Source): Declaration[] {
	const cssOnly = source.path.endsWith('.css');
	const content = cssOnly ? `<style>${source.content}</style>` : source.content.replace(/%sveltekit\.[\w.]+%/g, '');
	const ast = parse(content).css;
	const declarations: Declaration[] = [];
	function walk(nodes: CssNode[], selector = '', sizeQuery = false) {
		for (const node of nodes) {
			if (node.type === 'Rule') {
				const prelude = node.prelude as { start: number; end: number };
				walk(node.block?.children ?? [], content.slice(prelude.start, prelude.end), sizeQuery);
			} else if (node.type === 'Atrule') {
				const query = String(node.prelude);
				const screenSizeQuery = ['media', 'container'].includes(node.name ?? '') &&
					!/\bprint\b/.test(query) && /\b(?:width|height|inline-size|block-size)\b/.test(query);
				walk(node.block?.children ?? [], selector, sizeQuery || screenSizeQuery);
			} else if (node.type === 'Declaration') {
				declarations.push({
					path: source.path,
					line: content.slice(0, node.start).split('\n').length,
					selector,
					property: node.property!,
					value: node.value!,
					sizeQuery
				});
			}
		}
	}
	walk((ast?.children ?? []) as unknown as CssNode[]);
	return declarations;
}

export function auditSources(sources: Source[]): string[] {
	const declarations = sources.flatMap(cssDeclarations);
	const definitions = new Map<string, Declaration[]>();
	const errors = new Set<string>();
	const fail = (d: Declaration, message: string) =>
		errors.add(`${d.path}:${d.line}: ${d.property}: ${message}`);
	for (const d of declarations) {
		if (d.property.startsWith('--')) {
			definitions.set(d.property, [...(definitions.get(d.property) ?? []), d]);
		}
		if (d.value.includes('clamp(') && !(d.path === tokenFile && d.selector === ':root')) {
			fail(d, 'keep clamp formulas in the canonical root token scale');
		}
	}
	const canonical = (d: Declaration) => d.path === tokenFile && d.selector === ':root';
	const isException = (d: Declaration) => exceptions.some((e) =>
		e.path === d.path && e.selector === d.selector && e.property === d.property && e.value === d.value);
	function inspect(d: Declaration, chain: string[] = []) {
		if (isException(d)) return;
		if (d.sizeQuery) fail(d, 'viewport sizing overrides must be replaced by fluid tokens');
		const dependencies = refs(d.value);
		if (canonical(d) && d.property.startsWith('--tracking-') && /^(?:-?[\d.]+em|0)$/.test(d.value)) return;
		if (canonical(d) && d.value.startsWith('clamp(')) {
			const match = d.value.match(/^clamp\(([\d.]+)rem,\s*([\d.-]+)rem\s*\+\s*([\d.]+)vw,\s*([\d.]+)rem\)$/);
			if (!match || Number(match[1]) >= Number(match[4]) || Number(match[3]) <= 0) {
				fail(d, 'fluid type and spacing need increasing rem endpoints and a positive viewport slope');
			}
			return;
		}
		if (length.test(d.value) || d.value.includes('clamp(')) {
			fail(d, 'use shared fluid tokens instead of literal dimensions (including fallbacks)');
		}
		if (d.property === 'font' && !/^(?:inherit|initial|unset|revert(?:-layer)?)$/.test(d.value) && !dependencies.length) {
			fail(d, 'font shorthands must inherit or consume the type scale');
		}
		if (d.property === 'font-size' && !dependencies.length &&
			!/^(?:inherit|initial|unset|revert(?:-layer)?)$/.test(d.value)) {
			fail(d, 'font sizes must resolve to the shared type scale');
		}
		for (const name of dependencies) {
			if (chain.includes(name)) {
				fail(d, `cyclic token reference: ${[...chain, name].join(' -> ')}`);
				continue;
			}
			const targets = definitions.get(name);
			if (!targets) fail(d, `undefined sizing token ${name}`);
			for (const target of targets ?? []) inspect(target, [...chain, name]);
		}
	}
	for (const d of declarations) {
		if (spacing.test(d.property) || sizing.test(d.property) || spatialToken.test(d.property) ||
			/^--(?:step-|text-)/.test(d.property)) inspect(d);
	}
	// parse markup too: static style directives/attributes cannot bypass the css audit.
	for (const source of sources.filter((s) => s.path.endsWith('.svelte') || s.path.endsWith('.html'))) {
		const html = source.path.endsWith('.html') ? source.content.replace(/%sveltekit\.[\w.]+%/g, '') : source.content;
		const ast = parse(html);
		function visit(value: unknown): void {
			if (!value || typeof value !== 'object') return;
			const node = value as Record<string, unknown>;
			if (node.type === 'Attribute' && node.name === 'style' && Array.isArray(node.value)) {
				const chunks = node.value as { type: string; data?: string }[];
				const text = chunks.filter((c) => c.type === 'Text').map((c) => c.data).join('');
				if (/(?:font(?:-size)?|(?:margin|padding)(?:-[\w-]+)?|gap)\s*:/.test(text)) {
					errors.add(`${source.path}: static typography/spacing cannot be set inline`);
				}
			}
			if (node.type === 'StyleDirective' &&
				(spacing.test(String(node.name)) || sizing.test(String(node.name)))) {
				errors.add(`${source.path}: typography/spacing style directives must use stylesheet tokens`);
			}
			for (const [key, child] of Object.entries(node)) {
				if (key === 'css' || key === 'instance' || key === 'module') continue;
				if (Array.isArray(child)) child.forEach(visit);
				else if (child && typeof child === 'object') visit(child);
			}
		}
		visit(ast.html);
	}
	return [...errors];
}

export function readSources(root = resolve(fileURLToPath(new URL('..', import.meta.url)))): Source[] {
	const result: Source[] = [];
	function walk(dir: string) {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const path = resolve(dir, entry.name);
			if (entry.isDirectory()) walk(path);
			else if (/\.(css|svelte|html)$/.test(path)) {
				result.push({ path: relative(root, path).replaceAll('\\', '/'), content: readFileSync(path, 'utf8') });
			}
		}
	}
	walk(resolve(root, 'src'));
	return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const sources = readSources();
	const errors = auditSources(sources);
	if (errors.length) {
		console.error(errors.join('\n'));
		process.exitCode = 1;
	} else {
		console.log(`fluid sizing audit passed (${sources.length} css, svelte, and html files)`);
	}
}
