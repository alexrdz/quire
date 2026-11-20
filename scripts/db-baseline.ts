/**
 * Marks every migration as applied on a database the old runtime DDL created
 * (PRODUCTION_PLAN 3.5). Run once per pre-existing database, before its first
 * migrating deploy. Steps: docs/database-migrations.md.
 *
 *   pnpm db:baseline --dry-run   check only
 *   pnpm db:baseline             check, then record the migrations
 *
 * Refuses, printing the differences, unless the live tables and columns match
 * the latest migration snapshot. Never runs migration SQL or touches data.
 */
import { baselineDatabase, formatDiff } from '../src/lib/server/db/baseline';
import { loadDotEnv, openTargetDatabase } from './lib/db-target';

loadDotEnv();
const dryRun = process.argv.includes('--dry-run');

let target: ReturnType<typeof openTargetDatabase> | null = null;
try {
	target = openTargetDatabase();
	console.log(`[db:baseline] ${target.mode} mode; database ${target.label}${dryRun ? ' (dry run)' : ''}`);
	const result = await baselineDatabase(target.client, { dryRun });
	switch (result.status) {
		case 'baselined':
			console.log(`[db:baseline] schema matches ${result.latest}; recorded ${result.recorded} migrations as applied. Next: pnpm db:migrate (it should report "up to date").`);
			break;
		case 'would-baseline':
			console.log(`[db:baseline] schema matches ${result.latest}; would record ${result.recorded} migrations. Run again without --dry-run to record them.`);
			break;
		case 'already-migrated':
			console.log('[db:baseline] nothing to do: this database already has a migration history. Use pnpm db:migrate.');
			break;
		case 'empty':
			console.log('[db:baseline] nothing to do: the database is empty. Use pnpm db:migrate to create the schema.');
			break;
		case 'mismatch':
			console.error(`[db:baseline] refused: the schema does not match ${result.latest}. Nothing was recorded.\n${formatDiff(result.diff)}`);
			process.exitCode = 1;
			break;
	}
} catch (error) {
	console.error(`[db:baseline] failed: ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
} finally {
	target?.client.close();
}
