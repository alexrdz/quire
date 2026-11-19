import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Config } from '$lib/server/config';

/**
 * PRODUCTION_PLAN 3.4 and 3.6: every response from `handle` carries the security
 * headers, including the early returns, and `handleError` logs with a request id
 * while the client sees only a generic message.
 */
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

const { handle, handleError } = await import('../../../src/hooks.server');
const { seedDatabase } = await import('$lib/server/seed');

const KIT_CSP = "script-src 'self' 'nonce-kitnonce123'";

function event(path: string, init: RequestInit = {}) {
	const url = new URL(`http://localhost:5173${path}`);
	return {
		url,
		request: new Request(url, init),
		locals: {} as App.Locals
	} as any;
}

/** Stands in for SvelteKit rendering a page with `kit.csp` on. */
const renderPage = vi.fn(async () =>
	new Response('<!doctype html><p>page</p>', {
		headers: { 'content-type': 'text/html', 'content-security-policy': KIT_CSP }
	})
);

async function run(path: string, init?: RequestInit) {
	return handle({ event: event(path, init), resolve: renderPage as any });
}

function expectSecurityHeaders(res: Response) {
	const csp = res.headers.get('content-security-policy') ?? '';
	expect(csp).toContain("default-src 'self'");
	expect(csp).toMatch(/frame-ancestors '(none|self)'/);
	expect(csp).toContain("object-src 'none'");
	expect(csp).toContain('form-action \'self\' https://accounts.google.com');
	expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
	expect(res.headers.get('x-content-type-options')).toBe('nosniff');
	expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
	return csp;
}

beforeAll(async () => {
	await seedDatabase();
});

afterEach(() => {
	state.override = null;
	renderPage.mockClear();
	vi.restoreAllMocks();
});

describe('security headers on every response', () => {
	it('a rendered page keeps the SvelteKit nonce and gets the full policy', async () => {
		const res = await run('/');
		const csp = expectSecurityHeaders(res);
		expect(csp).toContain("script-src 'self' 'nonce-kitnonce123'");
	});

	it('lets Quire frame the reader (Bookbinder preview) but nothing else', async () => {
		expect((await run('/i/some-issue')).headers.get('content-security-policy')).toContain(
			"frame-ancestors 'self'"
		);
		expect((await run('/dashboard')).headers.get('content-security-policy')).toContain(
			"frame-ancestors 'none'"
		);
	});

	it('adds the R2 media origin at runtime', async () => {
		state.override = (base) => ({ ...base, mediaOrigin: 'https://media.quire.live' });
		const csp = expectSecurityHeaders(await run('/'));
		expect(csp).toMatch(/img-src [^;]*https:\/\/media\.quire\.live/);
		expect(csp).toMatch(/media-src [^;]*https:\/\/media\.quire\.live/);
	});

	it('an /api/auth response from Better Auth', async () => {
		const res = await run('/api/auth/get-session');
		expect(renderPage).not.toHaveBeenCalled();
		const csp = expectSecurityHeaders(res);
		expect(csp).toContain("script-src 'self';");
	});

	it('the 503 page when core config is invalid', async () => {
		state.override = (base) => ({ ...base, core: { ...base.core, ok: false, issues: ['BETTER_AUTH_SECRET'] } });
		const res = await run('/dashboard');
		expect(res.status).toBe(503);
		expect(await res.text()).toContain('temporarily unavailable');
		expectSecurityHeaders(res);
	});

	it('the email-off JSON on an email auth path', async () => {
		state.override = (base) => ({ ...base, features: { ...base.features, email: false } });
		const res = await run('/api/auth/sign-up/email', { method: 'POST', body: '{}' });
		expect(res.status).toBe(503);
		expect(await res.json()).toMatchObject({ code: 'EMAIL_UNAVAILABLE' });
		expectSecurityHeaders(res);
	});

	it('a crash inside the hook still returns a generic 500 with headers', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const res = await handle({
			event: event('/'),
			resolve: (async () => {
				throw new Error('secret internal detail');
			}) as any
		});
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body).toEqual({ message: 'Something went wrong.', id: expect.any(String) });
		expect(JSON.stringify(body)).not.toContain('secret internal detail');
		expect(String(consoleError.mock.calls[0][0])).toContain(body.id);
		expectSecurityHeaders(res);
	});

	it('/healthz skips the 503 page so it can report invalid core config itself', async () => {
		state.override = (base) => ({ ...base, core: { ...base.core, ok: false, issues: ['DATABASE_URL'] } });
		const res = await run('/healthz');
		expect(renderPage).toHaveBeenCalledTimes(1);
		expectSecurityHeaders(res);
	});
});

describe('handleError', () => {
	function errorEvent(headers: Record<string, string> = {}, locals: Partial<App.Locals> = {}) {
		const url = new URL('http://localhost:5173/i/some-issue?k=scan_secret_key');
		return { url, request: new Request(url, { headers }), locals } as any;
	}

	it('returns a generic message and logs the same id with the error', async () => {
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const thrown = new Error('SQLITE_ERROR: no such table secret_internal');
		const result = (await handleError({
			error: thrown,
			event: errorEvent({ 'x-nf-request-id': '01JD8Q6Z3NETLIFYREQ' }),
			status: 500,
			message: 'Internal Error'
		})) as App.Error;

		expect(result).toEqual({ message: 'Something went wrong.', id: '01JD8Q6Z3NETLIFYREQ' });
		expect(JSON.stringify(result)).not.toContain('secret_internal');

		expect(consoleError).toHaveBeenCalledTimes(1);
		const [line, logged] = consoleError.mock.calls[0];
		expect(line).toContain('id=01JD8Q6Z3NETLIFYREQ');
		expect(line).toContain('GET /i/some-issue');
		// The query string can carry tokens and is never logged.
		expect(line).not.toContain('scan_secret_key');
		expect(logged).toBe(thrown);
	});

	it('uses the id the handle hook assigned, or a random UUID', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const fromLocals = (await handleError({
			error: new Error('x'),
			event: errorEvent({}, { requestId: 'req-from-handle' }),
			status: 500,
			message: 'Internal Error'
		})) as App.Error;
		expect(fromLocals.id).toBe('req-from-handle');

		const generated = (await handleError({
			error: new Error('x'),
			event: errorEvent({ 'x-nf-request-id': 'bad id; INJECTED=1' }),
			status: 500,
			message: 'Internal Error'
		})) as App.Error;
		expect(generated.id).toMatch(/^[0-9a-f-]{36}$/);
	});

	it('a 404 logs one line without the error and says the page was not found', async () => {
		const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const result = (await handleError({
			error: new Error('Not found: /nope'),
			event: errorEvent(),
			status: 404,
			message: 'Not Found'
		})) as App.Error;
		expect(result.message).toBe('Page not found.');
		expect(result.id).toBeTruthy();
		expect(consoleError).not.toHaveBeenCalled();
		expect(consoleWarn.mock.calls[0]).toHaveLength(1);
	});
});
