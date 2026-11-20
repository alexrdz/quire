import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createClient, type Client } from '@libsql/client';
import { createLegacySchema } from '../../fixtures/legacy-schema';
import {
	baselineDatabase,
	diffLiveSchema,
	formatDiff,
	isEmptyDiff,
	latestSnapshot,
	migrationSnapshots
} from '$lib/server/db/baseline';
import { LEGACY_DB_HINT, runMigrations } from '$lib/server/db/migrate';
import { MIGRATIONS_TABLE } from '$lib/server/db/schema-check';
import { readMigrationFiles } from 'drizzle-orm/migrator';

/**
 * PRODUCTION_PLAN 3.5: `db:baseline` on databases built the old way, by the
 * runtime DDL `seed.ts` used to run (copied to tests/fixtures/legacy-schema.ts).
 */
const opened: Array<{ client: Client; dir: string }> = [];

function tempDb(): Client {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quire-baseline-'));
	const client = createClient({ url: `file:${path.join(dir, 'test.db')}` });
	opened.push({ client, dir });
	return client;
}

async function legacyDb(): Promise<Client> {
	const client = tempDb();
	await createLegacySchema(client);
	return client;
}

async function migrationRows(client: Client) {
	const rows = await client.execute(`SELECT hash, created_at FROM ${MIGRATIONS_TABLE} ORDER BY created_at`);
	return rows.rows.map((r) => ({ hash: String(r.hash), createdAt: Number(r.created_at) }));
}

async function schemaSql(client: Client): Promise<string[]> {
	const rows = await client.execute(
		`SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name <> '${MIGRATIONS_TABLE}' ORDER BY name`
	);
	return rows.rows.map((r) => String(r.sql));
}

afterEach(() => {
	while (opened.length > 0) {
		const { client, dir } = opened.pop()!;
		client.close();
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

describe('legacy fixture', () => {
	it('builds the same tables and columns as the migrations', async () => {
		const legacy = await legacyDb();
		const diff = await diffLiveSchema(legacy, latestSnapshot().snapshot);
		expect(formatDiff(diff)).toBe('');
		expect(isEmptyDiff(diff)).toBe(true);
	});

	it('db:migrate refuses it with the baseline hint instead of failing on CREATE TABLE', async () => {
		const legacy = await legacyDb();
		await expect(runMigrations(legacy)).rejects.toThrow(LEGACY_DB_HINT);
	});
});

describe('db:baseline', () => {
	it('when the schema matches: records every migration, then db:migrate has nothing to apply', async () => {
		const legacy = await legacyDb();
		await legacy.execute(
			`INSERT INTO users (id, name, email, created_at, updated_at) VALUES ('u1', 'Kept', 'kept@example.com', 1, 1)`
		);
		const before = await schemaSql(legacy);

		const result = await baselineDatabase(legacy);
		const migrations = readMigrationFiles({ migrationsFolder: path.resolve('drizzle') });
		expect(result).toEqual({
			status: 'baselined',
			matched: latestSnapshot().tag,
			recordedTags: migrationSnapshots().map(({ tag }) => tag),
			pendingTags: [],
			ignoredTables: []
		});

		// The same rows drizzle's migrator writes.
		expect(await migrationRows(legacy)).toEqual(
			migrations.map((m) => ({ hash: m.hash, createdAt: m.folderMillis }))
		);

		const migrated = await runMigrations(legacy);
		expect(migrated).toEqual({ applied: 0, total: migrations.length });
		expect(await migrationRows(legacy)).toHaveLength(migrations.length);
		expect(await schemaSql(legacy)).toEqual(before);
		const kept = await legacy.execute(`SELECT email FROM users WHERE id = 'u1'`);
		expect(kept.rows[0]?.email).toBe('kept@example.com');

		// Running it again is a no-op.
		expect(await baselineDatabase(legacy)).toEqual({ status: 'already-migrated' });
	});

	it.each([
		[
			'a missing column',
			'ALTER TABLE artists DROP COLUMN venmo_username',
			'- column artists.venmo_username (missing from the database)'
		],
		['a missing table', 'DROP TABLE tip_taps', '- table tip_taps (in the migrations, missing from the database)'],
		[
			'an extra table',
			'CREATE TABLE legacy_extras (id text PRIMARY KEY NOT NULL)',
			'+ table legacy_extras (in the database, not in the migrations)'
		],
		[
			'an extra column',
			'ALTER TABLE issues ADD COLUMN legacy_flag integer',
			'+ column issues.legacy_flag (not in the migrations)'
		]
	])('when the schema has %s: refuses with the diff and records nothing', async (_label, alter, line) => {
		const legacy = await legacyDb();
		await legacy.execute(alter);

		const result = await baselineDatabase(legacy);
		expect(result.status).toBe('mismatch');
		if (result.status === 'mismatch') expect(formatDiff(result.diff)).toContain(line);

		const table = await legacy.execute(
			`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${MIGRATIONS_TABLE}'`
		);
		expect(table.rows).toHaveLength(0);
		await expect(runMigrations(legacy)).rejects.toThrow(LEGACY_DB_HINT);
	});

	it('refuses a column whose type or NOT NULL differs', async () => {
		const legacy = tempDb();
		await createLegacySchema(legacy);
		// Rebuild one table with a looser column, as a hand-edited database might have.
		await legacy.batch(
			[
				'DROP TABLE tip_taps',
				`CREATE TABLE tip_taps (id text PRIMARY KEY NOT NULL, artist_id text NOT NULL, issue_id text, amount_selected_cents text, created_at integer NOT NULL)`
			],
			'write'
		);
		const result = await baselineDatabase(legacy);
		expect(result.status).toBe('mismatch');
		if (result.status === 'mismatch') {
			expect(formatDiff(result.diff)).toBe(
				'~ column tip_taps.amount_selected_cents: expected integer NOT NULL, found text'
			);
		}
	});

	it('dry run checks without writing', async () => {
		const legacy = await legacyDb();
		const result = await baselineDatabase(legacy, { dryRun: true });
		expect(result.status).toBe('would-baseline');
		const table = await legacy.execute(
			`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${MIGRATIONS_TABLE}'`
		);
		expect(table.rows).toHaveLength(0);
	});

	it('leaves an empty database to db:migrate, and a migrated one alone', async () => {
		const empty = tempDb();
		expect(await baselineDatabase(empty)).toEqual({ status: 'empty' });

		const fresh = tempDb();
		const migrated = await runMigrations(fresh);
		expect(migrated.applied).toBe(migrated.total);
		expect(await baselineDatabase(fresh)).toEqual({ status: 'already-migrated' });
		// A database built by migrations matches the snapshot too.
		expect(isEmptyDiff(await diffLiveSchema(fresh, latestSnapshot().snapshot))).toBe(true);
	});
});

describe('pnpm db:baseline and pnpm db:migrate (the real scripts)', () => {
	const ROOT = path.resolve(__dirname, '../../..');

	function run(script: 'db-baseline.ts' | 'db-migrate.ts', url: string) {
		const result = spawnSync('node', ['--import', 'tsx', path.join('scripts', script)], {
			cwd: ROOT,
			encoding: 'utf8',
			// Test mode keeps a file: URL, so the scripts work on the temp database, never local.db.
			env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: url, CONTEXT: '' }
		});
		return { status: result.status, output: `${result.stdout}${result.stderr}` };
	}

	async function legacyFile(): Promise<{ client: Client; url: string }> {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quire-baseline-cli-'));
		const url = `file:${path.join(dir, 'legacy.db')}`;
		const client = createClient({ url });
		opened.push({ client, dir });
		await createLegacySchema(client);
		return { client, url };
	}

	it('matching schema: baseline records the migrations, then migrate has nothing to apply', async () => {
		const { url } = await legacyFile();
		const total = readMigrationFiles({ migrationsFolder: path.join(ROOT, 'drizzle') }).length;

		const baseline = run('db-baseline.ts', url);
		expect(baseline.output).toContain(`schema matches ${latestSnapshot().tag}; recorded 0000–0004; db:migrate then has nothing to apply`);
		expect(baseline.output).toContain(`recorded ${total} migrations as applied`);
		expect(baseline.status).toBe(0);

		const migrate = run('db-migrate.ts', url);
		expect(migrate.output).toContain(`up to date (${total} migrations)`);
		expect(migrate.status).toBe(0);
	}, 60000);

	it('altered schema: baseline refuses with the diff and exits non-zero', async () => {
		const { client, url } = await legacyFile();
		await client.execute('ALTER TABLE artists DROP COLUMN venmo_username');

		const baseline = run('db-baseline.ts', url);
		expect(baseline.status).toBe(1);
		expect(baseline.output).toContain('refused: the schema does not match any migration; closest is 0004_venmo_tips');
		expect(baseline.output).toContain('- column artists.venmo_username (missing from the database)');

		const migrate = run('db-migrate.ts', url);
		expect(migrate.status).toBe(1);
		expect(migrate.output).toContain('pnpm db:baseline');
	}, 60000);
});
