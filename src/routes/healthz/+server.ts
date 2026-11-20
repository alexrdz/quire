/**
 * GET /healthz (PRODUCTION_PLAN 3.6): uptime checks and deploy smoke tests.
 *
 * `hooks.server.ts` sends this path straight to the route: no auto-seed, no
 * session lookup and no 503 page, so it reports core config problems as JSON.
 * The body holds only the mode, the DB state and the public feature flags.
 * It never includes secrets, env values, config issue names or user data.
 */
import type { RequestHandler } from './$types';
import { getConfig, getPublicFeatures } from '$lib/server/config';

const DB_CHECK_TIMEOUT_MS = 3000;

async function databaseIsUp(): Promise<boolean> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		const { client } = await import('$lib/server/db');
		const timeout = new Promise<never>((_, reject) => {
			timer = setTimeout(() => reject(new Error('timeout')), DB_CHECK_TIMEOUT_MS);
		});
		await Promise.race([client.execute('select 1'), timeout]);
		return true;
	} catch {
		return false;
	} finally {
		clearTimeout(timer);
	}
}

export const GET: RequestHandler = async () => {
	const config = getConfig();
	const coreOk = config.core.ok;
	// With invalid core config the database handle is a stub, so it's never queried.
	const dbUp = coreOk ? await databaseIsUp() : false;
	if (!dbUp) console.error(`[healthz] unhealthy: core=${coreOk ? 'ok' : 'invalid'} db=down`);

	const ok = coreOk && dbUp;
	return Response.json(
		{
			ok,
			mode: config.mode,
			core: coreOk ? 'ok' : 'invalid',
			db: dbUp ? 'ok' : 'down',
			features: getPublicFeatures()
		},
		{ status: ok ? 200 : 503, headers: { 'cache-control': 'no-store' } }
	);
};
