/**
 * The one schema path (PRODUCTION_PLAN 3.5): drizzle's libsql migrator over the
 * SQL files in `drizzle/`. Used by `pnpm db:migrate`, the Netlify build, the
 * Vitest global setup and the Playwright web server. Never imported by the app.
 */
import path from 'node:path';
import type { Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { hasMigrationHistory, liveTableNames, MIGRATIONS_TABLE } from './schema-check';

export const MIGRATIONS_FOLDER = path.resolve(process.cwd(), 'drizzle');

export const LEGACY_DB_HINT =
	'This database has tables but no migration history: it was created by the old runtime DDL. Run `pnpm db:baseline` once (docs/database-migrations.md), then `pnpm db:migrate`. For a local dev or test database you can delete local.db instead.';

async function appliedCount(client: Client): Promise<number> {
	const table = await client.execute({
		sql: `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
		args: [MIGRATIONS_TABLE]
	});
	if (table.rows.length === 0) return 0;
	const rows = await client.execute(`SELECT count(*) AS n FROM ${MIGRATIONS_TABLE}`);
	return Number(rows.rows[0]?.n ?? 0);
}

/**
 * Applies every pending migration. Refuses a database built the old way (tables
 * but no history), since migrating it would try to create the tables again.
 */
export async function runMigrations(
	client: Client,
	migrationsFolder: string = MIGRATIONS_FOLDER
): Promise<{ applied: number; total: number }> {
	if (!(await hasMigrationHistory(client)) && (await liveTableNames(client)).length > 0) {
		throw new Error(LEGACY_DB_HINT);
	}
	const before = await appliedCount(client);
	await migrate(drizzle(client), { migrationsFolder });
	const after = await appliedCount(client);
	return { applied: after - before, total: readMigrationFiles({ migrationsFolder }).length };
}

/** What a build should do about migrations in the current Netlify context. */
export type MigrationPlan =
	| { action: 'migrate'; reason: string }
	| { action: 'skip'; reason: string }
	| { action: 'refuse'; reason: string };

export type Env = Record<string, string | undefined>;

const PREVIEW_CONTEXTS = new Set(['deploy-preview', 'branch-deploy']);

/**
 * Deploy previews and branch deploys run unmerged code, and by default they see
 * the production DATABASE_URL. They migrate only when the site opts in with a
 * separate preview database: PREVIEW_DATABASE_URL set, and equal to the
 * DATABASE_URL that context runs with (scoped per context in Netlify), so the
 * database being migrated is the one the preview uses.
 * `preview` forces these rules for the default build command, whatever CONTEXT says.
 */
export function migrationPlanFor(env: Env, options: { preview?: boolean } = {}): MigrationPlan {
	const context = env.CONTEXT?.trim() || 'local';
	const previewRules = options.preview === true || PREVIEW_CONTEXTS.has(context);
	if (!previewRules) {
		return { action: 'migrate', reason: `context ${context}` };
	}

	const previewUrl = env.PREVIEW_DATABASE_URL?.trim();
	if (!previewUrl) {
		return {
			action: 'skip',
			reason: `context ${context}: no PREVIEW_DATABASE_URL, so this build never migrates the production database. Set PREVIEW_DATABASE_URL (and scope DATABASE_URL to the same preview database) to migrate previews.`
		};
	}
	if (previewUrl !== env.DATABASE_URL?.trim()) {
		return {
			action: 'refuse',
			reason: `context ${context}: PREVIEW_DATABASE_URL is set but DATABASE_URL is a different database. Scope DATABASE_URL (and DATABASE_AUTH_TOKEN) to the preview database for this context, so the preview migrates and uses the same one.`
		};
	}
	return { action: 'migrate', reason: `context ${context}: separate preview database (PREVIEW_DATABASE_URL)` };
}
