import { createClient } from '@libsql/client';

/**
 * Direct access to the local test database that `pnpm preview` (NODE_ENV=test)
 * serves from. Used only to reset rate-limit counters, since every e2e request
 * comes from the same address.
 */
function client() {
	return createClient({ url: 'file:local.db' });
}

/** Clears app rate-limit counters so earlier runs on this machine cannot trip a limit. */
export async function resetRateLimits(): Promise<void> {
	const db = client();
	try {
		await db.execute('DELETE FROM rate_limits');
	} catch {
		// Table not created yet: the server creates it on first request.
	} finally {
		db.close();
	}
}
