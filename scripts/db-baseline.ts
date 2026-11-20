/**
 * Records the migrations a database created by the old runtime DDL already has
 * as applied (PRODUCTION_PLAN 3.5, B1-T08). Run once per pre-existing database,
 * before its first migrating deploy. Steps: docs/database-migrations.md.
 *
 *   pnpm db:baseline --dry-run                 print the plan, write nothing
 *   pnpm db:baseline                           print the plan, write nothing, ask for --yes
 *   pnpm db:baseline --yes                     print the plan, then record it
 *   pnpm db:baseline --to 0002_schema_catch_up  require a match with that migration
 *   pnpm db:baseline --allow-extra posts       ignore tables that are in no Quire migration
 *
 * The only write is the migration history (`__drizzle_migrations`), and only
 * with --yes. It may be a production database, so the plan and the target
 * host are always printed first.
 * Refuses, printing the differences against the closest migration, unless the
 * live tables and columns match one exactly. Never runs migration SQL, never
 * touches data and never drops anything.
 */
import { baselineDatabase, formatDiff, quireTableNames, tagRange, type BaselineOptions } from '../src/lib/server/db/baseline';
import { loadDotEnv, openTargetDatabase } from './lib/db-target';

const USAGE = 'Usage: pnpm db:baseline [--dry-run | --yes] [--to <migration>] [--allow-extra <table>[,<table>...]]';

/** Parses the flags. `--to x` and `--to=x` both work; `--allow-extra` may repeat. */
function parseBaselineArgs(argv: string[]): { options: BaselineOptions; yes: boolean; error?: string } {
	const options: BaselineOptions = {};
	let yes = false;
	const allowExtra: string[] = [];
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]!;
		const [flag, inline] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined];
		const value = () => inline ?? argv[++i];
		if (flag === '--dry-run' && inline === undefined) {
			options.dryRun = true;
		} else if (flag === '--yes' && inline === undefined) {
			yes = true;
		} else if (flag === '--to') {
			const to = value();
			if (!to || to.startsWith('--')) return { options, yes, error: `--to needs a migration. ${USAGE}` };
			options.to = to;
		} else if (flag === '--allow-extra') {
			const tables = value();
			if (!tables || tables.startsWith('--')) return { options, yes, error: `--allow-extra needs a table name. ${USAGE}` };
			allowExtra.push(...tables.split(',').map((name) => name.trim()).filter(Boolean));
		} else {
			return { options, yes, error: `Unknown argument ${arg}. ${USAGE}` };
		}
	}
	if (allowExtra.length > 0) options.allowExtra = allowExtra;
	if (yes && options.dryRun) return { options, yes, error: `--dry-run and --yes don't go together. ${USAGE}` };
	return { options, yes };
}

async function main(): Promise<void> {
	const { options, yes, error } = parseBaselineArgs(process.argv.slice(2));
	if (error) {
		console.error(`[db:baseline] ${error}`);
		process.exitCode = 1;
		return;
	}

	loadDotEnv();
	let target: ReturnType<typeof openTargetDatabase> | null = null;
	try {
		target = openTargetDatabase();
		console.log(`[db:baseline] ${target.mode} mode; database ${target.label}${options.dryRun ? ' (dry run)' : ''}`);
		// Always plan first; record only after printing it, and only with --yes.
		const result = await baselineDatabase(target.client, { ...options, dryRun: true });
		switch (result.status) {
			case 'baselined':
				// Never reached: the plan is always a dry run.
				break;
			case 'would-baseline': {
				const pending =
					result.pendingTags.length > 0
						? `db:migrate then applies ${result.pendingTags.map((tag) => tag.slice(0, 4)).join(', ')}`
						: 'db:migrate then has nothing to apply';
				console.log(
					`[db:baseline] schema matches ${result.matched}; will record ${tagRange(result.recordedTags)}; ${pending}`
				);
				console.log('[db:baseline] plan:');
				console.log(`  database:           ${target.label}`);
				console.log(`  matches:            ${result.matched}`);
				console.log(`  will record:        ${result.recordedTags.join(', ')}`);
				console.log(`  db:migrate applies: ${result.pendingTags.length > 0 ? result.pendingTags.join(', ') : '(nothing)'}`);
				console.log(`  ignored, untouched: ${result.ignoredTables.length > 0 ? result.ignoredTables.join(', ') : '(none)'}`);
				console.log('  writes:             only the migration history table, __drizzle_migrations');

				if (options.dryRun) {
					console.log(`[db:baseline] dry run: nothing was written. To record it: the same command with --yes instead of --dry-run.`);
					break;
				}
				if (!yes) {
					console.error('[db:baseline] nothing was written. Check the plan and the database above, then run the same command with --yes to record it.');
					process.exitCode = 1;
					break;
				}

				const recorded = await baselineDatabase(target.client, { ...options, dryRun: false });
				if (recorded.status !== 'baselined' || recorded.matched !== result.matched) {
					// The database changed between the plan and the write.
					console.error(`[db:baseline] refused: the database changed since the plan (${recorded.status}). Run it again.`);
					process.exitCode = 1;
					break;
				}
				console.log(
					`[db:baseline] recorded ${recorded.recordedTags.length} migrations as applied (${tagRange(recorded.recordedTags)}). Next: pnpm db:migrate${recorded.pendingTags.length > 0 ? `, which applies ${recorded.pendingTags.join(', ')}` : ' (it should report "up to date")'}.`
				);
				break;
			}
			case 'already-migrated':
				console.log('[db:baseline] nothing to do: this database already has a migration history. Use pnpm db:migrate.');
				break;
			case 'empty':
				console.log('[db:baseline] nothing to do: the database is empty. Use pnpm db:migrate to create the schema.');
				break;
			case 'mismatch':
				console.error(
					`[db:baseline] refused: the schema does not match ${result.forced ? result.closest : `any migration; closest is ${result.closest}`}. Nothing was recorded.\n${formatDiff(result.diff)}`
				);
				{
					const quire = new Set(quireTableNames());
					const foreign = result.diff.extraTables.filter((name) => !quire.has(name));
					if (foreign.length > 0) {
						console.error(
							`[db:baseline] ${foreign.join(', ')} ${foreign.length === 1 ? 'is' : 'are'} in no Quire migration. If ${foreign.length === 1 ? 'it belongs' : 'they belong'} to something else, add --allow-extra ${foreign.join(',')} to leave ${foreign.length === 1 ? 'it' : 'them'} untouched.`
						);
					}
				}
				process.exitCode = 1;
				break;
			case 'invalid-option':
				console.error(`[db:baseline] ${result.message}`);
				process.exitCode = 1;
				break;
		}
	} catch (err) {
		console.error(`[db:baseline] failed: ${err instanceof Error ? err.message : String(err)}`);
		process.exitCode = 1;
	} finally {
		target?.client.close();
	}
}

await main();
