import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

if (!isTest) {
	try {
		process.loadEnvFile?.('.env');
	} catch {}
}

// In test environment or local fallback, use local SQLite database file
const rawUrl = process.env.DATABASE_URL;
const url =
	isTest && (!rawUrl || rawUrl.startsWith('libsql://'))
		? 'file:local.db'
		: rawUrl || 'file:local.db';

const isFileDb = url.startsWith('file:');
const authToken = isFileDb || isTest ? undefined : process.env.DATABASE_AUTH_TOKEN;

if (!isFileDb && !isTest && !authToken) {
	throw new Error('DATABASE_AUTH_TOKEN is required when connecting to a remote libSQL/Turso database.');
}

export const client = createClient({
	url,
	...(authToken ? { authToken } : {})
});

export const db = drizzle(client, { schema });
export type Database = typeof db;
export { schema };
