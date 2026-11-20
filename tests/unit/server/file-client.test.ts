import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createClient, type Client } from '@libsql/client';
import { createAppClient, FILE_BUSY_TIMEOUT_MS, withFileBusyTimeout } from '$lib/server/db/file-client';

/**
 * Q-T01: a file: database waits for a lock (busy_timeout) instead of failing at
 * once with SQLITE_BUSY, the 500 the parallel e2e writers hit on Quick Issue.
 */

const ROOT = path.resolve(__dirname, '../../..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quire-file-client-'));
const opened: Client[] = [];

afterAll(() => {
	for (const client of opened) client.close();
	fs.rmSync(dir, { recursive: true, force: true });
});

let n = 0;
function fileUrl(): string {
	return `file:${path.join(dir, `db-${n++}.db`)}`;
}

function track<T extends Client>(client: T): T {
	opened.push(client);
	return client;
}

async function busyTimeout(client: Client): Promise<number> {
	const result = await client.execute('PRAGMA busy_timeout');
	return Number(Object.values(result.rows[0]!)[0]);
}

/** A raw client that records every SQL statement, around a real file client. */
function recording(url: string): { client: Client; sql: string[] } {
	const real = track(createClient({ url }));
	const sql: string[] = [];
	const text = (stmt: unknown) => (typeof stmt === 'string' ? stmt : (stmt as { sql: string }).sql);
	const client = new Proxy(real, {
		get(target, prop) {
			const value = Reflect.get(target, prop);
			if (prop === 'execute') return (stmt: unknown) => (sql.push(text(stmt)), target.execute(stmt as string));
			if (prop === 'batch') return (stmts: unknown[], mode?: never) => (sql.push(...stmts.map(text)), target.batch(stmts as never, mode));
			if (prop === 'transaction') return (mode?: never) => (sql.push('BEGIN (transaction)'), target.transaction(mode));
			return typeof value === 'function' ? value.bind(target) : value;
		}
	});
	return { client, sql };
}

describe('withFileBusyTimeout', () => {
	it('sets busy_timeout (and WAL) before the first query runs', async () => {
		const { client: raw, sql } = recording(fileUrl());
		const client = withFileBusyTimeout(raw);
		await client.execute('CREATE TABLE t (id integer PRIMARY KEY)');
		expect(sql).toEqual([`PRAGMA busy_timeout = ${FILE_BUSY_TIMEOUT_MS}`, 'PRAGMA journal_mode = WAL', 'CREATE TABLE t (id integer PRIMARY KEY)']);

		await client.execute('SELECT 1');
		expect(sql.slice(3)).toEqual(['SELECT 1']);
		expect(await busyTimeout(client)).toBe(FILE_BUSY_TIMEOUT_MS);
		const journal = await client.execute('PRAGMA journal_mode');
		expect(String(Object.values(journal.rows[0]!)[0])).toBe('wal');
	});

	it('the first statement may be a batch: the PRAGMA still comes first, once for concurrent calls', async () => {
		const { client: raw, sql } = recording(fileUrl());
		const client = withFileBusyTimeout(raw);
		await Promise.all([client.batch(['CREATE TABLE a (id integer)'], 'write'), client.execute('SELECT 1')]);
		expect(sql.filter((s) => s.startsWith('PRAGMA busy_timeout'))).toHaveLength(1);
		expect(sql[0]).toBe(`PRAGMA busy_timeout = ${FILE_BUSY_TIMEOUT_MS}`);
	});

	it('re-applies busy_timeout on the new connection the client opens after transaction()', async () => {
		const url = fileUrl();
		// Unwrapped, the connection after a transaction has SQLite's default of 0.
		const plain = track(createClient({ url }));
		await plain.execute('PRAGMA busy_timeout = 5000');
		const tx0 = await plain.transaction('write');
		await tx0.commit();
		expect(await busyTimeout(plain)).toBe(0);

		const client = track(withFileBusyTimeout(createClient({ url })));
		await client.execute('CREATE TABLE IF NOT EXISTS t (id integer PRIMARY KEY)');
		const tx = await client.transaction('write');
		expect(await busyTimeout(tx as unknown as Client)).toBe(FILE_BUSY_TIMEOUT_MS);
		await tx.execute('INSERT INTO t (id) VALUES (1)');
		await tx.commit();
		expect(await busyTimeout(client)).toBe(FILE_BUSY_TIMEOUT_MS);
	});
});

describe('createAppClient', () => {
	it('wraps file: URLs', async () => {
		const client = track(createAppClient({ url: fileUrl() }));
		expect(await busyTimeout(client)).toBe(FILE_BUSY_TIMEOUT_MS);
	});
});

describe('the app client ($lib/server/db) on the test file database', () => {
	it('has the busy timeout before its first query', async () => {
		const { client } = await import('$lib/server/db');
		expect(await busyTimeout(client)).toBe(FILE_BUSY_TIMEOUT_MS);
	});
});

/**
 * Another process holds the write lock for a moment, as the e2e helpers and a
 * second server request do. libsql runs file queries synchronously, so the
 * holder must be a separate process.
 */
async function holdWriteLock(url: string, ms: number): Promise<{ done: Promise<number | null> }> {
	const script = path.join(dir, `hold-${n++}.mjs`);
	fs.writeFileSync(
		script,
		`import { createRequire } from 'node:module';
const require = createRequire(${JSON.stringify(path.join(ROOT, 'package.json'))});
const { createClient } = require('@libsql/client');
const db = createClient({ url: ${JSON.stringify(url)} });
await db.execute('BEGIN IMMEDIATE');
await db.execute('INSERT INTO t (id) VALUES (1000)');
process.stdout.write('locked\\n');
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ${ms});
await db.execute('COMMIT');
db.close();
`
	);
	const child = spawn('node', [script], { stdio: ['ignore', 'pipe', 'inherit'] });
	await new Promise<void>((resolve, reject) => {
		child.stdout.on('data', (chunk: Buffer) => {
			if (chunk.toString().includes('locked')) resolve();
		});
		child.on('exit', (code) => reject(new Error(`lock holder exited early (${code})`)));
	});
	return { done: new Promise((resolve) => child.on('exit', resolve)) };
}

describe('two writers on one file', () => {
	it('without the timeout, a write during another write fails with SQLITE_BUSY (the e2e 500)', async () => {
		const url = fileUrl();
		const setup = track(createClient({ url }));
		await setup.execute('CREATE TABLE t (id integer PRIMARY KEY)');

		const holder = await holdWriteLock(url, 600);
		const plain = track(createClient({ url }));
		await expect(plain.execute('INSERT INTO t (id) VALUES (1)')).rejects.toThrow(/SQLITE_BUSY|database is locked/);
		expect(await holder.done).toBe(0);
	}, 20000);

	it('with createAppClient, the write waits for the lock and succeeds', async () => {
		const url = fileUrl();
		const client = track(createAppClient({ url }));
		await client.execute('CREATE TABLE t (id integer PRIMARY KEY)');

		const holder = await holdWriteLock(url, 600);
		const started = Date.now();
		await client.execute('INSERT INTO t (id) VALUES (1)');
		expect(Date.now() - started).toBeGreaterThanOrEqual(200);
		expect(await holder.done).toBe(0);

		const rows = await client.execute('SELECT id FROM t ORDER BY id');
		expect(rows.rows.map((r) => Number(r.id))).toEqual([1, 1000]);
	}, 20000);
});
