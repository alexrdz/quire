/**
 * Drizzle migrations are the only way the schema is created (PRODUCTION_PLAN 3.5).
 * Nothing at runtime writes DDL. This module only reads `sqlite_master` to give
 * a clear hint when a database has not been migrated yet.
 */
import type { Client } from '@libsql/client';
import { is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import * as schema from './schema';

export const MIGRATIONS_TABLE = '__drizzle_migrations';

export const SCHEMA_MISSING_HINT =
	'Run `pnpm db:migrate` to create the schema. A database created before migrations (by the old runtime DDL) needs `pnpm db:baseline` once first: see docs/database-migrations.md.';

/** Every table `schema.ts` defines, by its SQL name. */
export function schemaTableNames(): string[] {
	return Object.values(schema)
		.flatMap((value) => (is(value, SQLiteTable) ? [getTableConfig(value as SQLiteTable).name] : []))
		.sort();
}

/** User tables in the live database: no SQLite internals, no migration bookkeeping. */
export async function liveTableNames(client: Client): Promise<string[]> {
	const result = await client.execute(
		// sqlite_* are SQLite internals; libsql_* are Turso's.
		`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%' ORDER BY name`
	);
	return result.rows.map((row) => String(row.name)).filter((name) => name !== MIGRATIONS_TABLE);
}

export async function hasMigrationHistory(client: Client): Promise<boolean> {
	const table = await client.execute({
		sql: `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
		args: [MIGRATIONS_TABLE]
	});
	if (table.rows.length === 0) return false;
	const rows = await client.execute(`SELECT count(*) AS n FROM ${MIGRATIONS_TABLE}`);
	return Number(rows.rows[0]?.n ?? 0) > 0;
}

/**
 * Throws with the `db:migrate` hint unless every schema table exists and the
 * database has a migration history.
 */
export async function assertSchemaMigrated(client: Client): Promise<void> {
	const live = new Set(await liveTableNames(client));
	const missing = schemaTableNames().filter((name) => !live.has(name));
	if (missing.length > 0) {
		throw new Error(`Database schema is missing (${missing.length} tables, e.g. ${missing.slice(0, 3).join(', ')}). ${SCHEMA_MISSING_HINT}`);
	}
	if (!(await hasMigrationHistory(client))) {
		throw new Error(`Database has tables but no migration history. ${SCHEMA_MISSING_HINT}`);
	}
}
