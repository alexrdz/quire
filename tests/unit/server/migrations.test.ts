import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { migrationPlanFor } from '$lib/server/db/migrate';

/**
 * PRODUCTION_PLAN 3.5: drizzle migrations are the only schema path.
 * (The baseline tests are in db-baseline.test.ts.)
 */

const ROOT = path.resolve(__dirname, '../../..');

// seedDatabase against an empty database: the real `db` module, on a temp file.
const { tempDir, tempUrl } = vi.hoisted(() => {
	// vi.hoisted runs before the imports above are bound, so it requires its own.
	const nodeFs = require('node:fs') as typeof import('node:fs');
	const nodeOs = require('node:os') as typeof import('node:os');
	const nodePath = require('node:path') as typeof import('node:path');
	const dir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'quire-unmigrated-'));
	return { tempDir: dir, tempUrl: `file:${nodePath.join(dir, 'unmigrated.db')}` };
});

vi.mock('$lib/server/db', async () => {
	const { createClient } = await import('@libsql/client');
	const { drizzle } = await import('drizzle-orm/libsql');
	const schema = await import('$lib/server/db/schema');
	const client = createClient({ url: tempUrl });
	return { client, db: drizzle(client, { schema }), schema };
});

afterAll(async () => {
	const { client } = await import('$lib/server/db');
	client.close();
	fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('seed.ts only inserts data', () => {
	it('contains no DDL', () => {
		const source = fs.readFileSync(path.join(ROOT, 'src/lib/server/seed.ts'), 'utf8');
		expect(source).not.toMatch(/\b(CREATE|ALTER|DROP)\s+(TABLE|INDEX|UNIQUE)/i);
		expect(source).not.toContain('ensureSchemaTables');
	});

	it('fails on an unmigrated database with the db:migrate hint', async () => {
		const { seedDatabase } = await import('$lib/server/seed');
		await expect(seedDatabase()).rejects.toThrow(/Database schema is missing.*Run `pnpm db:migrate`/);

		// Nothing was created on the way.
		const { client } = await import('$lib/server/db');
		const tables = await client.execute(`SELECT name FROM sqlite_master WHERE type = 'table'`);
		expect(tables.rows).toHaveLength(0);
	});
});

describe('migration plan per Netlify context', () => {
	it('production and local runs migrate', () => {
		expect(migrationPlanFor({ CONTEXT: 'production' }).action).toBe('migrate');
		expect(migrationPlanFor({}).action).toBe('migrate');
	});

	it.each(['deploy-preview', 'branch-deploy'])('%s skips without a separate preview database', (CONTEXT) => {
		const plan = migrationPlanFor({ CONTEXT, DATABASE_URL: 'libsql://prod.turso.io' });
		expect(plan.action).toBe('skip');
		expect(plan.reason).toContain('never migrates the production database');
	});

	it('the preview command skips even when CONTEXT is missing or says production', () => {
		expect(migrationPlanFor({}, { preview: true }).action).toBe('skip');
		expect(migrationPlanFor({ CONTEXT: 'production' }, { preview: true }).action).toBe('skip');
	});

	it('a preview migrates only the opted-in preview database it runs with', () => {
		const preview = 'libsql://quire-preview.turso.io';
		expect(
			migrationPlanFor({ CONTEXT: 'deploy-preview', PREVIEW_DATABASE_URL: preview, DATABASE_URL: preview }).action
		).toBe('migrate');
		const mismatch = migrationPlanFor({
			CONTEXT: 'deploy-preview',
			PREVIEW_DATABASE_URL: preview,
			DATABASE_URL: 'libsql://quire-prod.turso.io'
		});
		expect(mismatch.action).toBe('refuse');
		expect(mismatch.reason).not.toContain('quire-prod');
	});
});

describe('netlify.toml', () => {
	const toml = fs.readFileSync(path.join(ROOT, 'netlify.toml'), 'utf8');

	/** The `command` of a [section], e.g. "build" or "context.production". */
	function commandOf(section: string): string {
		const start = toml.indexOf(`[${section}]`);
		expect(start, section).toBeGreaterThanOrEqual(0);
		const rest = toml.slice(start + section.length + 2);
		const end = rest.search(/^\[/m);
		const match = /^\s*command\s*=\s*"([^"]+)"/m.exec(end === -1 ? rest : rest.slice(0, end));
		expect(match, `${section} command`).not.toBeNull();
		return match![1]!;
	}

	it('production runs check:env, then migrate, then build', () => {
		expect(commandOf('context.production')).toBe('pnpm check:env && pnpm db:migrate && pnpm build');
	});

	it.each(['build', 'context.deploy-preview', 'context.branch-deploy'])(
		'%s never runs the production migrate',
		(section) => {
			const command = commandOf(section);
			expect(command).toBe('pnpm check:env && pnpm db:migrate:preview && pnpm build');
			expect(command).not.toMatch(/db:migrate(?!:preview)/);
		}
	);

	it('names variables, never values', () => {
		expect(toml).not.toMatch(/libsql:\/\/|DATABASE_URL\s*=|AUTH_TOKEN\s*=/);
	});
});

describe('schema.ts and the SQL migrations agree', () => {
	it('drizzle-kit generate finds no changes', () => {
		// Generate into a copy, so a real difference never writes into drizzle/.
		const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'quire-generate-'));
		try {
			fs.cpSync(path.join(ROOT, 'drizzle'), path.join(copy, 'drizzle'), { recursive: true });
			const out = path.relative(ROOT, path.join(copy, 'drizzle'));
			const output = execFileSync(
				path.join(ROOT, 'node_modules/.bin/drizzle-kit'),
				['generate', '--dialect', 'sqlite', '--schema', './src/lib/server/db/schema.ts', '--out', out],
				{ cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
			);
			expect(output).toContain('No schema changes');
			expect(fs.readdirSync(path.join(copy, 'drizzle')).sort()).toEqual(
				fs.readdirSync(path.join(ROOT, 'drizzle')).sort()
			);
		} finally {
			fs.rmSync(copy, { recursive: true, force: true });
		}
	}, 60000);
});
