import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCAL_PREVIEW_FLAG, localPreviewFor, parseConfig, type Env } from '$lib/server/config';

/**
 * P4L-T03: QUIRE_E2E_LOCAL_PREVIEW lets the Demo and production modes run
 * locally (file database, fixed test secrets) for the e2e suite. It applies only
 * when DATABASE_URL is a file: URL and no Netlify variable is set. Otherwise it
 * is ignored and the normal fail-closed rules apply.
 */

const LOCAL: Env = {
	[LOCAL_PREVIEW_FLAG]: 'true',
	DATABASE_URL: 'file:/tmp/quire-e2e/demo.db',
	BETTER_AUTH_URL: 'http://localhost:4174'
};

const demo = (env: Env = {}) => parseConfig({ DEMO_MODE: 'true', ...LOCAL, ...env });
const production = (env: Env = {}) => parseConfig({ NODE_ENV: 'production', ...LOCAL, ...env });

describe('the guard', () => {
	it('is off unless the flag is exactly true', () => {
		for (const value of [undefined, '', 'false', '1', 'yes']) {
			expect(localPreviewFor({ ...LOCAL, [LOCAL_PREVIEW_FLAG]: value }).requested, String(value)).toBe(false);
		}
		expect(localPreviewFor({ ...LOCAL, [LOCAL_PREVIEW_FLAG]: ' TRUE ' }).honored).toBe(true);
	});

	it('is honored when every condition holds', () => {
		expect(localPreviewFor(LOCAL)).toEqual({ requested: true, honored: true, ignoredBecause: [] });
	});

	it.each([
		['a remote libsql database', { DATABASE_URL: 'libsql://quire-prod.turso.io' }, 'DATABASE_URL is not a file: URL'],
		['an https database', { DATABASE_URL: 'https://quire-prod.turso.io' }, 'DATABASE_URL is not a file: URL'],
		['no database URL', { DATABASE_URL: undefined }, 'DATABASE_URL is not a file: URL'],
		['NETLIFY set', { NETLIFY: 'true' }, 'NETLIFY is set'],
		['NETLIFY set but empty', { NETLIFY: '' }, 'NETLIFY is set'],
		['CONTEXT set', { CONTEXT: 'production' }, 'CONTEXT is set'],
		['CONTEXT set to deploy-preview', { CONTEXT: 'deploy-preview' }, 'CONTEXT is set'],
		['DEPLOY_URL set', { DEPLOY_URL: 'https://abc--quire.netlify.app' }, 'DEPLOY_URL is set'],
		// The one Netlify variable a function sees at runtime.
		['SITE_ID set (inside a Netlify function)', { SITE_ID: '1d01c0c0-4554-4747-93b8-34ce3448ab95' }, 'SITE_ID is set']
	])('is ignored with %s', (_label, env, reason) => {
		const decision = localPreviewFor({ ...LOCAL, ...env });
		expect(decision.requested).toBe(true);
		expect(decision.honored).toBe(false);
		expect(decision.ignoredBecause.join('; ')).toContain(reason);
	});

	it('names variables, never their values', () => {
		const decision = localPreviewFor({ ...LOCAL, DATABASE_URL: 'libsql://secret-host.turso.io', DEPLOY_URL: 'https://x' });
		expect(decision.ignoredBecause.join(' ')).not.toMatch(/secret-host|https:\/\/x/);
	});
});

describe.each([
	['demo', demo],
	['production', production]
] as const)('%s mode with the flag', (mode, build) => {
	it('honored: runs on the local file database with fixed test secrets', () => {
		const config = build();
		expect(config.mode).toBe(mode);
		expect(config.isDeployed).toBe(true);
		expect(config.localPreview.honored).toBe(true);
		expect(config.core.ok).toBe(true);
		expect(config.core.issues).toEqual([]);
		expect(config.core.databaseUrl).toBe('file:/tmp/quire-e2e/demo.db');
		expect(config.core.databaseAuthToken).toBeUndefined();
		expect(config.core.authSecret).not.toBe(config.core.cookieSecret);
		expect(config.core.authSecret.length).toBeGreaterThanOrEqual(32);
	});

	it('honored: the fixed secrets are the same on every start, so sessions survive a restart', () => {
		expect(build().core.authSecret).toBe(build().core.authSecret);
		expect(build().core.cookieSecret).toBe(build().core.cookieSecret);
	});

	it('honored: still needs the app URL, and still checks secrets that are set', () => {
		expect(build({ BETTER_AUTH_URL: undefined }).core.issues).toEqual(['BETTER_AUTH_URL']);
		expect(build({ BETTER_AUTH_SECRET: 'short' }).core.issues).toEqual(['BETTER_AUTH_SECRET']);
	});

	it.each([
		['NETLIFY', { NETLIFY: 'true' }],
		['CONTEXT', { CONTEXT: 'production' }],
		['DEPLOY_URL', { DEPLOY_URL: 'https://abc--quire.netlify.app' }],
		['SITE_ID', { SITE_ID: '1d01c0c0-4554-4747-93b8-34ce3448ab95' }]
	])('ignored when %s is set: the normal fail-closed rules apply', (_name, env) => {
		const config = build(env);
		expect(config.localPreview.honored).toBe(false);
		expect(config.core.ok).toBe(false);
		expect(config.core.issues).toEqual(
			expect.arrayContaining(['BETTER_AUTH_SECRET', 'COOKIE_SECRET', 'DATABASE_URL', 'DATABASE_AUTH_TOKEN'])
		);
		expect(config.core.databaseUrl).toBe('');
	});

	it('ignored with a remote database: needs every real core value as usual', () => {
		const remote = { DATABASE_URL: 'libsql://quire-prod.turso.io' };
		const config = build(remote);
		expect(config.localPreview.honored).toBe(false);
		expect(config.core.issues).toEqual(
			expect.arrayContaining(['BETTER_AUTH_SECRET', 'COOKIE_SECRET', 'DATABASE_AUTH_TOKEN'])
		);
		// The test secrets are never filled in, so a remote database never runs on them.
		const strong = build({
			...remote,
			DATABASE_AUTH_TOKEN: 'token',
			BETTER_AUTH_SECRET: 'x'.repeat(40),
			COOKIE_SECRET: 'y'.repeat(40)
		});
		expect(strong.core.ok).toBe(true);
		expect(strong.core.authSecret).toBe('x'.repeat(40));
	});
});

describe('without the flag nothing changes', () => {
	it('a file database is still refused in the Demo and production', () => {
		for (const env of [{ DEMO_MODE: 'true' }, { NODE_ENV: 'production' }]) {
			const config = parseConfig({ ...env, ...LOCAL, [LOCAL_PREVIEW_FLAG]: undefined });
			expect(config.localPreview.requested).toBe(false);
			expect(config.core.ok).toBe(false);
			expect(config.core.issues).toContain('DATABASE_URL');
		}
	});

	it('development and test keep their own local defaults', () => {
		expect(parseConfig({ NODE_ENV: 'test' }).localPreview.requested).toBe(false);
		expect(parseConfig({ NODE_ENV: 'development', ...LOCAL }).core.databaseUrl).toBe('file:/tmp/quire-e2e/demo.db');
	});
});

describe('pnpm check:env (the real script)', () => {
	const ROOT = path.resolve(__dirname, '../../..');

	function checkEnv(env: Env) {
		const clean = Object.fromEntries(
			Object.entries(process.env).filter(
				([name]) => !['NETLIFY', 'CONTEXT', 'DEPLOY_URL', 'SITE_ID', 'VITEST', 'NODE_ENV', 'DEMO_MODE'].includes(name)
			)
		);
		const result = spawnSync('node', ['--import', 'tsx', path.join('scripts', 'check-env.ts')], {
			cwd: ROOT,
			encoding: 'utf8',
			env: { ...clean, ...env } as NodeJS.ProcessEnv
		});
		return { status: result.status, output: `${result.stdout}${result.stderr}` };
	}

	it('passes the honored local preview, with a warning', () => {
		const result = checkEnv({ DEMO_MODE: 'true', ...LOCAL });
		expect(result.output).toContain('local e2e preview');
		expect(result.status).toBe(0);
	}, 30000);

	it('rejects the flag with a remote database', () => {
		const result = checkEnv({
			NODE_ENV: 'production',
			[LOCAL_PREVIEW_FLAG]: 'true',
			DATABASE_URL: 'libsql://quire-prod.turso.io',
			DATABASE_AUTH_TOKEN: 'token',
			BETTER_AUTH_SECRET: 'x'.repeat(40),
			COOKIE_SECRET: 'y'.repeat(40),
			BETTER_AUTH_URL: 'https://quire.live'
		});
		expect(result.status).toBe(1);
		expect(result.output).toContain(`${LOCAL_PREVIEW_FLAG} is set but its guards fail: DATABASE_URL is not a file: URL`);
		expect(result.output).not.toContain('quire-prod');
	}, 30000);

	it('rejects the flag on a Netlify build', () => {
		const result = checkEnv({ DEMO_MODE: 'true', ...LOCAL, NETLIFY: 'true', CONTEXT: 'production' });
		expect(result.status).toBe(1);
		expect(result.output).toContain('NETLIFY is set');
	}, 30000);
});
