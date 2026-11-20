import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseConfig, type Env } from '$lib/server/config';
import { migrationPlanFor } from '$lib/server/db/migrate';

/**
 * PRODUCTION_PLAN 4.1: .env.example lists every environment variable the app
 * reads, and nothing else (Stripe's dormant group excepted, ADR 0008).
 *
 * The names come from what the code actually reads, not from grepping it: each
 * reader is handed an env object that records every property read, and is run
 * through every mode and branch. `scripts/check-env.ts` reads only through
 * `parseConfig`, so it is covered by the same recording.
 */

const ENV_EXAMPLE = path.resolve(__dirname, '../../../.env.example');
const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;
const STRIPE_SECTION = 'Stripe';

/** An env whose reads are recorded into `seen`. */
function recordingEnv(values: Env, seen: Set<string>): Env {
	return new Proxy(values, {
		get(target, key) {
			if (typeof key === 'string' && ENV_NAME.test(key)) seen.add(key);
			return typeof key === 'string' ? target[key] : undefined;
		},
		has(target, key) {
			if (typeof key === 'string' && ENV_NAME.test(key)) seen.add(key);
			return typeof key === 'string' && key in target;
		}
	});
}

const SECRET = 'a'.repeat(40);
const OTHER_SECRET = 'b'.repeat(40);
const FULL: Env = {
	BETTER_AUTH_SECRET: SECRET,
	COOKIE_SECRET: OTHER_SECRET,
	DATABASE_URL: 'libsql://quire-test.turso.io',
	DATABASE_AUTH_TOKEN: 'token',
	BETTER_AUTH_URL: 'https://quire.example',
	RESEND_API_KEY: 're_x',
	GOOGLE_CLIENT_ID: 'id',
	GOOGLE_CLIENT_SECRET: 'secret',
	R2_ACCOUNT_ID: 'acct',
	R2_ACCESS_KEY_ID: 'key',
	R2_SECRET_ACCESS_KEY: 'secret',
	STRIPE_SECRET_KEY: 'sk_test_x',
	STRIPE_WEBHOOK_SECRET: 'whsec_x',
	STRIPE_PUBLISHABLE_KEY: 'pk_test_x'
};

/** Every mode, with an empty env and a full one, so every branch reads its keys. */
const SCENARIOS: Env[] = [
	{},
	{ NODE_ENV: 'development' },
	{ NODE_ENV: 'test' },
	{ VITEST: 'true' },
	{ DEMO_MODE: 'true' },
	{ NODE_ENV: 'production' },
	{ ...FULL, NODE_ENV: 'development', DATABASE_URL: 'libsql://dev.turso.io' },
	{ ...FULL, DEMO_MODE: 'true' },
	{ ...FULL, NODE_ENV: 'production' },
	{ ...FULL, NODE_ENV: 'production', BETTER_AUTH_URL: undefined, PUBLIC_APP_URL: 'https://quire.example' },
	// The local e2e preview flag and its guards (P4L-T03).
	{ DEMO_MODE: 'true', QUIRE_E2E_LOCAL_PREVIEW: 'true', DATABASE_URL: 'file:e2e.db', BETTER_AUTH_URL: 'http://localhost:4174' },
	{ NODE_ENV: 'production', QUIRE_E2E_LOCAL_PREVIEW: 'true', DATABASE_URL: 'libsql://x.turso.io' }
];

/** Netlify contexts the migration script handles (scripts/db-migrate.ts, PRODUCTION_PLAN 3.5). */
const MIGRATION_SCENARIOS: Env[] = [
	{},
	{ CONTEXT: 'production' },
	{ CONTEXT: 'deploy-preview' },
	{ CONTEXT: 'branch-deploy', PREVIEW_DATABASE_URL: 'libsql://preview.turso.io', DATABASE_URL: 'libsql://preview.turso.io' },
	{ CONTEXT: 'deploy-preview', PREVIEW_DATABASE_URL: 'libsql://preview.turso.io', DATABASE_URL: 'libsql://prod.turso.io' }
];

function configKeys(): Set<string> {
	const seen = new Set<string>();
	for (const scenario of SCENARIOS) parseConfig(recordingEnv({ ...scenario }, seen));
	// db-migrate.ts reads the database through parseConfig, plus the plan's own keys.
	for (const scenario of MIGRATION_SCENARIOS) {
		migrationPlanFor(recordingEnv({ ...scenario }, seen));
		migrationPlanFor(recordingEnv({ ...scenario }, seen), { preview: true });
	}
	return seen;
}

/** drizzle.config.ts reads process.env at import; record it without loading any real .env. */
async function drizzleConfigKeys(): Promise<Set<string>> {
	const seen = new Set<string>();
	const realEnv = process.env;
	// Load drizzle-kit first, so only drizzle.config.ts's own reads are recorded,
	// not the library's module setup.
	await import('drizzle-kit');
	const loadEnvFile = vi.spyOn(process, 'loadEnvFile').mockImplementation(() => undefined);
	try {
		process.env = recordingEnv({ DATABASE_URL: 'libsql://x.turso.io', DATABASE_AUTH_TOKEN: 't' }, seen) as NodeJS.ProcessEnv;
		await import('../../../drizzle.config');
	} finally {
		process.env = realEnv;
		loadEnvFile.mockRestore();
	}
	return seen;
}

interface ExampleEntry {
	name: string;
	value: string;
	commented: boolean;
	section: string;
}

/** Parses `NAME=value` lines, and `# NAME=` lines for tooling-set variables, by section. */
function parseEnvExample(text: string): ExampleEntry[] {
	const entries: ExampleEntry[] = [];
	let section = '';
	const lines = text.split('\n');
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!.trim();
		// A section title is a comment line between two "# ----" rules.
		const rule = (n: number) => /^# -{10,}$/.test(lines[n]?.trim() ?? '');
		if (rule(i - 1) && rule(i + 1) && /^# \w/.test(line)) {
			section = line.slice(2).split(':')[0]!.trim();
			continue;
		}
		const match = /^(#\s*)?([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
		if (match) {
			entries.push({ name: match[2]!, value: match[3]!.trim(), commented: Boolean(match[1]), section });
		}
	}
	return entries;
}

/** What is wrong with an .env.example given the names the code reads. */
function diffEnvExample(text: string, read: Set<string>): { missing: string[]; unknown: string[] } {
	const entries = parseEnvExample(text);
	const listed = new Set(entries.map((e) => e.name));
	return {
		missing: [...read].filter((name) => !listed.has(name)).sort(),
		unknown: entries
			.filter((e) => !read.has(e.name) && e.section !== STRIPE_SECTION)
			.map((e) => e.name)
			.sort()
	};
}

const exampleText = fs.readFileSync(ENV_EXAMPLE, 'utf8');

afterEach(() => {
	vi.restoreAllMocks();
});

describe('4.1 .env.example matches what the app reads', () => {
	it('the recording finds the env names the config reads', () => {
		const keys = configKeys();
		// Sanity: one name from each tier, so a broken recorder cannot pass vacuously.
		for (const name of ['DEMO_MODE', 'NODE_ENV', 'DATABASE_URL', 'BETTER_AUTH_SECRET', 'RESEND_API_KEY', 'R2_PUBLIC_URL']) {
			expect(keys.has(name), name).toBe(true);
		}
	});

	it('lists every variable config.ts, check-env.ts, db-migrate.ts and drizzle.config.ts read, and nothing else', async () => {
		const drizzleKeys = await drizzleConfigKeys();
		expect([...drizzleKeys].sort()).toEqual(['DATABASE_AUTH_TOKEN', 'DATABASE_URL']);
		const read = new Set([...configKeys(), ...drizzleKeys]);
		expect(diffEnvExample(exampleText, read)).toEqual({ missing: [], unknown: [] });
	});

	it('fails when a line is deleted or an unknown variable is added', () => {
		const read = configKeys();
		const withoutDemoMode = exampleText.replace(/^DEMO_MODE=.*\n/m, '');
		expect(diffEnvExample(withoutDemoMode, read).missing).toEqual(['DEMO_MODE']);

		const withUnknown = exampleText.replace(/^DEMO_MODE=.*$/m, '$&\nQUIRE_NOT_A_REAL_SETTING=');
		expect(diffEnvExample(withUnknown, read).unknown).toEqual(['QUIRE_NOT_A_REAL_SETTING']);
	});

	it('keeps the Stripe keys in their own dormant group, which may list keys nothing reads', () => {
		const entries = parseEnvExample(exampleText);
		const stripe = entries.filter((e) => e.name.startsWith('STRIPE_'));
		expect(stripe.length).toBeGreaterThan(0);
		expect(stripe.every((e) => e.section === STRIPE_SECTION)).toBe(true);
		expect(exampleText).toContain('Stripe: dormant and optional (ADR 0008), nothing reads them for tips');

		const withExtraStripe = exampleText.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m, '$&\nSTRIPE_CONNECT_CLIENT_ID=');
		expect(diffEnvExample(withExtraStripe, configKeys()).unknown).toEqual([]);
	});

	it('groups variables by tier: mode, core, features, Stripe', () => {
		const sectionOf = new Map(parseEnvExample(exampleText).map((e) => [e.name, e.section]));
		expect(sectionOf.get('QUIRE_E2E_LOCAL_PREVIEW')).toBe('Test only, never set on a deployed site');
		expect(sectionOf.get('DEMO_MODE')).toBe('Mode');
		expect(sectionOf.get('NODE_ENV')).toBe('Mode');
		for (const name of ['DATABASE_URL', 'DATABASE_AUTH_TOKEN', 'BETTER_AUTH_SECRET', 'COOKIE_SECRET', 'BETTER_AUTH_URL']) {
			expect(sectionOf.get(name), name).toBe('Core');
		}
		for (const name of ['RESEND_API_KEY', 'GOOGLE_CLIENT_ID', 'R2_ACCOUNT_ID']) {
			expect(sectionOf.get(name), name).toBe('Features');
		}
	});

	it('holds no values: every variable is an empty placeholder', () => {
		const withValues = parseEnvExample(exampleText).filter((e) => e.value !== '');
		expect(withValues).toEqual([]);
	});

	it('leaves tooling-set variables commented out, so copying it never overrides them', () => {
		const entries = parseEnvExample(exampleText);
		for (const name of ['NODE_ENV', 'VITEST', 'CONTEXT', 'NETLIFY', 'DEPLOY_URL', 'SITE_ID']) {
			expect(entries.find((e) => e.name === name)?.commented, name).toBe(true);
		}
	});

	it('an .env copied straight from it is a working development config', () => {
		const copied: Env = { NODE_ENV: 'development' };
		for (const e of parseEnvExample(exampleText)) if (!e.commented) copied[e.name] = e.value;
		const config = parseConfig(copied);
		expect(config.mode).toBe('development');
		expect(config.core.ok).toBe(true);
		expect(config.core.databaseUrl).toBe('file:local.db');
		expect(config.core.appUrl).toBe('http://localhost:5173');
	});
});
