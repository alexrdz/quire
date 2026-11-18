import { describe, expect, it } from 'vitest';
import {
	getPublicFeatures,
	parseConfig,
	resolveMode,
	STRIPE_DORMANT,
	tipsOpenVenmo,
	type Env
} from '$lib/server/config';
import { featureUnavailableMessage, FEATURE_UNAVAILABLE } from '$lib/features';

const STRONG_AUTH = 'a'.repeat(24) + 'auth_secret_prod_9f3k';
const STRONG_COOKIE = 'b'.repeat(24) + 'scan_secret_prod_7q2m';

const CORE: Env = {
	BETTER_AUTH_SECRET: STRONG_AUTH,
	COOKIE_SECRET: STRONG_COOKIE,
	DATABASE_URL: 'libsql://quire-prod.turso.io',
	DATABASE_AUTH_TOKEN: 'turso_token',
	BETTER_AUTH_URL: 'https://quire.live'
};

const INTEGRATIONS: Env = {
	STRIPE_SECRET_KEY: 'sk_live_123',
	STRIPE_WEBHOOK_SECRET: 'whsec_123',
	STRIPE_PUBLISHABLE_KEY: 'pk_live_123',
	RESEND_API_KEY: 're_123',
	GOOGLE_CLIENT_ID: 'google-id',
	GOOGLE_CLIENT_SECRET: 'google-secret',
	R2_ACCOUNT_ID: 'acct',
	R2_ACCESS_KEY_ID: 'key',
	R2_SECRET_ACCESS_KEY: 'secret',
	R2_PUBLIC_URL: 'https://media.quire.live/'
};

const prod = (env: Env = {}) => parseConfig({ NODE_ENV: 'production', ...CORE, ...env });

describe('resolveMode', () => {
	it('detects each mode', () => {
		expect(resolveMode({ NODE_ENV: 'development' })).toBe('development');
		expect(resolveMode({ NODE_ENV: 'test' })).toBe('test');
		expect(resolveMode({ VITEST: 'true' })).toBe('test');
		expect(resolveMode({ NODE_ENV: 'production' })).toBe('production');
	});

	it('is demo only when DEMO_MODE=true, whatever NODE_ENV says', () => {
		expect(resolveMode({ NODE_ENV: 'production', DEMO_MODE: 'true' })).toBe('demo');
		expect(resolveMode({ NODE_ENV: 'development', DEMO_MODE: 'TRUE' })).toBe('demo');
		expect(resolveMode({ NODE_ENV: 'production', DEMO_MODE: '1' })).toBe('production');
		expect(resolveMode({ NODE_ENV: 'production', DEMO_MODE: 'false' })).toBe('production');
	});

	it('fails closed to production when NODE_ENV is missing or unknown', () => {
		expect(resolveMode({})).toBe('production');
		expect(resolveMode({ NODE_ENV: 'staging' })).toBe('production');
	});
});

describe('core configuration', () => {
	it('accepts a complete production config', () => {
		const config = prod();
		expect(config.core.ok).toBe(true);
		expect(config.core.issues).toEqual([]);
		expect(config.core.authSecret).toBe(STRONG_AUTH);
		expect(config.core.cookieSecret).toBe(STRONG_COOKIE);
		expect(config.core.appUrl).toBe('https://quire.live');
		expect(config.isDeployed).toBe(true);
	});

	it.each([
		['BETTER_AUTH_SECRET'],
		['COOKIE_SECRET'],
		['DATABASE_URL'],
		['DATABASE_AUTH_TOKEN'],
		['BETTER_AUTH_URL']
	])('flags missing %s in production', (key) => {
		const config = prod({ [key]: undefined });
		expect(config.core.ok).toBe(false);
		expect(config.core.issues).toContain(key);
	});

	it('rejects short, placeholder and shared secrets in production', () => {
		expect(prod({ BETTER_AUTH_SECRET: 'short' }).core.issues).toContain('BETTER_AUTH_SECRET');
		expect(
			prod({ BETTER_AUTH_SECRET: 'change_me_to_a_secure_32_char_secret_xxxx' }).core.issues
		).toContain('BETTER_AUTH_SECRET');
		expect(prod({ COOKIE_SECRET: STRONG_AUTH }).core.ok).toBe(false);
	});

	it('rejects a local file database in production', () => {
		const config = prod({ DATABASE_URL: 'file:local.db' });
		expect(config.core.issues).toContain('DATABASE_URL');
	});

	it('never falls back to a known secret when core is invalid', () => {
		const a = parseConfig({ NODE_ENV: 'production' });
		const b = parseConfig({ NODE_ENV: 'production' });
		expect(a.core.ok).toBe(false);
		expect(a.core.authSecret).not.toBe(b.core.authSecret);
		expect(a.core.authSecret).not.toMatch(/quire_/);
		expect(a.core.cookieSecret).not.toMatch(/quire_/);
	});

	it('requires full core config in the Demo too', () => {
		expect(parseConfig({ DEMO_MODE: 'true' }).core.ok).toBe(false);
		expect(parseConfig({ DEMO_MODE: 'true', ...CORE }).core.ok).toBe(true);
	});

	it('uses development defaults locally', () => {
		for (const NODE_ENV of ['development', 'test']) {
			const config = parseConfig({ NODE_ENV });
			expect(config.core.ok).toBe(true);
			expect(config.core.databaseUrl).toBe('file:local.db');
			expect(config.core.appUrl).toBe('http://localhost:5173');
			expect(config.core.authSecret.length).toBeGreaterThanOrEqual(32);
			expect(config.isDeployed).toBe(false);
		}
	});

	it('forces the local database in test mode', () => {
		const config = parseConfig({ NODE_ENV: 'test', DATABASE_URL: 'libsql://quire-prod.turso.io' });
		expect(config.core.databaseUrl).toBe('file:local.db');
		expect(config.core.databaseAuthToken).toBeUndefined();
	});

	it('requires a token for a remote database in development', () => {
		const config = parseConfig({ NODE_ENV: 'development', DATABASE_URL: 'libsql://dev.turso.io' });
		expect(config.core.ok).toBe(false);
		expect(config.core.issues).toContain('DATABASE_AUTH_TOKEN');
	});
});

describe('feature flags', () => {
	it('turns every feature off in production without integration keys', () => {
		const config = prod();
		expect(config.features).toEqual({ payments: false, email: false, fanSignIn: false, uploads: false });
		expect(config.live).toEqual(config.features);
	});

	it('turns every feature on in production with all keys, except dormant Stripe', () => {
		const config = prod(INTEGRATIONS);
		expect(config.features).toEqual({ payments: false, email: true, fanSignIn: true, uploads: true });
		expect(config.live).toEqual(config.features);
		expect(config.integrations.r2?.publicUrl).toBe('https://media.quire.live');
	});

	it('never makes Stripe live and never requires a Stripe key (ADR 0008)', () => {
		expect(STRIPE_DORMANT).toBe(true);
		const withStripe = prod({ STRIPE_SECRET_KEY: 'sk_live_1', STRIPE_WEBHOOK_SECRET: 'whsec_1' });
		expect(withStripe.live.payments).toBe(false);
		expect(withStripe.features.payments).toBe(false);
		for (const NODE_ENV of ['development', 'test']) {
			const local = parseConfig({ NODE_ENV, STRIPE_SECRET_KEY: 'sk_test_1', STRIPE_WEBHOOK_SECRET: 'whsec_1' });
			expect(local.live.payments).toBe(false);
		}
		const demo = parseConfig({ DEMO_MODE: 'true', ...CORE, STRIPE_SECRET_KEY: 'sk_test_1', STRIPE_WEBHOOK_SECRET: 'whsec_1' });
		expect(demo.live.payments).toBe(false);

		const noStripe = prod({ ...INTEGRATIONS, STRIPE_SECRET_KEY: undefined, STRIPE_WEBHOOK_SECRET: undefined, STRIPE_PUBLISHABLE_KEY: undefined });
		expect(noStripe.core.ok).toBe(true);
		expect(noStripe.core.issues.join(' ')).not.toMatch(/STRIPE/);
		expect(noStripe.features).toEqual({ payments: false, email: true, fanSignIn: true, uploads: true });
	});

	it('opens Venmo from tip buttons only in production', () => {
		expect(tipsOpenVenmo('production')).toBe(true);
		for (const mode of ['development', 'test', 'demo'] as const) {
			expect(tipsOpenVenmo(mode)).toBe(false);
		}
		expect(getPublicFeatures().tipsOpenVenmo).toBe(false);
	});

	it('needs every Google and R2 value', () => {
		expect(prod({ GOOGLE_CLIENT_ID: 'id' }).features.fanSignIn).toBe(false);
		expect(prod({ R2_ACCOUNT_ID: 'a', R2_ACCESS_KEY_ID: 'b' }).features.uploads).toBe(false);
	});

	it('removes each feature independently', () => {
		const removals: Array<[string, keyof ReturnType<typeof prod>['features']]> = [
			['RESEND_API_KEY', 'email'],
			['GOOGLE_CLIENT_SECRET', 'fanSignIn'],
			['R2_SECRET_ACCESS_KEY', 'uploads']
		];
		for (const [key, feature] of removals) {
			const config = prod({ ...INTEGRATIONS, [key]: undefined });
			expect(config.features[feature]).toBe(false);
			expect(config.core.ok).toBe(true);
			// payments is always off: Stripe is dormant (ADR 0008).
			const others = Object.entries(config.features).filter(
				([name]) => name !== feature && name !== 'payments'
			);
			expect(others.every(([, on]) => on)).toBe(true);
		}
	});

	it('allows stand-ins in development and test', () => {
		for (const NODE_ENV of ['development', 'test']) {
			const config = parseConfig({ NODE_ENV });
			expect(config.features).toEqual({ payments: true, email: true, fanSignIn: true, uploads: true });
			expect(config.live).toEqual({ payments: false, email: false, fanSignIn: false, uploads: false });
		}
	});

	it('keeps email off in the Demo even with a Resend key', () => {
		const config = parseConfig({ DEMO_MODE: 'true', ...CORE, ...INTEGRATIONS });
		expect(config.features.email).toBe(false);
		expect(config.live.email).toBe(false);
		expect(config.features.payments).toBe(true);
	});

	it('allows payment, sign-in and upload stand-ins in the Demo', () => {
		const config = parseConfig({ DEMO_MODE: 'true', ...CORE });
		expect(config.features).toEqual({ payments: true, email: false, fanSignIn: true, uploads: true });
	});

	it('never seeds automatically in production', () => {
		expect(prod().autoSeed).toBe(false);
		expect(parseConfig({ DEMO_MODE: 'true', ...CORE }).autoSeed).toBe(true);
		expect(parseConfig({ NODE_ENV: 'development', DISABLE_AUTO_SEED: 'true' }).autoSeed).toBe(false);
	});
});

describe('feature messages', () => {
	it('uses Demo-specific copy for email only', () => {
		expect(featureUnavailableMessage('email', 'demo')).toMatch(/Demo/);
		expect(featureUnavailableMessage('email', 'production')).toBe(FEATURE_UNAVAILABLE.email);
		expect(featureUnavailableMessage('payments', 'demo')).toBe(FEATURE_UNAVAILABLE.payments);
	});
});
