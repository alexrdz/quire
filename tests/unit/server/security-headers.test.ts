import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '$lib/server/config';

const state = vi.hoisted(() => ({ override: null as null | ((base: Config) => Config) }));

vi.mock('$lib/server/config', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/config')>();
	return {
		...actual,
		getConfig: () => {
			const base = actual.getConfig();
			return state.override ? state.override(base) : base;
		}
	};
});

const { buildCspDirectives, buildCspHeader, kitScriptSources, r2UploadOrigin, withSecurityHeaders } = await import(
	'$lib/server/http/security-headers'
);

afterEach(() => {
	state.override = null;
});

const R2 = 'https://media.quire.live';

describe('CSP directives', () => {
	const csp = buildCspDirectives({ mode: 'production', mediaOrigin: R2 });

	it('locks down the defaults', () => {
		expect(csp['default-src']).toEqual(["'self'"]);
		expect(csp['frame-ancestors']).toEqual(["'none'"]);
		expect(csp['object-src']).toEqual(["'none'"]);
		expect(csp['base-uri']).toEqual(["'self'"]);
		expect(csp['connect-src']).toEqual(["'self'"]);
	});

	it('never allows inline scripts; inline styles only for runtime custom properties', () => {
		expect(csp['script-src']).toEqual(["'self'"]);
		expect(csp['style-src']).toEqual(["'self'", "'unsafe-inline'"]);
	});

	it('allows the R2 origin for images and media', () => {
		expect(csp['img-src']).toEqual(
			expect.arrayContaining(["'self'", 'data:', 'blob:', R2, 'https://i.ytimg.com', 'https://images.unsplash.com'])
		);
		expect(csp['media-src']).toEqual(expect.arrayContaining(["'self'", R2]));
	});

	it('leaves R2 out when R2_PUBLIC_URL is not set', () => {
		const without = buildCspDirectives({ mode: 'production', mediaOrigin: null });
		expect(without['img-src']).not.toContain('null');
		expect(without['media-src']).toEqual(["'self'", 'blob:']);
	});

	it("lets only Quire frame the Issue reader and the Bookbinder's preview, and nothing frame any other page", () => {
		for (const pathname of ['/i/neon-velvet-brooklyn', '/i', '/dashboard/bookbinder/issue-123/preview', '/dashboard/bookbinder/issue-123/preview/']) {
			expect(buildCspDirectives({ mode: 'production', mediaOrigin: null, pathname })['frame-ancestors']).toEqual([
				"'self'"
			]);
		}
		// Only the exact preview path: not the Bookbinder itself, nor anything that merely contains "preview".
		for (const pathname of [
			'/',
			'/dashboard',
			'/a/the-neon-velvet',
			'/login',
			'/ix',
			undefined,
			'/dashboard/bookbinder/issue-123',
			'/dashboard/bookbinder/issue-123/preview/extra',
			'/dashboard/bookbinder//preview',
			'/dashboard/settings/preview',
			'/x/dashboard/bookbinder/issue-123/preview'
		]) {
			expect(buildCspDirectives({ mode: 'production', mediaOrigin: null, pathname })['frame-ancestors']).toEqual([
				"'none'"
			]);
		}
	});

	it('allows the reader embeds and the Google sign-in redirect', () => {
		expect(csp['frame-src']).toEqual(
			expect.arrayContaining([
				"'self'",
				'https://www.youtube-nocookie.com',
				'https://www.youtube.com',
				'https://player.vimeo.com',
				'https://bandcamp.com'
			])
		);
		expect(csp['form-action']).toEqual(["'self'", 'https://accounts.google.com']);
	});

	it('has no Stripe or Venmo entries', () => {
		const header = buildCspHeader({ mode: 'production', mediaOrigin: R2 });
		expect(header).not.toMatch(/stripe|venmo/i);
	});

	it('allows the Vite websocket only in development', () => {
		expect(buildCspDirectives({ mode: 'development', mediaOrigin: null })['connect-src']).toContain('ws:');
		for (const mode of ['test', 'demo', 'production'] as const) {
			expect(buildCspDirectives({ mode, mediaOrigin: null })['connect-src']).toEqual(["'self'"]);
		}
	});
});

describe('CSP connect-src for direct video uploads (ADR 0010)', () => {
	const ACCOUNT = '0123456789abcdef0123456789abcdef';
	const UPLOAD = `https://${ACCOUNT}.r2.cloudflarestorage.com`;

	it('allows the R2 upload origin, and only that, when there is one', () => {
		for (const mode of ['test', 'demo', 'production'] as const) {
			expect(buildCspDirectives({ mode, mediaOrigin: R2, uploadOrigin: UPLOAD })['connect-src']).toEqual([
				"'self'",
				UPLOAD
			]);
		}
		expect(buildCspDirectives({ mode: 'development', mediaOrigin: null, uploadOrigin: UPLOAD })['connect-src']).toEqual([
			"'self'",
			'ws:',
			'wss:',
			UPLOAD
		]);
		const header = buildCspHeader({ mode: 'production', mediaOrigin: R2, uploadOrigin: UPLOAD });
		expect(header).not.toContain('*.r2.cloudflarestorage.com');
		expect(header).not.toMatch(/connect-src[^;]*https:\/\/media\.quire\.live/);
	});

	it('builds the upload origin from the R2 account id, and refuses a malformed one', () => {
		expect(r2UploadOrigin(ACCOUNT)).toBe(UPLOAD);
		expect(r2UploadOrigin(ACCOUNT.toUpperCase())).toBe(UPLOAD);
		for (const bad of ['', 'abc', `${ACCOUNT}; script-src *`, `${ACCOUNT}.evil.test`, 'x'.repeat(32)]) {
			expect(r2UploadOrigin(bad), bad).toBeNull();
		}
	});

	it('withSecurityHeaders reads the upload origin from the R2 config', () => {
		const r2 = { accountId: ACCOUNT, accessKeyId: 'id', secretAccessKey: 'key', bucketName: 'quire-media', publicUrl: R2 };
		state.override = (base) => ({ ...base, integrations: { ...base.integrations, r2 } });
		const csp = withSecurityHeaders(new Response('ok'), { mode: 'production', mediaOrigin: R2 }).headers.get(
			'content-security-policy'
		);
		expect(csp).toContain(`connect-src 'self' ${UPLOAD};`);

		state.override = (base) => ({ ...base, integrations: { ...base.integrations, r2: null } });
		const without = withSecurityHeaders(new Response('ok'), { mode: 'production', mediaOrigin: null }).headers.get(
			'content-security-policy'
		);
		expect(without).toContain("connect-src 'self';");
	});
});

describe('SvelteKit nonce merge', () => {
	it('keeps the script-src SvelteKit generated and rebuilds the rest', () => {
		const kit = "script-src 'self' 'nonce-abc123'; default-src *";
		expect(kitScriptSources(kit)).toEqual(["'self'", "'nonce-abc123'"]);
		const header = buildCspHeader({ mode: 'production', mediaOrigin: R2 }, kit);
		expect(header).toContain("script-src 'self' 'nonce-abc123'");
		expect(header).toContain("default-src 'self'");
		expect(header).not.toContain('default-src *');
	});

	it("falls back to script-src 'self' without a SvelteKit header", () => {
		expect(kitScriptSources(null)).toBeNull();
		expect(buildCspHeader({ mode: 'production', mediaOrigin: null })).toContain("script-src 'self';");
	});
});

describe('withSecurityHeaders', () => {
	it('sets every header on a normal response', () => {
		const res = withSecurityHeaders(new Response('ok'), { mode: 'production', mediaOrigin: R2 });
		expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
		expect(res.headers.get('x-content-type-options')).toBe('nosniff');
		expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
	});

	it('copies responses whose headers are immutable', () => {
		const redirect = Response.redirect('https://quire.live/next', 303);
		const res = withSecurityHeaders(redirect, { mode: 'production', mediaOrigin: null });
		expect(res.status).toBe(303);
		expect(res.headers.get('location')).toBe('https://quire.live/next');
		expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
		expect(res.headers.get('x-content-type-options')).toBe('nosniff');
	});
});
