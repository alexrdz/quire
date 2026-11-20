import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createClient } from '@libsql/client';
import { developmentRemoteRefusal } from '../../../scripts/lib/db-target';

/**
 * B1-T12: `pnpm db:migrate:local` (NODE_ENV=development) migrates only a file:
 * database. With a remote DATABASE_URL, as the user's .env had for production,
 * it refuses with the host (never the token) before opening any connection.
 * Production and preview runs are unchanged.
 */

const ROOT = path.resolve(__dirname, '../../..');
const TOKEN = 'eyJ-super-secret-token-value';
const REMOTE = 'libsql://quire-prod-alex.turso.io';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quire-migrate-local-'));

afterAll(() => {
	fs.rmSync(dir, { recursive: true, force: true });
});

describe('developmentRemoteRefusal', () => {
	it.each([REMOTE, 'https://quire-prod-alex.turso.io', 'wss://quire-prod-alex.turso.io'])(
		'development + %s: refuses, host only, and points to file:local.db and pnpm db:migrate',
		(url) => {
			const refusal = developmentRemoteRefusal({ NODE_ENV: 'development', DATABASE_URL: url, DATABASE_AUTH_TOKEN: TOKEN })!;
			expect(refusal).toContain(`DATABASE_URL is a remote database (${url})`);
			expect(refusal).toContain('Nothing was migrated');
			expect(refusal).toContain('DATABASE_URL=file:local.db');
			expect(refusal).toContain('`pnpm db:migrate`, which runs in production mode');
			expect(refusal).not.toContain(TOKEN);
		}
	);

	it('the token never appears, even inside the URL', () => {
		const refusal = developmentRemoteRefusal({
			NODE_ENV: 'development',
			DATABASE_URL: `${REMOTE}/?authToken=${TOKEN}`,
			DATABASE_AUTH_TOKEN: TOKEN
		})!;
		expect(refusal).toContain(`(${REMOTE})`);
		expect(refusal).not.toContain(TOKEN);
		expect(refusal).not.toContain('authToken');
	});

	it('QUIRE_DEV_REMOTE_DB=true does not override it', () => {
		expect(
			developmentRemoteRefusal({ NODE_ENV: 'development', DATABASE_URL: REMOTE, DATABASE_AUTH_TOKEN: TOKEN, QUIRE_DEV_REMOTE_DB: 'true' })
		).not.toBeNull();
	});

	it('development with a file: database, or none, is allowed', () => {
		expect(developmentRemoteRefusal({ NODE_ENV: 'development', DATABASE_URL: 'file:local.db' })).toBeNull();
		expect(developmentRemoteRefusal({ NODE_ENV: 'development' })).toBeNull();
	});

	it('production, the Demo and test mode are unchanged', () => {
		const secrets = { BETTER_AUTH_SECRET: 'a'.repeat(40), COOKIE_SECRET: 'b'.repeat(40), BETTER_AUTH_URL: 'https://quire.example' };
		expect(developmentRemoteRefusal({ ...secrets, NODE_ENV: 'production', DATABASE_URL: REMOTE, DATABASE_AUTH_TOKEN: TOKEN })).toBeNull();
		expect(developmentRemoteRefusal({ ...secrets, DEMO_MODE: 'true', DATABASE_URL: REMOTE, DATABASE_AUTH_TOKEN: TOKEN })).toBeNull();
		expect(developmentRemoteRefusal({ NODE_ENV: 'test', DATABASE_URL: REMOTE })).toBeNull();
	});
});

describe('the real db-migrate script', () => {
	function run(env: Record<string, string>, args: string[] = []) {
		const result = spawnSync('node', ['--import', 'tsx', path.join('scripts', 'db-migrate.ts'), ...args], {
			cwd: ROOT,
			encoding: 'utf8',
			// VITEST would force test mode; CONTEXT and NETLIFY must not leak in from a CI shell.
			env: { ...process.env, VITEST: '', CONTEXT: '', NETLIFY: '', DATABASE_AUTH_TOKEN: '', QUIRE_DEV_REMOTE_DB: '', ...env }
		});
		return { status: result.status, output: `${result.stdout}${result.stderr}` };
	}

	it('development + libsql://: exits 1 with the host-only refusal and never connects', () => {
		const result = run({ NODE_ENV: 'development', DATABASE_URL: REMOTE, DATABASE_AUTH_TOKEN: TOKEN });
		expect(result.status).toBe(1);
		expect(result.output).toContain(
			`[db:migrate] refused: development mode migrates only a file: database, and DATABASE_URL is a remote database (${REMOTE}). Nothing was migrated.`
		);
		expect(result.output).not.toContain(TOKEN);
		// It stopped before opening the database: no target line, no migration output.
		expect(result.output).not.toMatch(/\[db:migrate\] context/);
		expect(result.output).not.toMatch(/applied|up to date|failed/);
	}, 60000);

	it('development + libsql:// + QUIRE_DEV_REMOTE_DB=true: still refuses', () => {
		const result = run({ NODE_ENV: 'development', DATABASE_URL: REMOTE, DATABASE_AUTH_TOKEN: TOKEN, QUIRE_DEV_REMOTE_DB: 'true' });
		expect(result.status).toBe(1);
		expect(result.output).toContain('development mode migrates only a file: database');
	}, 60000);

	it('development + file: migrates as before', async () => {
		const file = path.join(dir, 'dev.db');
		const result = run({ NODE_ENV: 'development', DATABASE_URL: `file:${file}` });
		expect(result.status).toBe(0);
		expect(result.output).toContain('development mode');
		expect(result.output).toMatch(/applied \d+ of \d+ migrations/);

		const client = createClient({ url: `file:${file}` });
		try {
			const tables = await client.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'artists'`);
			expect(tables.rows).toHaveLength(1);
		} finally {
			client.close();
		}

		expect(run({ NODE_ENV: 'development', DATABASE_URL: `file:${file}` }).output).toContain('up to date');
	}, 60000);

	it('production with a file: URL is still refused by the config, as before', () => {
		const result = run({ NODE_ENV: 'production', DATABASE_URL: `file:${path.join(dir, 'prod.db')}` });
		expect(result.status).toBe(1);
		expect(result.output).toContain('DATABASE_URL is missing or not a remote Turso URL for production mode');
		expect(result.output).not.toContain('development mode migrates only');
	}, 60000);

	it('a deploy preview without a preview database still skips, as before', () => {
		const result = run({ NODE_ENV: 'production', CONTEXT: 'deploy-preview', DATABASE_URL: REMOTE, DATABASE_AUTH_TOKEN: TOKEN }, ['--preview']);
		expect(result.status).toBe(0);
		expect(result.output).toContain('[db:migrate] skipped: context deploy-preview: no PREVIEW_DATABASE_URL');
		expect(result.output).not.toContain(TOKEN);
	}, 60000);
});
