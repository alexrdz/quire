/**
 * The database `db:migrate` and `db:baseline` work on: the same one the app
 * uses in this mode, resolved by `parseConfig` from DATABASE_URL and
 * DATABASE_AUTH_TOKEN. Tests and the e2e server (NODE_ENV=test) always get
 * file:local.db; development defaults to it; the Demo and production need the
 * remote Turso URL.
 */
import { createClient, type Client } from '@libsql/client';
import { parseConfig, type Env } from '../../src/lib/server/config';

export function loadDotEnv(): void {
	try {
		process.loadEnvFile?.('.env');
	} catch {
		// Deploy environments set variables directly.
	}
}

/** Where the URL points, safe to print: host or file path only, never a token or query. */
export function describeDatabase(url: string): string {
	if (url.startsWith('file:')) return url;
	try {
		const parsed = new URL(url);
		return `${parsed.protocol}//${parsed.host}`;
	} catch {
		return '(unparseable DATABASE_URL)';
	}
}

export function openTargetDatabase(env: Env = process.env): { client: Client; mode: string; label: string } {
	const { core, mode } = parseConfig(env);
	if (!core.databaseUrl) {
		throw new Error(
			`DATABASE_URL is missing or not a remote Turso URL for ${mode} mode. For the local file database run with NODE_ENV=development (pnpm db:migrate:local).`
		);
	}
	const client = createClient({
		url: core.databaseUrl,
		...(core.databaseAuthToken ? { authToken: core.databaseAuthToken } : {})
	});
	return { client, mode, label: describeDatabase(core.databaseUrl) };
}
