/**
 * The database `db:migrate` and `db:baseline` work on: the same one the app
 * uses in this mode, resolved by `parseConfig` from DATABASE_URL and
 * DATABASE_AUTH_TOKEN. Tests and the e2e server (NODE_ENV=test) always get
 * file:local.db; development defaults to it; the Demo and production need the
 * remote Turso URL.
 */
import type { Client } from '@libsql/client';
import { createAppClient } from '../../src/lib/server/db/file-client';
import { databaseHost, isRemoteDatabaseUrl, parseConfig, type Env } from '../../src/lib/server/config';

export function loadDotEnv(): void {
	try {
		process.loadEnvFile?.('.env');
	} catch {
		// Deploy environments set variables directly.
	}
}

/** Where the URL points, safe to print: host or file path only, never a token or query. */
export function describeDatabase(url: string): string {
	return databaseHost(url);
}

/**
 * B1-T12: development mode migrates only a `file:` database. `pnpm db:migrate:local`
 * sets NODE_ENV=development but used to migrate whatever DATABASE_URL was set,
 * including a remote one such as production. Returns why it must not run, host
 * only (never the token), or null. QUIRE_DEV_REMOTE_DB does not change this.
 */
export function developmentRemoteRefusal(env: Env = process.env): string | null {
	const { core, mode } = parseConfig(env);
	if (mode !== 'development' || !isRemoteDatabaseUrl(core.databaseUrl)) return null;
	return (
		`development mode migrates only a file: database, and DATABASE_URL is a remote database (${databaseHost(core.databaseUrl)}). ` +
		'Nothing was migrated. For local work set DATABASE_URL=file:local.db. ' +
		'A remote database is migrated with `pnpm db:migrate`, which runs in production mode: see docs/database-migrations.md.'
	);
}

export function openTargetDatabase(env: Env = process.env): { client: Client; mode: string; label: string } {
	const { core, mode } = parseConfig(env);
	if (!core.databaseUrl) {
		throw new Error(
			`DATABASE_URL is missing or not a remote Turso URL for ${mode} mode. For the local file database run with NODE_ENV=development (pnpm db:migrate:local).`
		);
	}
	// File databases wait for locks instead of failing with SQLITE_BUSY (Q-T01).
	const client = createAppClient({
		url: core.databaseUrl,
		...(core.databaseAuthToken ? { authToken: core.databaseAuthToken } : {})
	});
	return { client, mode, label: describeDatabase(core.databaseUrl) };
}
