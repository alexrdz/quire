import fs from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { resetConfigForTests } from '$lib/server/config';
import { appTablesInDeleteOrder, findMigrationsFolder, runScheduledDemoReset } from '$lib/server/db/demo-reset';
import os from 'node:os';
import { MIGRATIONS_TABLE, schemaTableNames } from '$lib/server/db/schema-check';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { is } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';

/**
 * PRODUCTION_PLAN 4.2 (P4L-T06): the Demo's nightly reset. The scheduled function
 * ships to the production site too, so outside the Demo it must do nothing and
 * never even open the database.
 */

const ROOT = path.resolve(__dirname, '../../..');

// The real db module, on a temp file (never local.db, which other test files
// share). `loaded` proves whether anything imported it.
const state = vi.hoisted(() => {
	const nodeFs = require('node:fs') as typeof import('node:fs');
	const nodeOs = require('node:os') as typeof import('node:os');
	const nodePath = require('node:path') as typeof import('node:path');
	const dir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'quire-demo-reset-'));
	return { dir, url: `file:${nodePath.join(dir, 'demo.db')}`, loaded: 0 };
});

vi.mock('$lib/server/db', async () => {
	state.loaded += 1;
	const { createClient } = await import('@libsql/client');
	const { drizzle } = await import('drizzle-orm/libsql');
	const dbSchema = await import('$lib/server/db/schema');
	const client = createClient({ url: state.url });
	return { client, db: drizzle(client, { schema: dbSchema }), schema: dbSchema };
});

afterEach(() => {
	vi.unstubAllEnvs();
	resetConfigForTests();
});

afterAll(async () => {
	if (state.loaded > 0) {
		const { client } = await import('$lib/server/db');
		client.close();
	}
	fs.rmSync(state.dir, { recursive: true, force: true });
});

/** A mode for the real getConfig(): Vitest's own VITEST variable would force test mode. */
function stubMode(mode: 'production' | 'development' | 'demo') {
	vi.stubEnv('VITEST', '');
	vi.stubEnv('NODE_ENV', mode === 'development' ? 'development' : 'production');
	vi.stubEnv('DEMO_MODE', mode === 'demo' ? 'true' : '');
	resetConfigForTests();
}

describe('outside the Demo the scheduled function does nothing (it ships to both sites)', () => {
	// These run first, before anything in this file loads the db module.
	it.each(['production', 'development'] as const)('%s: logs the skip, returns 204, never loads the database', async (mode) => {
		stubMode(mode);
		const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		const { default: demoReset } = await import('../../../netlify/functions/demo-reset.mjs');

		const response = await demoReset();

		expect(response.status).toBe(204);
		expect(log).toHaveBeenCalledWith(expect.stringContaining(`[demo-reset] skipped: mode is ${mode}, not demo`));
		expect(state.loaded, 'the db module was imported').toBe(0);
		log.mockRestore();
	});

	it.each(['production', 'development', 'test'] as const)('%s via runScheduledDemoReset: skipped', async (mode) => {
		const lines: string[] = [];
		const result = await runScheduledDemoReset({ getMode: () => mode, log: (line) => lines.push(line) });
		expect(result).toEqual({ status: 'skipped', mode });
		expect(lines).toHaveLength(1);
		expect(lines[0]).toContain('nothing was touched');
		expect(state.loaded).toBe(0);
	});
});

describe('migrations folder', () => {
	it('finds drizzle/ from the working directory, or by walking up from a nested bundle path', () => {
		expect(findMigrationsFolder()).toBe(path.join(ROOT, 'drizzle'));
		expect(findMigrationsFolder(['/nowhere/at/all', path.join(ROOT, 'netlify/functions'), ROOT])).toBe(path.join(ROOT, 'drizzle'));
	});

	it('fails with a pointer to netlify.toml when it is missing', () => {
		expect(() => findMigrationsFolder([os.tmpdir()])).toThrow(/included_files/);
	});
});

describe('delete order', () => {
	it('covers every app table, never the migration history, children before parents', () => {
		const order = appTablesInDeleteOrder();
		expect([...order].sort()).toEqual(schemaTableNames());
		expect(order).not.toContain(MIGRATIONS_TABLE);

		for (const value of Object.values(schema)) {
			if (!is(value, SQLiteTable)) continue;
			const table = getTableConfig(value as SQLiteTable);
			for (const fk of table.foreignKeys) {
				const parent = getTableConfig(fk.reference().foreignTable).name;
				if (parent === table.name) continue;
				expect(order.indexOf(table.name), `${table.name} before ${parent}`).toBeLessThan(order.indexOf(parent));
			}
		}
	});
});

describe('in the Demo, on a file database', () => {
	async function counts(): Promise<Record<string, number>> {
		const { client } = await import('$lib/server/db');
		const out: Record<string, number> = {};
		for (const name of [...schemaTableNames(), MIGRATIONS_TABLE]) {
			const rows = await client.execute(`SELECT count(*) AS n FROM \`${name}\``);
			out[name] = Number(rows.rows[0]?.n ?? 0);
		}
		return out;
	}

	it('migrates a fresh database and seeds it', async () => {
		const lines: string[] = [];
		const result = await runScheduledDemoReset({ getMode: () => 'demo', log: (line) => lines.push(line) });
		expect(result.status).toBe('reset');
		if (result.status !== 'reset') return;
		expect(result.summary.migrationsApplied).toBe(result.summary.migrationsTotal);
		expect(result.summary.rowsDeleted).toBe(0);
		expect(lines).toHaveLength(1);
		expect(lines[0]).toMatch(/^\[demo-reset\] done: cleared \d+ tables \(0 rows\), applied \d+ of \d+ migrations, reseeded in \d+ ms\.$/);

		const after = await counts();
		expect(after.artists).toBeGreaterThan(0);
		expect(after[MIGRATIONS_TABLE]).toBe(result.summary.migrationsTotal);
	});

	it('empties every app table, keeps the migration history, and reseeds', async () => {
		const seeded = await counts();
		const { client } = await import('$lib/server/db');
		// What a day of Demo visitors leaves behind.
		await client.batch(
			[
				`INSERT INTO users (id, name, email, created_at, updated_at) VALUES ('visitor', 'Visitor', 'visitor@example.com', 1, 1)`,
				`INSERT INTO sessions (id, user_id, token, expires_at, created_at, updated_at) VALUES ('s1', 'visitor', 'tok', 9999999999, 1, 1)`,
				`INSERT INTO tip_taps (id, artist_id, amount_selected_cents, created_at) SELECT 'tap1', id, 500, 1 FROM artists LIMIT 1`,
				`INSERT INTO rate_limits (key, count, window_start, expires_at) VALUES ('k', 1, 1, 1)`
			],
			'write'
		);
		const dirty = await counts();
		expect(dirty.users).toBe(seeded.users! + 1);
		expect(dirty.tip_taps).toBe(seeded.tip_taps! + 1);

		const result = await runScheduledDemoReset({ getMode: () => 'demo', log: () => undefined });
		expect(result.status).toBe('reset');
		if (result.status !== 'reset') return;
		expect(result.summary.migrationsApplied).toBe(0);
		expect(result.summary.tablesCleared).toBe(schemaTableNames().length);
		expect(result.summary.rowsDeleted).toBe(
			Object.entries(dirty)
				.filter(([name]) => name !== MIGRATIONS_TABLE)
				.reduce((sum, [, n]) => sum + n, 0)
		);

		// Back to exactly the seeded state, migration history untouched.
		expect(await counts()).toEqual(seeded);
		const visitor = await client.execute(`SELECT id FROM users WHERE id = 'visitor'`);
		expect(visitor.rows).toHaveLength(0);
	});
});

describe('no public trigger', () => {
	const fn = fs.readFileSync(path.join(ROOT, 'netlify/functions/demo-reset.mts'), 'utf8');

	it('is a scheduled function with no path, so Netlify gives it no route', () => {
		expect(fn).toMatch(/export const config = \{[\s\S]*schedule: '[^']+'/);
		expect(fn).not.toMatch(/\bpath\s*:/);
	});

	it('nothing in the app routes or netlify.toml reaches it', () => {
		const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');
		expect(toml).not.toMatch(/\[\[redirects\]\][\s\S]*demo-reset/);

		const offenders: string[] = [];
		const walk = (dir: string) => {
			for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
				const full = path.join(dir, entry.name);
				if (entry.isDirectory()) walk(full);
				else if (/demo-reset|resetDemoData|runScheduledDemoReset/.test(fs.readFileSync(full, 'utf8'))) offenders.push(full);
			}
		};
		walk(path.join(ROOT, 'src/routes'));
		expect(offenders).toEqual([]);
	});
});
