/**
 * Applies pending drizzle migrations (PRODUCTION_PLAN 3.5). The only way the
 * schema is created or changed.
 *
 *   pnpm db:migrate           production build and any local run
 *   pnpm db:migrate:local     development: only a file: database, never a remote one
 *   pnpm db:migrate:preview   Netlify deploy previews and branch deploys: skips
 *                             unless a separate preview database is opted in
 *                             (PREVIEW_DATABASE_URL), see docs/database-migrations.md
 *
 * Exits non-zero on failure, so the Netlify build (and the deploy) stops.
 */
import { migrationPlanFor, runMigrations } from '../src/lib/server/db/migrate';
import { developmentRemoteRefusal, loadDotEnv, openTargetDatabase } from './lib/db-target';

loadDotEnv();

const plan = migrationPlanFor(process.env, { preview: process.argv.includes('--preview') });
if (plan.action === 'skip') {
	console.log(`[db:migrate] skipped: ${plan.reason}`);
	process.exit(0);
}
if (plan.action === 'refuse') {
	console.error(`[db:migrate] refused: ${plan.reason}`);
	process.exit(1);
}

// Development never migrates a remote database (B1-T12), before any connection is opened.
const devRefusal = developmentRemoteRefusal();
if (devRefusal) {
	console.error(`[db:migrate] refused: ${devRefusal}`);
	process.exit(1);
}

let target: ReturnType<typeof openTargetDatabase> | null = null;
try {
	target = openTargetDatabase();
	console.log(`[db:migrate] ${plan.reason}; ${target.mode} mode; database ${target.label}`);
	const { applied, total } = await runMigrations(target.client);
	console.log(
		applied === 0
			? `[db:migrate] up to date (${total} migrations)`
			: `[db:migrate] applied ${applied} of ${total} migrations`
	);
} catch (error) {
	console.error(`[db:migrate] failed: ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
} finally {
	target?.client.close();
}
