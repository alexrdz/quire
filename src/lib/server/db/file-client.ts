/**
 * Q-T01: local `file:` databases wait for a lock instead of failing at once with
 * SQLITE_BUSY. The e2e servers, the Playwright helpers and parallel specs all
 * write the same file, and the app's client had no busy timeout.
 *
 * @libsql/client has no timeout option for files, and `PRAGMA busy_timeout` holds
 * per connection. The client also drops its connection after `transaction()` and
 * lazily opens a new one, which would come up without the PRAGMA. So a file
 * client is wrapped: before its first statement, and again before the first
 * statement after any `transaction()`, it runs `PRAGMA busy_timeout`. WAL journal
 * mode is set once (it is stored in the file) so readers don't block the writer.
 * Remote (Turso) clients are returned unchanged: no PRAGMA is sent to them.
 */
import { createClient, type Client, type Config } from '@libsql/client';

export const FILE_BUSY_TIMEOUT_MS = 5000;

/** Client methods that run SQL on the current connection. */
const SQL_METHODS = new Set(['execute', 'batch', 'migrate', 'executeMultiple', 'transaction']);

export function isFileDatabaseUrl(url: string): boolean {
	return url.startsWith('file:');
}

/**
 * Wraps a client for a `file:` database so every connection it uses has the busy
 * timeout before running anything else.
 */
export function withFileBusyTimeout(client: Client, timeoutMs: number = FILE_BUSY_TIMEOUT_MS): Client {
	let ready: Promise<void> | null = null;
	let journalChecked = false;

	const prepare = (): Promise<void> => {
		ready ??= (async () => {
			await client.execute(`PRAGMA busy_timeout = ${Math.max(0, Math.floor(timeoutMs))}`);
			if (!journalChecked) {
				journalChecked = true;
				// In-memory databases can't use WAL; SQLite then keeps 'memory'. That's fine.
				await client.execute('PRAGMA journal_mode = WAL');
			}
		})().catch((error) => {
			// Let the next call try again rather than caching a failure.
			ready = null;
			throw error;
		});
		return ready;
	};

	return new Proxy(client, {
		get(target, prop, receiver) {
			const value = Reflect.get(target, prop, receiver);
			if (typeof prop !== 'string' || !SQL_METHODS.has(prop) || typeof value !== 'function') {
				return typeof value === 'function' ? value.bind(target) : value;
			}
			return async (...args: unknown[]) => {
				await prepare();
				const result = await (value as (...a: unknown[]) => Promise<unknown>).apply(target, args);
				// The transaction keeps the prepared connection; the client opens a new
				// one for the next call, which needs the PRAGMA again.
				if (prop === 'transaction') ready = null;
				return result;
			};
		}
	});
}

/** `createClient`, with the busy timeout for `file:` URLs. Remote URLs are unchanged. */
export function createAppClient(config: Config): Client {
	const client = createClient(config);
	return isFileDatabaseUrl(config.url) ? withFileBusyTimeout(client) : client;
}
