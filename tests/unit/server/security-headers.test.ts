import { describe, expect, it } from 'vitest';
import {
	buildCspDirectives,
	buildCspHeader,
	kitScriptSources,
	withSecurityHeaders
} from '$lib/server/http/security-headers';

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

	it('lets only Quire frame the Issue reader, and nothing frame any other page', () => {
		for (const pathname of ['/i/neon-velvet-brooklyn', '/i']) {
			expect(buildCspDirectives({ mode: 'production', mediaOrigin: null, pathname })['frame-ancestors']).toEqual([
				"'self'"
			]);
		}
		for (const pathname of ['/', '/dashboard', '/a/the-neon-velvet', '/login', '/ix', undefined]) {
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
