/**
 * The Demo's nightly reset (PRODUCTION_PLAN 4.2, P4L-T06), run by the Netlify
 * scheduled function `netlify/functions/demo-reset.mts`.
 *
 * Both Netlify sites deploy the same repo, so the function also exists on the
 * production site. `runScheduledDemoReset` therefore checks the mode before it
 * loads the database module at all: outside the Demo it logs one line and
 * returns, and nothing connects to the database.
 *
 * In the Demo it migrates, deletes every row from every app table in one batch
 * (children before parents; `__drizzle_migrations` is never touched), then
 * reseeds the sample data.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Client } from '@libsql/client';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { is } from 'drizzle-orm';
import type { Mode } from '../../features';
import { MIGRATIONS_FOLDER, runMigrations } from './migrate';
import * as schema from './schema';
import { MIGRATIONS_TABLE } from './schema-check';

const LOG_PREFIX = '[demo-reset]';

/**
 * Every app table in an order that is safe to delete in: a table comes after
 * every table that references it. Built from the foreign keys in `schema.ts`, so
 * a new table is included without editing this file.
 */
export function appTablesInDeleteOrder(): string[] {
	const tables = Object.values(schema).flatMap((value) => (is(value, SQLiteTable) ? [value as SQLiteTable] : []));
	const parentsOf = new Map<string, Set<string>>();
	for (const table of tables) {
		const config = getTableConfig(table);
		const parents = new Set(
			config.foreignKeys
				.map((fk) => getTableConfig(fk.reference().foreignTable).name)
				.filter((name) => name !== config.name)
		);
		parentsOf.set(config.name, parents);
	}

	// Repeatedly take the tables nothing remaining references (the leaves).
	const order: string[] = [];
	const remaining = new Set(parentsOf.keys());
	while (remaining.size > 0) {
		const leaves = [...remaining]
			.filter((name) => ![...remaining].some((other) => parentsOf.get(other)!.has(name)))
			.sort();
		if (leaves.length === 0) throw new Error(`${LOG_PREFIX} foreign key cycle among: ${[...remaining].join(', ')}`);
		for (const leaf of leaves) {
			order.push(leaf);
			remaining.delete(leaf);
		}
	}
	if (order.includes(MIGRATIONS_TABLE)) throw new Error(`${LOG_PREFIX} refusing to delete ${MIGRATIONS_TABLE}`);
	return order;
}

/**
 * The `drizzle/` folder. netlify.toml ships it with the function
 * (`included_files`), but where it lands relative to the working directory
 * depends on the bundle, so this looks in the working directory first, then
 * beside and above this module.
 */
export function findMigrationsFolder(
	candidates: string[] = [MIGRATIONS_FOLDER, ...ancestorsOf(path.dirname(fileURLToPath(import.meta.url)))]
): string {
	for (const candidate of candidates) {
		const folder = path.basename(candidate) === 'drizzle' ? candidate : path.join(candidate, 'drizzle');
		if (fs.existsSync(path.join(folder, 'meta', '_journal.json'))) return folder;
	}
	throw new Error(
		`${LOG_PREFIX} drizzle/ migrations folder not found. netlify.toml must include it in the function ([functions."demo-reset"] included_files).`
	);
}

function ancestorsOf(dir: string): string[] {
	const out: string[] = [];
	for (let current = dir; ; current = path.dirname(current)) {
		out.push(current);
		if (path.dirname(current) === current) return out;
	}
}

export interface DemoResetSummary {
	migrationsApplied: number;
	migrationsTotal: number;
	tablesCleared: number;
	rowsDeleted: number;
	durationMs: number;
}

/**
 * Migrates, empties every app table in one write batch, then reseeds. Only ever
 * called in the Demo (`runScheduledDemoReset` checks the mode first).
 */
export async function resetDemoData(
	client: Client,
	seed: () => Promise<unknown>,
	options: { migrationsFolder?: string; now?: () => number } = {}
): Promise<DemoResetSummary> {
	const now = options.now ?? Date.now;
	const started = now();
	const migrations = await runMigrations(client, options.migrationsFolder ?? findMigrationsFolder());
	const tables = appTablesInDeleteOrder();
	// One batch is one transaction: the Demo is never left half emptied.
	const results = await client.batch(
		tables.map((name) => `DELETE FROM \`${name}\``),
		'write'
	);
	const rowsDeleted = results.reduce((sum, result) => sum + result.rowsAffected, 0);
	await seed();
	return {
		migrationsApplied: migrations.applied,
		migrationsTotal: migrations.total,
		tablesCleared: tables.length,
		rowsDeleted,
		durationMs: now() - started
	};
}

export type ScheduledResetResult =
	| { status: 'skipped'; mode: Mode }
	| { status: 'reset'; summary: DemoResetSummary }
	| { status: 'failed'; error: string };

/**
 * The scheduled function's whole job. Does nothing, and logs that, unless the
 * mode is the Demo. The database and seed modules are loaded only after that
 * check, so on production nothing here opens a database connection.
 */
export async function runScheduledDemoReset(
	options: { getMode?: () => Mode; log?: (line: string) => void } = {}
): Promise<ScheduledResetResult> {
	const log = options.log ?? ((line: string) => console.log(line));
	const mode = options.getMode ? options.getMode() : (await import('../config')).getConfig().mode;

	if (mode !== 'demo') {
		log(`${LOG_PREFIX} skipped: mode is ${mode}, not demo. The reset only runs on the Demo site; nothing was touched.`);
		return { status: 'skipped', mode };
	}

	try {
		// One after the other: the seed must use the same db module as the reset.
		const { client } = await import('./index');
		const { seedDatabase } = await import('../seed');
		const summary = await resetDemoData(client, seedDatabase);
		log(
			`${LOG_PREFIX} done: cleared ${summary.tablesCleared} tables (${summary.rowsDeleted} rows), applied ${summary.migrationsApplied} of ${summary.migrationsTotal} migrations, reseeded in ${summary.durationMs} ms.`
		);
		return { status: 'reset', summary };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		log(`${LOG_PREFIX} failed: ${message}`);
		return { status: 'failed', error: message };
	}
}
