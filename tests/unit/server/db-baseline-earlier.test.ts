import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createClient, type Client } from '@libsql/client';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import {
	baselineDatabase,
	diffLiveSchema,
	formatDiff,
	isEmptyDiff,
	latestSnapshot,
	migrationSnapshots,
	tagRange
} from '$lib/server/db/baseline';
import { LEGACY_DB_HINT, runMigrations } from '$lib/server/db/migrate';
import {
	DEV_SCHEMA_MISSING_HINT,
	MIGRATIONS_TABLE,
	SCHEMA_MISSING_HINT,
	schemaMissingHint
} from '$lib/server/db/schema-check';

/**
 * B1-T08: `db:baseline` on a database the old runtime DDL built before the
 * latest migration, like the user's Turso database: it matches 0002 and has a
 * `posts` table that is not Quire's. Baseline records 0000-0002 only, and
 * `db:migrate` applies 0003 and 0004. `posts` and its rows are never touched.
 */

const ROOT = path.resolve(__dirname, '../../..');
const DRIZZLE = path.join(ROOT, 'drizzle');
const ALL_TAGS = migrationSnapshots(DRIZZLE).map(({ tag }) => tag);
const AT_0002 = ['0000_friendly_centennial', '0001_sharp_zaran', '0002_schema_catch_up'];
const AFTER_0002 = ['0003_rate_limits', '0004_venmo_tips'];

const cleanup: Array<{ client: Client; dir: string }> = [];

afterEach(() => {
	while (cleanup.length > 0) {
		const { client, dir } = cleanup.pop()!;
		client.close();
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

/** A copy of drizzle/ whose journal ends at `lastIdx`, to build a database at that migration. */
function migrationsUpTo(lastIdx: number, dir: string): string {
	const folder = path.join(dir, 'drizzle');
	fs.cpSync(DRIZZLE, folder, { recursive: true });
	const journalFile = path.join(folder, 'meta', '_journal.json');
	const journal = JSON.parse(fs.readFileSync(journalFile, 'utf8')) as { entries: Array<{ idx: number }> };
	journal.entries = journal.entries.filter((entry) => entry.idx <= lastIdx);
	fs.writeFileSync(journalFile, JSON.stringify(journal));
	return folder;
}

/**
 * A file database with the schema of migration `lastIdx` and no migration
 * history, as the old runtime DDL left it. With `posts`, it also has another
 * app's table with two rows.
 */
async function databaseAt(lastIdx: number, options: { posts?: boolean } = {}): Promise<{ client: Client; url: string }> {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quire-baseline-earlier-'));
	const url = `file:${path.join(dir, 'old.db')}`;
	const client = createClient({ url });
	cleanup.push({ client, dir });
	await runMigrations(client, migrationsUpTo(lastIdx, dir));
	await client.execute(`DROP TABLE ${MIGRATIONS_TABLE}`);
	if (options.posts) {
		await client.batch(
			[
				'CREATE TABLE posts (id integer PRIMARY KEY, title text NOT NULL, body text)',
				`INSERT INTO posts (id, title, body) VALUES (1, 'Hello', 'First post'), (2, 'Again', NULL)`
			],
			'write'
		);
	}
	return { client, url };
}

async function postsState(client: Client) {
	const schemaRow = await client.execute(`SELECT sql FROM sqlite_master WHERE name = 'posts'`);
	const rows = await client.execute('SELECT id, title, body FROM posts ORDER BY id');
	return { sql: String(schemaRow.rows[0]?.sql), rows: rows.rows.map((r) => ({ ...r })) };
}

async function historyTable(client: Client) {
	const table = await client.execute(
		`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${MIGRATIONS_TABLE}'`
	);
	if (table.rows.length === 0) return null;
	const rows = await client.execute(`SELECT hash, created_at FROM ${MIGRATIONS_TABLE} ORDER BY created_at`);
	return rows.rows.map((r) => ({ hash: String(r.hash), createdAt: Number(r.created_at) }));
}

async function tableNames(client: Client): Promise<string[]> {
	const rows = await client.execute(
		`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
	);
	return rows.rows.map((r) => String(r.name));
}

async function allRows(client: Client, tables: string[]): Promise<Record<string, Array<Record<string, unknown>>>> {
	const out: Record<string, Array<Record<string, unknown>>> = {};
	for (const table of tables) {
		const rows = await client.execute(`SELECT * FROM \`${table}\` ORDER BY rowid`);
		out[table] = rows.rows.map((r) => ({ ...r }));
	}
	return out;
}

/** Every table and index, by name, with its SQL. */
async function objectSql(client: Client): Promise<Record<string, string>> {
	const rows = await client.execute(`SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'`);
	return Object.fromEntries(rows.rows.map((r) => [String(r.name), String(r.sql)]));
}

describe('the test databases', () => {
	it('a database built at 0002 matches the 0002 snapshot and not the latest', async () => {
		const { client } = await databaseAt(2);
		const snapshots = migrationSnapshots(DRIZZLE);
		expect(isEmptyDiff(await diffLiveSchema(client, snapshots[2]!.snapshot))).toBe(true);
		const toLatest = formatDiff(await diffLiveSchema(client, latestSnapshot(DRIZZLE).snapshot));
		for (const line of [
			'- table auth_rate_limits',
			'- table rate_limits',
			'- table tip_taps',
			'- table venmo_change_tokens',
			'- column artists.venmo_username'
		]) {
			expect(toLatest).toContain(line);
		}
	});
});

describe('db:baseline on a database at an earlier migration', () => {
	it('0002 + posts, dry run with posts allowed: plans 0000–0002, leaves 0003 and 0004, writes nothing', async () => {
		const { client } = await databaseAt(2, { posts: true });
		const postsBefore = await postsState(client);

		const result = await baselineDatabase(client, { dryRun: true, allowExtra: ['posts'] });
		expect(result).toEqual({
			status: 'would-baseline',
			matched: '0002_schema_catch_up',
			recordedTags: AT_0002,
			pendingTags: AFTER_0002,
			ignoredTables: ['posts']
		});
		expect(await historyTable(client)).toBeNull();
		expect(await postsState(client)).toEqual(postsBefore);
	});

	it('0002 + posts, posts allowed: records exactly 0000–0002, then db:migrate applies 0003 and 0004', async () => {
		const { client } = await databaseAt(2, { posts: true });
		const postsBefore = await postsState(client);

		const result = await baselineDatabase(client, { allowExtra: ['posts'] });
		expect(result.status).toBe('baselined');
		const migrations = readMigrationFiles({ migrationsFolder: DRIZZLE });
		expect(await historyTable(client)).toEqual(
			migrations.slice(0, 3).map((m) => ({ hash: m.hash, createdAt: m.folderMillis }))
		);

		expect(await runMigrations(client)).toEqual({ applied: 2, total: migrations.length });
		expect(await historyTable(client)).toEqual(migrations.map((m) => ({ hash: m.hash, createdAt: m.folderMillis })));

		// Now it matches the latest migration, apart from posts.
		const diff = await diffLiveSchema(client, latestSnapshot(DRIZZLE).snapshot);
		expect(diff.extraTables).toEqual(['posts']);
		expect(formatDiff({ ...diff, extraTables: [] })).toBe('');
		expect(await postsState(client)).toEqual(postsBefore);

		expect(await baselineDatabase(client, { allowExtra: ['posts'] })).toEqual({ status: 'already-migrated' });
	});

	it('baseline then migrate write only the history and the 0003/0004 schema: no data row changes', async () => {
		const { client } = await databaseAt(2, { posts: true });
		// Production-like data in Quire's tables too.
		await client.batch(
			[
				`INSERT INTO users (id, name, email, created_at, updated_at) VALUES ('u1', 'Artist', 'artist@example.com', 1, 1)`,
				`INSERT INTO artists (id, user_id, slug, display_name, created_at, updated_at) VALUES ('a1', 'u1', 'band', 'Band', 1, 1)`
			],
			'write'
		);
		const tablesBefore = await tableNames(client);
		const rowsBefore = await allRows(client, tablesBefore);
		const sqlBefore = await objectSql(client);

		await baselineDatabase(client, { allowExtra: ['posts'] });
		await runMigrations(client);

		// Every row that was there is still there, unchanged; no table gained a row.
		const rowsAfter = await allRows(client, tablesBefore);
		for (const table of tablesBefore) {
			const before = rowsBefore[table]!;
			const after = rowsAfter[table]!;
			expect(after.length, table).toBe(before.length);
			// 0004 adds artists.venmo_username (NULL); every column that existed keeps its value.
			after.forEach((row, i) => expect(row, table).toMatchObject(before[i]!));
		}
		expect(rowsAfter.artists![0]!.venmo_username).toBeNull();

		// Schema changes: exactly what 0003 and 0004 create, plus the ALTER on artists.
		const sqlAfter = await objectSql(client);
		const added = Object.keys(sqlAfter).filter((name) => !(name in sqlBefore)).sort();
		expect(added).toEqual(
			[
				MIGRATIONS_TABLE,
				'auth_rate_limits',
				'auth_rate_limits_key_unique',
				'rate_limits',
				'rate_limits_expires_at_idx',
				'tip_taps',
				'tip_taps_artist_issue_idx',
				'venmo_change_tokens',
				'venmo_change_tokens_artist_idx',
				'venmo_change_tokens_expires_at_idx',
				'venmo_change_tokens_token_hash_unique'
			].sort()
		);
		const changed = Object.keys(sqlBefore).filter((name) => sqlAfter[name] !== sqlBefore[name]);
		expect(changed).toEqual(['artists']);
		// The new tables are empty: the migrations wrote no data.
		for (const table of ['auth_rate_limits', 'rate_limits', 'tip_taps', 'venmo_change_tokens']) {
			const count = await client.execute(`SELECT count(*) AS n FROM ${table}`);
			expect(Number(count.rows[0]!.n), table).toBe(0);
		}
	});

	it('0002 + posts without --allow-extra: refuses, lists posts, closest is 0002, writes nothing', async () => {
		const { client } = await databaseAt(2, { posts: true });
		const postsBefore = await postsState(client);

		const result = await baselineDatabase(client);
		expect(result.status).toBe('mismatch');
		if (result.status === 'mismatch') {
			expect(result.closest).toBe('0002_schema_catch_up');
			expect(formatDiff(result.diff)).toBe('+ table posts (in the database, not in the migrations)');
		}
		expect(await historyTable(client)).toBeNull();
		expect(await postsState(client)).toEqual(postsBefore);
		await expect(runMigrations(client)).rejects.toThrow(LEGACY_DB_HINT);
	});

	it('0002 without extras baselines without any option', async () => {
		const { client } = await databaseAt(2);
		const result = await baselineDatabase(client, { dryRun: true });
		expect(result).toMatchObject({ status: 'would-baseline', matched: '0002_schema_catch_up', pendingTags: AFTER_0002 });
	});

	it('a database at 0004 baselines as before, with or without posts allowed', async () => {
		const plain = await databaseAt(4);
		expect(await baselineDatabase(plain.client)).toEqual({
			status: 'baselined',
			matched: '0004_venmo_tips',
			recordedTags: ALL_TAGS,
			pendingTags: [],
			ignoredTables: []
		});
		expect((await runMigrations(plain.client)).applied).toBe(0);

		const withPosts = await databaseAt(4, { posts: true });
		const postsBefore = await postsState(withPosts.client);
		expect(await baselineDatabase(withPosts.client, { allowExtra: ['posts'] })).toMatchObject({
			status: 'baselined',
			matched: '0004_venmo_tips',
			ignoredTables: ['posts']
		});
		expect(await postsState(withPosts.client)).toEqual(postsBefore);
	});

	it('when nothing matches, refuses with the diff against the closest migration', async () => {
		const { client } = await databaseAt(2);
		await client.execute('ALTER TABLE issues DROP COLUMN archived_at');
		const result = await baselineDatabase(client);
		expect(result.status).toBe('mismatch');
		if (result.status === 'mismatch') {
			expect(result.closest).toBe('0002_schema_catch_up');
			expect(result.forced).toBe(false);
			expect(formatDiff(result.diff)).toBe('- column issues.archived_at (missing from the database)');
		}
		expect(await historyTable(client)).toBeNull();
	});
});

describe('--to', () => {
	it('forces a migration by tag or number, which still has to match exactly', async () => {
		const { client } = await databaseAt(2, { posts: true });
		for (const to of ['0002_schema_catch_up', '0002']) {
			expect(await baselineDatabase(client, { dryRun: true, to, allowExtra: ['posts'] })).toMatchObject({
				status: 'would-baseline',
				matched: '0002_schema_catch_up'
			});
		}

		const forced = await baselineDatabase(client, { to: '0004_venmo_tips', allowExtra: ['posts'] });
		expect(forced.status).toBe('mismatch');
		if (forced.status === 'mismatch') {
			expect(forced).toMatchObject({ closest: '0004_venmo_tips', forced: true });
			expect(formatDiff(forced.diff)).toContain('- table tip_taps (in the migrations, missing from the database)');
		}
		expect(await historyTable(client)).toBeNull();
	});

	it('refuses an unknown migration', async () => {
		const { client } = await databaseAt(2);
		const result = await baselineDatabase(client, { to: '0009_nope' });
		expect(result.status).toBe('invalid-option');
		if (result.status === 'invalid-option') expect(result.message).toContain('0002_schema_catch_up');
	});
});

describe('--allow-extra', () => {
	it('refuses a Quire table, which a later migration would create', async () => {
		const { client } = await databaseAt(2);
		const result = await baselineDatabase(client, { allowExtra: ['posts', 'tip_taps'] });
		expect(result).toEqual({
			status: 'invalid-option',
			message: '--allow-extra only takes tables that are in no Quire migration; tip_taps is Quire\'s.'
		});
		expect(await historyTable(client)).toBeNull();
	});

	it('reports only allowed tables that exist', async () => {
		const { client } = await databaseAt(2);
		expect(await baselineDatabase(client, { dryRun: true, allowExtra: ['posts'] })).toMatchObject({
			status: 'would-baseline',
			ignoredTables: []
		});
	});
});

describe('tagRange', () => {
	it('prints the recorded range', () => {
		expect(tagRange(AT_0002)).toBe('0000–0002');
		expect(tagRange(['0000_friendly_centennial'])).toBe('0000');
		expect(tagRange([])).toBe('');
	});
});

describe('pnpm db:baseline and pnpm db:migrate on a 0002 database with posts (the real scripts)', () => {
	function run(script: 'db-baseline.ts' | 'db-migrate.ts', url: string, args: string[] = []) {
		const result = spawnSync('node', ['--import', 'tsx', path.join('scripts', script), ...args], {
			cwd: ROOT,
			encoding: 'utf8',
			// Test mode keeps a file: URL, so the scripts work on the temp database, never local.db.
			env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: url, CONTEXT: '' }
		});
		return { status: result.status, output: `${result.stdout}${result.stderr}` };
	}

	it('dry run, then without --yes, then with --yes, then migrate: posts untouched throughout', async () => {
		const { client, url } = await databaseAt(2, { posts: true });
		const postsBefore = await postsState(client);
		const host = `database ${url}`;
		const plan = [
			'schema matches 0002_schema_catch_up; will record 0000–0002; db:migrate then applies 0003, 0004',
			`  database:           ${url}`,
			'  matches:            0002_schema_catch_up',
			'  will record:        0000_friendly_centennial, 0001_sharp_zaran, 0002_schema_catch_up',
			'  db:migrate applies: 0003_rate_limits, 0004_venmo_tips',
			'  ignored, untouched: posts',
			'  writes:             only the migration history table, __drizzle_migrations'
		];

		const dry = run('db-baseline.ts', url, ['--dry-run', '--allow-extra', 'posts']);
		expect(dry.status).toBe(0);
		expect(dry.output).toContain(host);
		for (const line of plan) expect(dry.output).toContain(line);
		expect(dry.output).toContain('dry run: nothing was written');
		expect(await historyTable(client)).toBeNull();

		// Without --yes: the same plan, then it stops with nothing written.
		const unconfirmed = run('db-baseline.ts', url, ['--allow-extra', 'posts']);
		expect(unconfirmed.status).toBe(1);
		for (const line of plan) expect(unconfirmed.output).toContain(line);
		expect(unconfirmed.output).toContain('nothing was written');
		expect(unconfirmed.output).toContain('--yes');
		expect(await historyTable(client)).toBeNull();

		const baseline = run('db-baseline.ts', url, ['--allow-extra=posts', '--yes']);
		expect(baseline.status).toBe(0);
		for (const line of plan) expect(baseline.output).toContain(line);
		expect(baseline.output).toContain(
			'recorded 3 migrations as applied (0000–0002). Next: pnpm db:migrate, which applies 0003_rate_limits, 0004_venmo_tips.'
		);
		expect(await historyTable(client)).toHaveLength(3);

		const migrate = run('db-migrate.ts', url);
		expect(migrate.status).toBe(0);
		expect(migrate.output).toContain(`applied 2 of ${ALL_TAGS.length} migrations`);
		expect(await postsState(client)).toEqual(postsBefore);
	}, 60000);

	it('without --allow-extra: refuses, lists posts and names the flag', async () => {
		const { client, url } = await databaseAt(2, { posts: true });
		const refused = run('db-baseline.ts', url, ['--dry-run']);
		expect(refused.status).toBe(1);
		expect(refused.output).toContain('refused: the schema does not match any migration; closest is 0002_schema_catch_up');
		expect(refused.output).toContain('+ table posts (in the database, not in the migrations)');
		expect(refused.output).toContain('--allow-extra posts');
		expect(await historyTable(client)).toBeNull();
	}, 60000);

	it('rejects unknown and incomplete arguments before opening the database', async () => {
		const { url } = await databaseAt(2);
		for (const args of [['--force'], ['--to'], ['--allow-extra', '--dry-run'], ['--dry-run=yes'], ['--yes=1'], ['--dry-run', '--yes']]) {
			const result = run('db-baseline.ts', url, args);
			expect(result.status, args.join(' ')).toBe(1);
			expect(result.output, args.join(' ')).toContain('Usage: pnpm db:baseline');
		}
	}, 60000);
});

describe('the schema-missing hint', () => {
	it('in development names db:migrate:local and warns that DATABASE_URL may be remote', () => {
		expect(schemaMissingHint('development')).toBe(DEV_SCHEMA_MISSING_HINT);
		expect(DEV_SCHEMA_MISSING_HINT).toContain('pnpm db:migrate:local');
		expect(DEV_SCHEMA_MISSING_HINT).toContain('DATABASE_URL in .env');
		expect(DEV_SCHEMA_MISSING_HINT).toContain('remote');
		expect(DEV_SCHEMA_MISSING_HINT).toContain('NODE_ENV=development pnpm db:baseline');
	});

	it('elsewhere keeps the db:migrate hint', () => {
		for (const mode of ['test', 'demo', 'production'] as const) {
			expect(schemaMissingHint(mode)).toBe(SCHEMA_MISSING_HINT);
		}
	});
});
