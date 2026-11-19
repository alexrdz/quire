import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '$lib/server/config';

/** GET /healthz (PRODUCTION_PLAN 3.6). */
const state = vi.hoisted(() => ({
	override: null as null | ((base: Config) => Config),
	dbDown: false,
	dbCalls: 0
}));

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

vi.mock('$lib/server/db', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/db')>();
	return {
		...actual,
		client: {
			execute: (...args: Parameters<typeof actual.client.execute>) => {
				state.dbCalls += 1;
				if (state.dbDown) return Promise.reject(new Error('ECONNREFUSED libsql://db.example'));
				return actual.client.execute(...args);
			}
		}
	};
});

const { GET } = await import('../../../src/routes/healthz/+server');
const { getConfig } = await import('$lib/server/config');

function expectNoSecrets(bodyText: string) {
	const { core } = getConfig();
	for (const secret of [core.authSecret, core.cookieSecret, core.databaseUrl, core.databaseAuthToken]) {
		if (secret) expect(bodyText).not.toContain(secret);
	}
	expect(bodyText).not.toMatch(/secret|token|password|@example\.com|libsql:|file:/i);
}

afterEach(() => {
	state.override = null;
	state.dbDown = false;
	state.dbCalls = 0;
	vi.restoreAllMocks();
});

describe('GET /healthz', () => {
	it('200 with db ok on a healthy database', async () => {
		const res = await (GET as any)({ request: new Request('http://localhost:5173/healthz') });
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(res.headers.get('cache-control')).toBe('no-store');
		expect(body).toMatchObject({ ok: true, mode: 'test', core: 'ok', db: 'ok' });
		expect(body.features).toMatchObject({
			email: expect.any(Boolean),
			fanSignIn: expect.any(Boolean),
			uploads: expect.any(Boolean),
			tipsOpenVenmo: false
		});
		expectNoSecrets(JSON.stringify(body));
	});

	it('503 with db down when the database is unreachable', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		state.dbDown = true;
		const res = await (GET as any)({ request: new Request('http://localhost:5173/healthz') });
		const body = await res.json();
		expect(res.status).toBe(503);
		expect(res.headers.get('cache-control')).toBe('no-store');
		expect(body).toMatchObject({ ok: false, core: 'ok', db: 'down' });
		expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
		expectNoSecrets(JSON.stringify(body));
	});

	it('503 when core config is invalid, without touching the database or naming the variables', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		state.override = (base) => ({
			...base,
			core: { ...base.core, ok: false, issues: ['BETTER_AUTH_SECRET', 'DATABASE_AUTH_TOKEN'] }
		});
		const res = await (GET as any)({ request: new Request('http://localhost:5173/healthz') });
		const body = await res.json();
		expect(res.status).toBe(503);
		expect(body).toMatchObject({ ok: false, core: 'invalid', db: 'down' });
		expect(state.dbCalls).toBe(0);
		expect(JSON.stringify(body)).not.toContain('BETTER_AUTH_SECRET');
		expectNoSecrets(JSON.stringify(body));
	});

	it('never includes the real values when production secrets are set', async () => {
		state.override = (base) => ({
			...base,
			core: {
				...base.core,
				authSecret: 'prod-auth-secret-value-0123456789abcdef',
				cookieSecret: 'prod-cookie-secret-value-0123456789abcdef',
				databaseAuthToken: 'prod-db-token-value'
			}
		});
		const res = await (GET as any)({ request: new Request('http://localhost:5173/healthz') });
		const text = await res.text();
		for (const value of ['prod-auth-secret-value', 'prod-cookie-secret-value', 'prod-db-token-value']) {
			expect(text).not.toContain(value);
		}
	});
});
