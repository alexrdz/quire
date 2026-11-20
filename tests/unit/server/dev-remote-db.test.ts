import fs from 'node:fs';

import path from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createClient, type Client } from '@libsql/client';
import {
	databaseHost,
	devRemoteDatabaseWarning,
	parseConfig,
	resetConfigForTests,
	sampleDataRefusal,
	type Env
} from '$lib/server/config';

/**
 * B1-T10: the user's .env pointed DATABASE_URL at the production Turso database,
 * so `pnpm dev` would have seeded sample data into production. Development now
 * seeds only a file: database and warns at startup about a remote one. The Demo
 * still seeds its own remote database.
 */

const TOKEN = 'eyJ-super-secret-token-value';
const REMOTE = 'libsql://quire-prod-alex.turso.io';
const SECRETS: Env = {
	BETTER_AUTH_SECRET: 'a'.repeat(40),
	COOKIE_SECRET: 'b'.repeat(40),
	BETTER_AUTH_URL: 'https://quire.example'
};

const devRemote: Env = { NODE_ENV: 'development', DATABASE_URL: REMOTE, DATABASE_AUTH_TOKEN: TOKEN };
const devRemoteFlag: Env = { ...devRemote, QUIRE_DEV_REMOTE_DB: 'true' };
const devFile: Env = { NODE_ENV: 'development', DATABASE_URL: 'file:local.db' };
const demoRemote: Env = { ...SECRETS, NODE_ENV: 'production', DEMO_MODE: 'true', DATABASE_URL: REMOTE, DATABASE_AUTH_TOKEN: TOKEN };

describe('config: development against a remote database', () => {
	it('dev + file: no remote database, seeding allowed, no warning', () => {
		for (const env of [devFile, { NODE_ENV: 'development' }]) {
			const config = parseConfig(env);
			expect(config.devRemoteDatabase).toBeNull();
			expect(sampleDataRefusal(config)).toBeNull();
			expect(devRemoteDatabaseWarning(config)).toBeNull();
		}
	});

	it.each(['libsql://db.turso.io', 'https://db.turso.io', 'wss://db.turso.io'])(
		'dev + %s: refuses to seed, says to use file:local.db and names the flag',
		(url) => {
			const config = parseConfig({ ...devRemote, DATABASE_URL: url });
			expect(config.devRemoteDatabase).toEqual({ host: url, acknowledged: false });
			const refusal = sampleDataRefusal(config)!;
			expect(refusal).toContain('looks like a remote database');
			expect(refusal).toContain('DATABASE_URL=file:local.db');
			expect(refusal).toContain('QUIRE_DEV_REMOTE_DB=true');
		}
	);

	it('dev + remote + QUIRE_DEV_REMOTE_DB=true: acknowledged, and still never seeds', () => {
		const config = parseConfig(devRemoteFlag);
		expect(config.devRemoteDatabase).toEqual({ host: REMOTE, acknowledged: true });
		expect(sampleDataRefusal(config)).toContain('only ever seeded into a file: database');
		expect(devRemoteDatabaseWarning(config)).toContain('QUIRE_DEV_REMOTE_DB=true');
	});

	it('the startup warning names the host only, never the token or the query', () => {
		const url = `${REMOTE}/?authToken=${TOKEN}`;
		const config = parseConfig({ ...devRemote, DATABASE_URL: url });
		const warning = devRemoteDatabaseWarning(config)!;
		expect(warning).toBe(
			`[config] Development mode is using a remote database: ${REMOTE}. Reads and writes go to it, not to local.db. For local work set DATABASE_URL=file:local.db.`
		);
		for (const text of [warning, sampleDataRefusal(config)!]) {
			expect(text).not.toContain(TOKEN);
			expect(text).not.toContain('authToken');
		}
		expect(databaseHost('file:local.db')).toBe('file:local.db');
		expect(databaseHost('not a url')).toBe('(unparseable DATABASE_URL)');
	});

	it('demo + remote: unchanged, the Demo seeds its own remote database', () => {
		const config = parseConfig(demoRemote);
		expect(config.mode).toBe('demo');
		expect(config.devRemoteDatabase).toBeNull();
		expect(sampleDataRefusal(config)).toBeNull();
		expect(devRemoteDatabaseWarning(config)).toBeNull();
	});

	it('production and test never report a dev remote database', () => {
		expect(parseConfig({ ...SECRETS, NODE_ENV: 'production', DATABASE_URL: REMOTE, DATABASE_AUTH_TOKEN: TOKEN }).devRemoteDatabase).toBeNull();
		// Test mode always uses file:local.db.
		expect(parseConfig({ NODE_ENV: 'test', DATABASE_URL: REMOTE }).devRemoteDatabase).toBeNull();
	});
});

// seedDatabase on real file databases. The db module is a client that forwards
// to `state.current`, so each case gets its own fresh database; the URL in the
// stubbed env only decides what the config believes.
const state = vi.hoisted(() => {
	const nodeFs = require('node:fs') as typeof import('node:fs');
	const nodeOs = require('node:os') as typeof import('node:os');
	const nodePath = require('node:path') as typeof import('node:path');
	return {
		dir: nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'quire-dev-remote-')),
		current: null as Client | null
	};
});

vi.mock('$lib/server/db', async () => {
	const { drizzle } = await import('drizzle-orm/libsql');
	const dbSchema = await import('$lib/server/db/schema');
	const client = new Proxy({} as Client, {
		get(_target, prop) {
			const current = state.current;
			if (!current) throw new Error('no test database');
			const value = (current as unknown as Record<string | symbol, unknown>)[prop];
			return typeof value === 'function' ? value.bind(current) : value;
		}
	});
	return { client, db: drizzle(client, { schema: dbSchema }), schema: dbSchema };
});

let counter = 0;
async function freshDatabase(): Promise<Client> {
	const client = createClient({ url: `file:${path.join(state.dir, `db-${counter++}.db`)}` });
	const { runMigrations } = await import('$lib/server/db/migrate');
	await runMigrations(client);
	state.current = client;
	return client;
}

async function artistCount(client: Client): Promise<number> {
	const result = await client.execute('SELECT count(*) AS n FROM artists');
	return Number(result.rows[0]!.n);
}

function stubEnv(env: Env) {
	vi.stubEnv('VITEST', '');
	for (const name of ['NODE_ENV', 'DEMO_MODE', 'DATABASE_URL', 'DATABASE_AUTH_TOKEN', 'QUIRE_DEV_REMOTE_DB', 'BETTER_AUTH_SECRET', 'COOKIE_SECRET', 'BETTER_AUTH_URL']) {
		vi.stubEnv(name, env[name] ?? '');
	}
	resetConfigForTests();
}

afterEach(() => {
	vi.unstubAllEnvs();
	resetConfigForTests();
	state.current?.close();
	state.current = null;
});

afterAll(() => {
	fs.rmSync(state.dir, { recursive: true, force: true });
});

describe('seedDatabase', () => {
	it('dev + remote: refuses with the message and writes nothing', async () => {
		const client = await freshDatabase();
		stubEnv(devRemote);
		const { seedDatabase } = await import('$lib/server/seed');
		await expect(seedDatabase()).rejects.toThrow(/looks like a remote database \(libsql:\/\/quire-prod-alex\.turso\.io\)/);
		expect(await artistCount(client)).toBe(0);
	});

	it('dev + remote + QUIRE_DEV_REMOTE_DB=true: still refuses and writes nothing', async () => {
		const client = await freshDatabase();
		stubEnv(devRemoteFlag);
		const { seedDatabase } = await import('$lib/server/seed');
		await expect(seedDatabase()).rejects.toThrow(/only ever seeded into a file: database/);
		expect(await artistCount(client)).toBe(0);
	});

	it('dev + file: seeds as before', async () => {
		const client = await freshDatabase();
		stubEnv(devFile);
		const { seedDatabase } = await import('$lib/server/seed');
		await seedDatabase();
		expect(await artistCount(client)).toBe(1);
	});

	it('demo + remote: seeds as before', async () => {
		const client = await freshDatabase();
		stubEnv(demoRemote);
		const { seedDatabase } = await import('$lib/server/seed');
		await seedDatabase();
		expect(await artistCount(client)).toBe(1);
	});
});

