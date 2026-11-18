import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { isHttpError, isRedirect } from '@sveltejs/kit';
import type { Config, Mode } from '$lib/server/config';
import { FEATURE_UNAVAILABLE } from '$lib/features';

/**
 * Phase 1 (PRODUCTION_PLAN.md 1.1-1.3): sample data, /demo, the sample Fan
 * sign-in, simulated tips and console email exist only in development, test
 * and the Demo. Production must refuse each of them, even when a feature flag
 * would otherwise let the request through.
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

function inMode(mode: Mode, featureOverrides: Partial<Config['features']> = {}) {
	return (base: Config): Config => ({
		...base,
		mode,
		isDeployed: mode === 'demo' || mode === 'production',
		features: { ...base.features, ...featureOverrides },
		live: { payments: false, email: false, fanSignIn: false, uploads: false }
	});
}

/** Production as it must never be: every feature flag forced on, no real integration behind it. */
const productionWithFlagsForcedOn = inMode('production', {
	payments: true,
	email: true,
	fanSignIn: true,
	uploads: true
});

function mockCookies() {
	const store = new Map<string, string>();
	return {
		store,
		get: (name: string) => store.get(name),
		getAll: () => Array.from(store.entries()).map(([name, value]) => ({ name, value })),
		set: (name: string, value: string) => void store.set(name, value),
		delete: (name: string) => void store.delete(name),
		serialize: (name: string, value: string) => `${name}=${value}`
	};
}

function postForm(url: string, fields: Record<string, string> = {}): Request {
	const formData = new FormData();
	for (const [k, v] of Object.entries(fields)) formData.set(k, v);
	return new Request(url, { method: 'POST', body: formData });
}

type ActionFn = (event: never) => Promise<unknown>;

async function runAction(fn: unknown, event: Record<string, unknown>): Promise<unknown> {
	try {
		return await (fn as ActionFn)(event as never);
	} catch (thrown) {
		return thrown;
	}
}

beforeAll(async () => {
	// Sample data is needed by the tip tests; seeded in test mode before any override.
	const { seedDatabase } = await import('$lib/server/seed');
	await seedDatabase();
});

afterEach(() => {
	state.override = null;
});

describe('1.1 seed gating', () => {
	it('refuses to seed in production and says how to run it', async () => {
		state.override = productionWithFlagsForcedOn;
		const { seedDatabase } = await import('$lib/server/seed');
		await expect(seedDatabase()).rejects.toThrow(/NODE_ENV=development or DEMO_MODE=true/);
	});

	it.each(['test', 'demo', 'development'] as const)('seeds in %s mode', async (mode) => {
		state.override = inMode(mode);
		const { seedDatabase } = await import('$lib/server/seed');
		await expect(seedDatabase()).resolves.toBeTruthy();
	});

	it('leaves the Brooklyn sample Stamp Window open right after seeding', async () => {
		const { seedDatabase, OPEN_WINDOW_SAMPLE_SLUG } = await import('$lib/server/seed');
		const { db, schema } = await import('$lib/server/db');
		const { eq } = await import('drizzle-orm');
		const { isWithinStampWindow } = await import('$domain/stamping');

		await seedDatabase();
		const issue = await db.query.issues.findFirst({
			where: eq(schema.issues.slug, OPEN_WINDOW_SAMPLE_SLUG)
		});
		expect(issue?.date).toBe('2026-10-12');
		const window = { start: issue!.stampWindowStart!, end: issue!.stampWindowEnd! };
		expect(isWithinStampWindow(new Date(), window)).toBe(true);
		// Stored with second precision.
		expect(Math.abs(window.end.getTime() - window.start.getTime() - 48 * 60 * 60 * 1000)).toBeLessThanOrEqual(1000);
	});

	it('leaves no seedDatabase() calls in route files', async () => {
		const { readFile } = await import('node:fs/promises');
		const files = [
			'src/routes/(site)/login/+page.server.ts',
			'src/routes/(site)/a/[slug]/+page.server.ts',
			'src/routes/(zine)/i/[slug]/+page.server.ts'
		];
		for (const file of files) {
			const source = await readFile(file, 'utf8');
			expect(source, file).not.toContain('seedDatabase');
		}
	});
});

describe('1.1 /demo gating', () => {
	it('is 404 in production', async () => {
		state.override = productionWithFlagsForcedOn;
		const { GET } = await import('../../../src/routes/demo/+server');
		const cookies = mockCookies();
		const thrown = await runAction(GET, { cookies, url: new URL('http://localhost/demo') });
		expect(isHttpError(thrown) && thrown.status).toBe(404);
		expect(cookies.store.size).toBe(0);
	});

	it.each(['test', 'demo'] as const)('logs in as the sample Artist in %s mode', async (mode) => {
		state.override = inMode(mode);
		const { GET } = await import('../../../src/routes/demo/+server');
		const cookies = mockCookies();
		const thrown = await runAction(GET, { cookies, url: new URL('http://localhost/demo') });
		expect(isRedirect(thrown) && thrown.location).toBe('/dashboard');
		expect(cookies.store.has('better-auth.session_token')).toBe(true);
	});
});

describe('1.2 sample Fan sign-in', () => {
	beforeEach(() => {
		state.override = productionWithFlagsForcedOn;
	});

	it('login googleSignIn returns the unavailable message in production', async () => {
		const { actions } = await import('../../../src/routes/(site)/login/+page.server');
		const cookies = mockCookies();
		const result = (await runAction(actions.googleSignIn, {
			request: postForm('http://localhost/login?/googleSignIn', { redirectTo: '/me/stubs' }),
			url: new URL('http://localhost/login'),
			cookies
		})) as { status: number; data: { fanSignInError: string } };
		expect(result.status).toBe(503);
		expect(result.data.fanSignInError).toBe(FEATURE_UNAVAILABLE.fanSignIn);
		expect(cookies.store.size).toBe(0);
	});

	it('zine googleAuth returns the unavailable message in production', async () => {
		const { actions } = await import('../../../src/routes/(zine)/i/[slug]/+page.server');
		const cookies = mockCookies();
		const result = (await runAction(actions.googleAuth, {
			request: postForm('http://localhost/i/x?/googleAuth', { targetHash: '#page-wall' }),
			params: { slug: 'neon-velvet-brooklyn-2026-10-12' },
			url: new URL('http://localhost/i/neon-velvet-brooklyn-2026-10-12'),
			cookies
		})) as { status: number; data: { fanSignInError: string } };
		expect(result.status).toBe(503);
		expect(result.data.fanSignInError).toBe(FEATURE_UNAVAILABLE.fanSignIn);
		expect(cookies.store.size).toBe(0);
	});

	it('artist page googleAuth returns the unavailable message in production', async () => {
		const { actions } = await import('../../../src/routes/(site)/a/[slug]/+page.server');
		const cookies = mockCookies();
		const result = (await runAction(actions.googleAuth, {
			request: postForm('http://localhost/a/the-neon-velvet?/googleAuth'),
			params: { slug: 'the-neon-velvet' },
			url: new URL('http://localhost/a/the-neon-velvet'),
			cookies
		})) as { status: number; data: { fanSignInError: string } };
		expect(result.status).toBe(503);
		expect(result.data.fanSignInError).toBe(FEATURE_UNAVAILABLE.fanSignIn);
		expect(cookies.store.size).toBe(0);
	});

	it('still signs in as the sample Fan in test mode', async () => {
		state.override = inMode('test', { fanSignIn: true });
		const { actions } = await import('../../../src/routes/(site)/login/+page.server');
		const cookies = mockCookies();
		const thrown = await runAction(actions.googleSignIn, {
			request: postForm('http://localhost/login?/googleSignIn', { redirectTo: '/me/stubs' }),
			url: new URL('http://localhost/login'),
			cookies
		});
		expect(isRedirect(thrown) && thrown.location).toBe('/me/stubs');
		expect(cookies.store.has('better-auth.session_token')).toBe(true);
	});

	it('auth.ts carries no mock Google client id', async () => {
		const { readFile } = await import('node:fs/promises');
		const source = await readFile('src/lib/server/auth.ts', 'utf8');
		expect(source).not.toContain('mock_google_client_id');
	});
});

describe('1.3 tips and email', () => {
	beforeEach(() => {
		state.override = productionWithFlagsForcedOn;
	});

	it('never simulates a tip in production', async () => {
		const { db, schema } = await import('$lib/server/db');
		const { eq } = await import('drizzle-orm');
		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.slug, 'the-neon-velvet')
		});
		expect(artist).toBeTruthy();

		const { createTipCheckout } = await import('$lib/server/services/payments');
		const result = await createTipCheckout({
			artistId: artist!.id,
			amountGrossCents: 500,
			returnUrl: 'https://quire.live/a/the-neon-velvet'
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('PAYMENTS_UNAVAILABLE');
	});

	it('never logs an email body, token or link in production', async () => {
		const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
			vi.spyOn(console, level).mockImplementation(() => {})
		);
		const { sendPasswordResetEmail } = await import('$lib/server/email');
		const result = await sendPasswordResetEmail({
			to: 'band@example.com',
			artistName: 'Band',
			resetUrl: 'https://quire.live/login/reset?token=secret-reset-token'
		});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.code).toBe('EMAIL_UNAVAILABLE');
		for (const spy of spies) {
			expect(spy).not.toHaveBeenCalled();
			spy.mockRestore();
		}
	});

	it('still simulates a tip in the Demo without Stripe keys', async () => {
		state.override = inMode('demo', { payments: true });
		const { db, schema } = await import('$lib/server/db');
		const { eq } = await import('drizzle-orm');
		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.slug, 'the-neon-velvet')
		});
		const { createTipCheckout } = await import('$lib/server/services/payments');
		const result = await createTipCheckout({
			artistId: artist!.id,
			amountGrossCents: 500,
			returnUrl: 'https://quire.live/a/the-neon-velvet'
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.mode).toBe('mock');
			if (result.value.mode === 'mock') {
				await db.delete(schema.tips).where(eq(schema.tips.id, result.value.tipId));
			}
		}
	});
});
