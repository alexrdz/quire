/**
 * Vitest global setup (PRODUCTION_PLAN 3.5): the test database is built by the
 * drizzle migrations, the same path production uses. No test writes DDL.
 * Test mode always uses file:local.db (config.ts). A local.db left over from
 * the old runtime DDL is refused with a hint to delete it.
 */
import { createClient } from '@libsql/client';
import { runMigrations } from '../../src/lib/server/db/migrate';

export const TEST_DATABASE_URL = 'file:local.db';

export default async function setup(): Promise<void> {
	const client = createClient({ url: TEST_DATABASE_URL });
	try {
		const { applied, total } = await runMigrations(client);
		if (applied > 0) console.log(`[test db] applied ${applied} of ${total} migrations to local.db`);
	} finally {
		client.close();
	}
}
