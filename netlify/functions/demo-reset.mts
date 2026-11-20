/**
 * Netlify scheduled function: the Demo's nightly reset (PRODUCTION_PLAN 4.2,
 * docs/demo-site.md).
 *
 * Both Netlify sites build from this repo, so this function is deployed on the
 * production site too. There it does nothing and logs that: the mode check in
 * `runScheduledDemoReset` runs before any database module is loaded.
 *
 * Scheduled functions run only on their schedule (or "Run now" in the Netlify
 * UI); they have no public URL. In the Demo it migrates, empties every app
 * table and reseeds the sample data.
 */
import { runScheduledDemoReset } from '../../src/lib/server/db/demo-reset';

export default async function demoReset(): Promise<Response> {
	const result = await runScheduledDemoReset();
	return new Response(null, { status: result.status === 'failed' ? 500 : 204 });
}

export const config = {
	// Every day at 09:00 UTC, early morning in the Americas.
	schedule: '0 9 * * *'
};
