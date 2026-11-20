/**
 * Baselining (PRODUCTION_PLAN 3.5, B1-T08): a database created by the old runtime
 * DDL (`ensureSchemaTables`) has the tables but no `__drizzle_migrations` rows, so
 * `db:migrate` would try to create them again. `baselineDatabase` finds the newest
 * migration whose snapshot the live schema matches exactly (tables, columns, and
 * each column's type, NOT NULL and primary key), or the one named with `to`, and
 * records the migrations up to and including it as applied, without running them.
 * `db:migrate` then applies the later ones. It refuses, with the diff against the
 * closest snapshot, when none matches.
 *
 * Tables that are in no Quire migration (another app's `posts`, say) are never
 * touched. They refuse by default; `allowExtra` names the ones to ignore.
 * See docs/database-migrations.md.
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

export interface MigrationSnapshot {
	/** Journal index: 0 for the first migration. */
	idx: number;
	/** The migration's tag, e.g. `0002_schema_catch_up`. */
	tag: string;
	snapshot: Snapshot;
}

/** Every migration in the journal with the snapshot drizzle-kit wrote for it, oldest first. */
export function migrationSnapshots(migrationsFolder: string = MIGRATIONS_FOLDER): MigrationSnapshot[] {
	const journal = JSON.parse(fs.readFileSync(path.join(migrationsFolder, 'meta', '_journal.json'), 'utf8')) as {
		entries: Array<{ idx: number; tag: string }>;
	};
	return journal.entries.map(({ idx, tag }) => {
		const file = path.join(migrationsFolder, 'meta', `${String(idx).padStart(4, '0')}_snapshot.json`);
		return { idx, tag, snapshot: JSON.parse(fs.readFileSync(file, 'utf8')) as Snapshot };
	});
}

/** Every table any Quire migration has created, by name. */
export function quireTableNames(migrationsFolder: string = MIGRATIONS_FOLDER): string[] {
	const names = new Set(migrationSnapshots(migrationsFolder).flatMap(({ snapshot }) => Object.keys(snapshot.tables)));
	return [...names].sort();
}

/** The snapshot drizzle-kit wrote with the newest migration in the journal. */
export function latestSnapshot(migrationsFolder: string = MIGRATIONS_FOLDER): { tag: string; snapshot: Snapshot } {
	const last = migrationSnapshots(migrationsFolder).at(-1);
	if (!last) throw new Error('No migrations in the journal.');
	return { tag: last.tag, snapshot: last.snapshot };
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

/** Number of differences: how far a database is from a snapshot. */
function diffSize(diff: SchemaDiff): number {
	return Object.values(diff).reduce((total, list) => total + list.length, 0);
}

/** `0000–0002` for the recorded range, or `0000` for one migration. */
export function tagRange(tags: string[]): string {
	const num = (tag: string) => tag.slice(0, 4);
	if (tags.length === 0) return '';
	return tags.length === 1 ? num(tags[0]!) : `${num(tags[0]!)}–${num(tags.at(-1)!)}`;
}

export interface BaselinePlan {
	/** The migration the live schema matches. */
	matched: string;
	/** Migrations recorded as applied: the matched one and every earlier one. */
	recordedTags: string[];
	/** Later migrations `db:migrate` applies afterwards. */
	pendingTags: string[];
	/** Tables outside Quire's migrations that `allowExtra` let through, untouched. */
	ignoredTables: string[];
}

export type BaselineResult =
	| ({ status: 'baselined' } & BaselinePlan)
	| ({ status: 'would-baseline' } & BaselinePlan)
	| { status: 'already-migrated' }
	| { status: 'empty' }
	| { status: 'mismatch'; diff: SchemaDiff; closest: string; forced: boolean }
	| { status: 'invalid-option'; message: string };

export interface BaselineOptions {
	migrationsFolder?: string;
	dryRun?: boolean;
	/** Match this migration (tag, or its 4-digit number) instead of the newest one that matches. */
	to?: string;
	/** Tables in no Quire migration to ignore instead of refusing. Never dropped or read. */
	allowExtra?: string[];
}

/**
 * Records the migrations up to the one the live schema matches as applied. With
 * `dryRun`, only plans. Never runs migration SQL, never touches data tables and
 * never drops anything.
 */
export async function baselineDatabase(client: Client, options: BaselineOptions = {}): Promise<BaselineResult> {
	const migrationsFolder = options.migrationsFolder ?? MIGRATIONS_FOLDER;
	const snapshots = migrationSnapshots(migrationsFolder);
	if (snapshots.length === 0) throw new Error('No migrations in the journal.');

	// Only tables Quire never created may be ignored: ignoring one a migration
	// creates would hide a half-built schema and break the later CREATE TABLE.
	const allowExtra = [...new Set((options.allowExtra ?? []).map((name) => name.trim()).filter(Boolean))].sort();
	const quireTables = new Set(quireTableNames(migrationsFolder));
	const ownTables = allowExtra.filter((name) => quireTables.has(name));
	if (ownTables.length > 0) {
		return {
			status: 'invalid-option',
			message: `--allow-extra only takes tables that are in no Quire migration; ${ownTables.join(', ')} ${ownTables.length === 1 ? 'is' : 'are'} Quire's.`
		};
	}

	let candidates = snapshots;
	if (options.to !== undefined) {
		const to = options.to.trim();
		const target = snapshots.find(({ tag }) => tag === to || tag.slice(0, 4) === to);
		if (!target) {
			return {
				status: 'invalid-option',
				message: `--to ${to}: no such migration. Known: ${snapshots.map(({ tag }) => tag).join(', ')}.`
			};
		}
		candidates = [target];
	}

	if (await hasMigrationHistory(client)) return { status: 'already-migrated' };
	const live = await liveTableNames(client);
	if (live.length === 0) return { status: 'empty' };
	const ignoredTables = allowExtra.filter((name) => live.includes(name));

	// Newest first: a schema can match only one snapshot unless two are identical,
	// and then the newer one leaves less for db:migrate to do.
	let closest: { tag: string; diff: SchemaDiff; size: number } | null = null;
	for (const candidate of [...candidates].reverse()) {
		const diff = await diffLiveSchema(client, candidate.snapshot);
		diff.extraTables = diff.extraTables.filter((name) => !allowExtra.includes(name));
		const size = diffSize(diff);
		if (size === 0) {
			return recordUpTo(client, migrationsFolder, snapshots, candidate, ignoredTables, options.dryRun ?? false);
		}
		if (!closest || size < closest.size) closest = { tag: candidate.tag, diff, size };
	}
	return { status: 'mismatch', diff: closest!.diff, closest: closest!.tag, forced: options.to !== undefined };
}

async function recordUpTo(
	client: Client,
	migrationsFolder: string,
	snapshots: MigrationSnapshot[],
	matched: MigrationSnapshot,
	ignoredTables: string[],
	dryRun: boolean
): Promise<BaselineResult> {
	const position = snapshots.indexOf(matched);
	const plan: BaselinePlan = {
		matched: matched.tag,
		recordedTags: snapshots.slice(0, position + 1).map(({ tag }) => tag),
		pendingTags: snapshots.slice(position + 1).map(({ tag }) => tag),
		ignoredTables
	};
	if (dryRun) return { status: 'would-baseline', ...plan };

	// readMigrationFiles follows the same journal order. drizzle's migrator applies
	// every migration newer than the last recorded `created_at`, so recording only
	// these leaves the later ones for `db:migrate`.
	const migrations = readMigrationFiles({ migrationsFolder }).slice(0, plan.recordedTags.length);
	// The same table and rows drizzle's migrator writes.
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
	return { status: 'baselined', ...plan };
}
