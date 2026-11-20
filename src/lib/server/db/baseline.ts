/**
 * Baselining (PRODUCTION_PLAN 3.5): a database created by the old runtime DDL
 * (`ensureSchemaTables`) has the tables but no `__drizzle_migrations` rows, so
 * `db:migrate` would try to create them again. `baselineDatabase` checks that
 * the live schema matches the latest migration snapshot (tables, columns, and
 * each column's type, NOT NULL and primary key), then records every migration
 * as applied without running it. It refuses, with the diff, when anything
 * differs. See docs/database-migrations.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Client } from '@libsql/client';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { MIGRATIONS_FOLDER } from './migrate';
import { hasMigrationHistory, liveTableNames, MIGRATIONS_TABLE } from './schema-check';

interface SnapshotColumn {
	name: string;
	type: string;
	primaryKey: boolean;
	notNull: boolean;
}

interface Snapshot {
	tables: Record<string, { name: string; columns: Record<string, SnapshotColumn> }>;
}

export interface ColumnShape {
	type: string;
	notNull: boolean;
	primaryKey: boolean;
}

export interface SchemaDiff {
	missingTables: string[];
	extraTables: string[];
	missingColumns: string[];
	extraColumns: string[];
	changedColumns: Array<{ column: string; expected: ColumnShape; actual: ColumnShape }>;
}

/** The snapshot drizzle-kit wrote with the newest migration in the journal. */
export function latestSnapshot(migrationsFolder: string = MIGRATIONS_FOLDER): { tag: string; snapshot: Snapshot } {
	const journal = JSON.parse(fs.readFileSync(path.join(migrationsFolder, 'meta', '_journal.json'), 'utf8')) as {
		entries: Array<{ idx: number; tag: string }>;
	};
	const last = journal.entries.at(-1);
	if (!last) throw new Error('No migrations in the journal.');
	const file = path.join(migrationsFolder, 'meta', `${String(last.idx).padStart(4, '0')}_snapshot.json`);
	return { tag: last.tag, snapshot: JSON.parse(fs.readFileSync(file, 'utf8')) as Snapshot };
}

const shape = (c: { type: string; notNull: boolean; primaryKey: boolean }): ColumnShape => ({
	type: c.type.trim().toLowerCase(),
	notNull: c.notNull,
	primaryKey: c.primaryKey
});

/** Compares the live tables and columns with the snapshot. Empty arrays mean they match. */
export async function diffLiveSchema(client: Client, snapshot: Snapshot): Promise<SchemaDiff> {
	const diff: SchemaDiff = {
		missingTables: [],
		extraTables: [],
		missingColumns: [],
		extraColumns: [],
		changedColumns: []
	};
	const live = new Set(await liveTableNames(client));
	const expected = snapshot.tables;

	for (const name of Object.keys(expected).sort()) {
		if (!live.has(name)) {
			diff.missingTables.push(name);
			continue;
		}
		const info = await client.execute(`PRAGMA table_info(\`${name}\`)`);
		const actualColumns = new Map(
			info.rows.map((row) => [
				String(row.name),
				shape({ type: String(row.type), notNull: Number(row.notnull) === 1, primaryKey: Number(row.pk) > 0 })
			])
		);
		for (const column of Object.values(expected[name]!.columns)) {
			const actual = actualColumns.get(column.name);
			const id = `${name}.${column.name}`;
			if (!actual) {
				diff.missingColumns.push(id);
				continue;
			}
			const want = shape(column);
			if (want.type !== actual.type || want.notNull !== actual.notNull || want.primaryKey !== actual.primaryKey) {
				diff.changedColumns.push({ column: id, expected: want, actual });
			}
			actualColumns.delete(column.name);
		}
		for (const extra of actualColumns.keys()) diff.extraColumns.push(`${name}.${extra}`);
	}
	for (const name of live) if (!(name in expected)) diff.extraTables.push(name);
	diff.extraTables.sort();
	return diff;
}

export function isEmptyDiff(diff: SchemaDiff): boolean {
	return Object.values(diff).every((list) => list.length === 0);
}

const describeShape = (c: ColumnShape) =>
	`${c.type}${c.notNull ? ' NOT NULL' : ''}${c.primaryKey ? ' PRIMARY KEY' : ''}`;

export function formatDiff(diff: SchemaDiff): string {
	const lines: string[] = [];
	for (const t of diff.missingTables) lines.push(`- table ${t} (in the migrations, missing from the database)`);
	for (const t of diff.extraTables) lines.push(`+ table ${t} (in the database, not in the migrations)`);
	for (const c of diff.missingColumns) lines.push(`- column ${c} (missing from the database)`);
	for (const c of diff.extraColumns) lines.push(`+ column ${c} (not in the migrations)`);
	for (const c of diff.changedColumns) {
		lines.push(`~ column ${c.column}: expected ${describeShape(c.expected)}, found ${describeShape(c.actual)}`);
	}
	return lines.join('\n');
}

export type BaselineResult =
	| { status: 'baselined'; recorded: number; latest: string }
	| { status: 'would-baseline'; recorded: number; latest: string }
	| { status: 'already-migrated' }
	| { status: 'empty' }
	| { status: 'mismatch'; diff: SchemaDiff; latest: string };

/**
 * Records every migration as applied on a database whose schema already matches
 * the latest snapshot. With `dryRun`, only checks. Never runs migration SQL and
 * never touches data tables.
 */
export async function baselineDatabase(
	client: Client,
	options: { migrationsFolder?: string; dryRun?: boolean } = {}
): Promise<BaselineResult> {
	const migrationsFolder = options.migrationsFolder ?? MIGRATIONS_FOLDER;
	if (await hasMigrationHistory(client)) return { status: 'already-migrated' };
	if ((await liveTableNames(client)).length === 0) return { status: 'empty' };

	const { tag, snapshot } = latestSnapshot(migrationsFolder);
	const diff = await diffLiveSchema(client, snapshot);
	if (!isEmptyDiff(diff)) return { status: 'mismatch', diff, latest: tag };

	const migrations = readMigrationFiles({ migrationsFolder });
	if (options.dryRun) return { status: 'would-baseline', recorded: migrations.length, latest: tag };

	// The same table and rows drizzle's migrator writes, so `db:migrate` sees every migration as applied.
	await client.batch(
		[
			`CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`,
			...migrations.map((m) => ({
				sql: `INSERT INTO ${MIGRATIONS_TABLE} ("hash", "created_at") VALUES (?, ?)`,
				args: [m.hash, m.folderMillis]
			}))
		],
		'write'
	);
	return { status: 'baselined', recorded: migrations.length, latest: tag };
}
