/**
 * Records the migrations a database created by the old runtime DDL already has
 * as applied (PRODUCTION_PLAN 3.5, B1-T08). Run once per pre-existing database,
 * before its first migrating deploy. Steps: docs/database-migrations.md.
 *
 *   pnpm db:baseline --dry-run                 print the plan, write nothing
 *   pnpm db:baseline                           record up to the newest matching migration
 *   pnpm db:baseline --to 0002_schema_catch_up  require a match with that migration
 *   pnpm db:baseline --allow-extra posts       ignore tables that are in no Quire migration
 *
 * Refuses, printing the differences against the closest migration, unless the
 * live tables and columns match one exactly. Never runs migration SQL, never
 * touches data and never drops anything.
 */
import { baselineDatabase, formatDiff, quireTableNames, tagRange, type BaselineOptions } from '../src/lib/server/db/baseline';
import { loadDotEnv, openTargetDatabase } from './lib/db-target';

const USAGE = 'Usage: pnpm db:baseline [--dry-run] [--to <migration>] [--allow-extra <table>[,<table>...]]';

/** Parses the flags. `--to x` and `--to=x` both work; `--allow-extra` may repeat. */
function parseBaselineArgs(argv: string[]): { options: BaselineOptions; error?: string } {
	const options: BaselineOptions = {};
	const allowExtra: string[] = [];
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]!;
		const [flag, inline] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined];
		const value = () => inline ?? argv[++i];
		if (flag === '--dry-run' && inline === undefined) {
			options.dryRun = true;
		} else if (flag === '--to') {
			const to = value();
			if (!to || to.startsWith('--')) return { options, error: `--to needs a migration. ${USAGE}` };
			options.to = to;
		} else if (flag === '--allow-extra') {
			const tables = value();
			if (!tables || tables.startsWith('--')) return { options, error: `--allow-extra needs a table name. ${USAGE}` };
			allowExtra.push(...tables.split(',').map((name) => name.trim()).filter(Boolean));
		} else {
			return { options, error: `Unknown argument ${arg}. ${USAGE}` };
		}
	}
	if (allowExtra.length > 0) options.allowExtra = allowExtra;
	return { options };
}

async function main(): Promise<void> {
	const { options, error } = parseBaselineArgs(process.argv.slice(2));
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
		const result = await baselineDatabase(target.client, options);
		switch (result.status) {
			case 'baselined':
			case 'would-baseline': {
				const dry = result.status === 'would-baseline';
				const pending =
					result.pendingTags.length > 0
						? `db:migrate then applies ${result.pendingTags.map((tag) => tag.slice(0, 4)).join(', ')}`
						: 'db:migrate then has nothing to apply';
				console.log(
					`[db:baseline] schema matches ${result.matched}; ${dry ? 'will record' : 'recorded'} ${tagRange(result.recordedTags)}; ${pending}`
				);
				if (result.pendingTags.length > 0) {
					console.log(`[db:baseline] still to apply with pnpm db:migrate: ${result.pendingTags.join(', ')}`);
				}
				if (result.ignoredTables.length > 0) {
					console.log(`[db:baseline] ignored, left untouched (not Quire's): ${result.ignoredTables.join(', ')}`);
				}
				console.log(
					dry
						? `[db:baseline] dry run: nothing was written. Run again without --dry-run to record ${result.recordedTags.length} migrations.`
						: `[db:baseline] recorded ${result.recordedTags.length} migrations as applied. Next: pnpm db:migrate${result.pendingTags.length > 0 ? '' : ' (it should report "up to date")'}.`
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
