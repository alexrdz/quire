import { describe, expect, it, vi } from 'vitest';

/**
 * Q-T01: remote (Turso) URLs are unchanged: createAppClient returns the client
 * exactly as created and never sends a PRAGMA. `createClient` is faked so no
 * network connection is opened.
 */
const state = vi.hoisted(() => ({ sql: [] as string[], created: [] as unknown[] }));

vi.mock('@libsql/client', () => ({
	createClient: (config: { url: string }) => {
		const client = {
			url: config.url,
			execute: async (stmt: string | { sql: string }) => {
				state.sql.push(typeof stmt === 'string' ? stmt : stmt.sql);
				return { rows: [] };
			}
		};
		state.created.push(client);
		return client;
	}
}));

const { createAppClient } = await import('$lib/server/db/file-client');

describe('createAppClient with a remote URL', () => {
	it.each(['libsql://quire-prod.turso.io', 'https://quire-prod.turso.io', 'wss://quire-prod.turso.io'])(
		'%s: the client is returned as created, and only the caller\'s SQL is sent',
		async (url) => {
			state.sql.length = 0;
			const client = createAppClient({ url, authToken: 'token' });
			expect(client).toBe(state.created.at(-1));
			await client.execute('SELECT 1');
			expect(state.sql).toEqual(['SELECT 1']);
		}
	);

	it('a file: URL is wrapped and gets the PRAGMA first', async () => {
		state.sql.length = 0;
		const client = createAppClient({ url: 'file:local.db' });
		expect(client).not.toBe(state.created.at(-1));
		await client.execute('SELECT 1');
		expect(state.sql).toEqual(['PRAGMA busy_timeout = 5000', 'PRAGMA journal_mode = WAL', 'SELECT 1']);
	});
});
