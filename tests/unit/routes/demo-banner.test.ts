import crypto from 'node:crypto';
import { withSessionModule } from '../helpers/session-event';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { eq } from 'drizzle-orm';
import { makeSignature } from 'better-auth/crypto';
import { authSecret } from '$lib/server/auth';
import { db, schema } from '$lib/server/db';
import { seedDatabase } from '$lib/server/seed';
import type { Mode } from '$lib/features';
import DemoBanner from '$lib/components/site/DemoBanner.svelte';
import { DEMO_BANNER_COMPACT, DEMO_BANNER_LEAD, DEMO_BANNER_TEXT } from '$lib/components/site/demo-banner';
import { featuresWith } from '../helpers/features';
import InRootLayout from '../helpers/InRootLayout.svelte';

/**
 * PRODUCTION_PLAN 4.2 (banner part), CONTEXT decision 29: in the Demo every page
 * says so; in production, development and test nothing does.
 */

const pageMode = vi.hoisted(() => ({ mode: 'demo' as string }));
vi.mock('$app/state', () => ({
	page: {
		get data() {
			return { features: { mode: pageMode.mode } };
		}
	}
}));

const ALL_MODES: Mode[] = ['production', 'development', 'test', 'demo'];
const NOT_DEMO: Mode[] = ['production', 'development', 'test'];
const BANNER = 'data-testid="demo-banner"';

const sessionTokens: string[] = [];

beforeAll(async () => {
	await seedDatabase();
});

afterAll(async () => {
	for (const token of sessionTokens) {
		await db.delete(schema.sessions).where(eq(schema.sessions.token, token));
	}
});

/** Visible text, with tags stripped and entities decoded. */
function textOf(html: string): string {
	return html
		.replace(/<[^>]+>/g, ' ')
		.replace(/&#39;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, '&')
		.replace(/\s+/g, ' ');
}

function count(html: string, needle: string): number {
	return html.split(needle).length - 1;
}

function inLayout(mode: Mode, page?: unknown, pageProps: Record<string, unknown> = {}, text = '') {
	return render(InRootLayout, {
		props: { features: featuresWith({ mode, tipsOpenVenmo: mode === 'production' }), page: page as never, pageProps, text }
	}).body;
}

describe('DemoBanner', () => {
	it('in the Demo, says so in a labelled landmark', () => {
		const html = render(DemoBanner, { props: { mode: 'demo' } }).body;
		expect(html).toContain('<aside');
		expect(html).toContain('aria-label="Demo notice"');
		expect(textOf(html)).toContain(`${DEMO_BANNER_LEAD} ${DEMO_BANNER_TEXT}`);
		expect(textOf(html)).toContain('tips never open Venmo');
		expect(html).not.toContain('style=');
	});

	it.each(NOT_DEMO)('renders nothing in %s', (mode) => {
		expect(render(DemoBanner, { props: { mode } }).body).not.toContain(BANNER);
	});

	it('renders nothing when the mode is unknown', () => {
		expect(render(DemoBanner, { props: { mode: undefined } }).body).not.toContain(BANNER);
	});

	it('links to the real sign-up only when that URL is known', () => {
		expect(render(DemoBanner, { props: { mode: 'demo' } }).body).not.toMatch(/<a\s/);
		const html = render(DemoBanner, { props: { mode: 'demo', signupUrl: 'https://quire.example/login?mode=signup' } }).body;
		expect(html).toContain('href="https://quire.example/login?mode=signup"');
	});

	it('has a compact variant for the Case Display', () => {
		const html = render(DemoBanner, { props: { mode: 'demo', compact: true } }).body;
		expect(html).toContain('demo-banner--compact');
		expect(textOf(html)).toContain(DEMO_BANNER_COMPACT);
		expect(textOf(html)).not.toContain(DEMO_BANNER_TEXT);
	});

	it('is styled in @layer components with logical properties, never overlaid', () => {
		const css = fs.readFileSync(path.resolve(__dirname, '../../../src/lib/styles/layers/components.css'), 'utf8');
		const block = css.slice(css.indexOf('/* Demo banner'), css.indexOf('.demo-banner--compact .demo-banner-text'));
		expect(block).toContain('.demo-banner {');
		expect(block).not.toMatch(/position:\s*(fixed|sticky|absolute)/);
		expect(block).not.toMatch(/\b(margin|padding|border)-(top|bottom|left|right)\b|(?<![-\w])(width|height):/);
	});
});

describe('the banner on every page (root layout)', () => {
	it.each(ALL_MODES)('home page in %s', async (mode) => {
		const { default: Home } = await import('../../../src/routes/(site)/+page.svelte');
		const html = inLayout(mode, Home, { data: { features: featuresWith({ mode }) } });
		expect(count(html, BANNER)).toBe(mode === 'demo' ? 1 : 0);
	});

	it.each(ALL_MODES)('login in %s', async (mode) => {
		const { default: Login } = await import('../../../src/routes/(site)/login/+page.svelte');
		const { load } = withSessionModule(await import('../../../src/routes/(site)/login/+page.server'));
		const data = await load({
			request: new Request('http://localhost/login'),
			url: new URL('http://localhost/login')
		} as never);
		const html = inLayout(mode, Login, { data: { ...data, features: featuresWith({ mode }) }, form: null });
		expect(count(html, BANNER)).toBe(mode === 'demo' ? 1 : 0);
	});

	it.each(ALL_MODES)('Back Page in %s', async (mode) => {
		const { default: BackPage } = await import('../../../src/routes/(site)/a/[slug]/+page.svelte');
		const { load } = withSessionModule(await import('../../../src/routes/(site)/a/[slug]/+page.server'));
		const data = await load({
			params: { slug: 'the-neon-velvet' },
			request: new Request('http://localhost/a/the-neon-velvet')
		} as never);
		const html = inLayout(mode, BackPage, { data: { ...data, features: featuresWith({ mode }) }, form: null });
		expect(count(html, BANNER)).toBe(mode === 'demo' ? 1 : 0);
		expect(textOf(html)).toContain('The Neon Velvet');
	});

	it.each(ALL_MODES)('Issue reader in %s', async (mode) => {
		const { default: IssueReader } = await import('../../../src/routes/(zine)/i/[slug]/+page.svelte');
		const { load } = withSessionModule(await import('../../../src/routes/(zine)/i/[slug]/+page.server'));
		const slug = 'neon-velvet-philly-2026-10-15';
		const data = await load({
			params: { slug },
			request: new Request(`http://localhost/i/${slug}`),
			cookies: { get: () => undefined, getAll: () => [], set: () => {}, delete: () => {}, serialize: () => '' },
			url: new URL(`http://localhost/i/${slug}`)
		} as never);
		const html = inLayout(mode, IssueReader, { data: { ...data, features: featuresWith({ mode }) }, form: null });
		expect(count(html, BANNER)).toBe(mode === 'demo' ? 1 : 0);
	});

	it.each(ALL_MODES)('dashboard in %s', async (mode) => {
		const artist = await db.query.artists.findFirst({ where: eq(schema.artists.slug, 'the-neon-velvet') });
		const token = `test_demo_banner_${crypto.randomUUID()}`;
		sessionTokens.push(token);
		const now = new Date();
		await db.insert(schema.sessions).values({
			id: crypto.randomUUID(),
			userId: artist!.userId,
			token,
			expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
			createdAt: now,
			updatedAt: now
		});
		const cookie = `better-auth.session_token=${token}.${await makeSignature(token, authSecret)}`;
		const { default: Dashboard } = await import('../../../src/routes/(site)/dashboard/+page.svelte');
		const { load } = withSessionModule(await import('../../../src/routes/(site)/dashboard/+page.server'));
		const request = new Request('http://localhost/dashboard', { headers: { cookie } });
		const data = await (load as (event: never) => Promise<Record<string, unknown>>)({ request, url: new URL(request.url) } as never);
		const html = inLayout(mode, Dashboard, {
			data: { ...data, features: featuresWith({ mode }), emailConfirmation: null }
		});
		expect(count(html, BANNER)).toBe(mode === 'demo' ? 1 : 0);
	});

	it.each(ALL_MODES)('error page (404) in %s', (mode) => {
		// SvelteKit renders the error page, default or +error.svelte, inside the root layout.
		const html = inLayout(mode, undefined, {}, '404 Not Found');
		expect(html).toContain('404 Not Found');
		expect(count(html, BANNER)).toBe(mode === 'demo' ? 1 : 0);
	});

	it('no route escapes the root layout', () => {
		const routes = path.resolve(__dirname, '../../../src/routes');
		const files = fs.readdirSync(routes, { recursive: true }).map(String);
		// A `+layout@` or `+page@` reset could skip the root layout. Any +error.svelte,
		// the root one included, renders inside the root layout, so it keeps the banner.
		expect(files.filter((f) => /\+(layout|page)@/.test(f))).toEqual([]);
	});

	it('the root layout reads the mode from the public features, not the environment', () => {
		const layout = fs.readFileSync(path.resolve(__dirname, '../../../src/routes/+layout.svelte'), 'utf8');
		expect(layout).toContain('data.features?.mode');
		expect(layout).not.toMatch(/process\.env|import\.meta\.env|\$env\//);
	});
});

describe('the Full-Screen Case Display', () => {
	const props = {
		open: true,
		onClose: () => {},
		qrSvg: '<svg></svg>',
		title: 'The Neon Velvet',
		subtitle: '',
		urlLabel: 'quire.example/a/the-neon-velvet'
	};

	it.each(ALL_MODES)('carries the compact banner only in the Demo (%s)', async (mode) => {
		pageMode.mode = mode;
		const { default: QrCaseDisplay } = await import('$lib/components/dashboard/QrCaseDisplay.svelte');
		const html = render(QrCaseDisplay, { props }).body;
		expect(count(html, BANNER)).toBe(mode === 'demo' ? 1 : 0);
		if (mode === 'demo') expect(html).toContain('demo-banner--compact');
	});
});
