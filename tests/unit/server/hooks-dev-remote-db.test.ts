import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Config, DevRemoteDatabase } from '$lib/server/config';

/**
 * B1-T10: `pnpm dev` against a remote database. At startup the hook logs one
 * warning naming the host; requests never seed it and log why, once. A file:
 * database seeds on the first request as before. The real database underneath
 * is the test local.db; only what the config reports is overridden.
 */
const TOKEN = 'eyJ-super-secret-token-value';
const REMOTE: DevRemoteDatabase = { host: 'libsql://quire-prod-alex.turso.io', acknowledged: false };

const state = vi.hoisted(() => ({
	remote: null as null | DevRemoteDatabase,
	seed: vi.fn(async () => undefined)
}));

vi.mock('$lib/server/config', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/config')>();
	return {
		...actual,
		getConfig: (): Config => {
			const base = actual.getConfig();
			return { ...base, autoSeed: true, devRemoteDatabase: state.remote };
		}
	};
});

vi.mock('$lib/server/seed', () => ({ seedDatabase: state.seed }));

function event(path: string) {
	const url = new URL(`http://localhost:5173${path}`);
	return { url, request: new Request(url), locals: {} as App.Locals } as any;
}

const resolve = vi.fn(async () => new Response('<p>page</p>', { headers: { 'content-type': 'text/html' } }));

/** A fresh hooks module, so its startup code and its once-only state run again. */
async function loadHooks(remote: DevRemoteDatabase | null) {
	state.remote = remote;
	vi.resetModules();
	return import('../../../src/hooks.server');
}

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
	state.seed.mockClear();
});

afterEach(() => {
	vi.restoreAllMocks();
	state.remote = null;
});

const warnings = () => warn.mock.calls.map((call) => String(call[0]));

describe('development against a remote database', () => {
	it('warns once at startup with the host, and the first requests do not seed', async () => {
		const { handle } = await loadHooks(REMOTE);
		expect(warnings()).toEqual([
			'[config] Development mode is using a remote database: libsql://quire-prod-alex.turso.io. Reads and writes go to it, not to local.db. For local work set DATABASE_URL=file:local.db.'
		]);

		for (const path of ['/', '/i/neon-velvet-brooklyn-2026-10-12', '/login']) {
			await handle({ event: event(path), resolve: resolve as any });
		}
		expect(state.seed).not.toHaveBeenCalled();

		// The refusal is logged once, not on every request.
		const seedLines = warnings().filter((line) => line.startsWith('[seed]'));
		expect(seedLines).toHaveLength(1);
		expect(seedLines[0]).toContain('Not seeding sample data: DATABASE_URL looks like a remote database (libsql://quire-prod-alex.turso.io)');
		expect(seedLines[0]).toContain('DATABASE_URL=file:local.db');
		for (const line of warnings()) expect(line).not.toContain(TOKEN);
	});

	it('with QUIRE_DEV_REMOTE_DB=true: still warns and still never seeds', async () => {
		const { handle } = await loadHooks({ ...REMOTE, acknowledged: true });
		await handle({ event: event('/'), resolve: resolve as any });
		expect(state.seed).not.toHaveBeenCalled();
		expect(warnings()[0]).toContain('(QUIRE_DEV_REMOTE_DB=true)');
		expect(warnings().some((line) => line.startsWith('[seed] Not seeding sample data'))).toBe(true);
	});

	it('a file: database: no warning, and the first request seeds as before', async () => {
		const { handle } = await loadHooks(null);
		await handle({ event: event('/'), resolve: resolve as any });
		await handle({ event: event('/login'), resolve: resolve as any });
		expect(state.seed).toHaveBeenCalledTimes(1);
		expect(warnings()).toEqual([]);
	});
});
