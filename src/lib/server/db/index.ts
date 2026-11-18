import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { getConfig } from '../config';
import * as schema from './schema';

const { core } = getConfig();

/**
 * When the core configuration is invalid (ADR 0007), the database handles throw on
 * first use instead of at import, so `hooks.server.ts` can still serve the 503 page
 * and the build can still analyse route modules.
 */
function unavailable<T extends object>(name: string): T {
	return new Proxy({} as T, {
		get(_target, prop) {
			if (prop === 'then') return undefined;
			throw new Error(`${name} is unavailable: core configuration is invalid (${core.issues.join(', ')}).`);
		}
	});
}

export const client: Client = core.ok
	? createClient({
			url: core.databaseUrl,
			...(core.databaseAuthToken ? { authToken: core.databaseAuthToken } : {})
		})
	: unavailable<Client>('Database client');

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

export const db: DrizzleDb = core.ok ? drizzle(client, { schema }) : unavailable<DrizzleDb>('Database');
export type Database = typeof db;
export { schema };
