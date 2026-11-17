import {
	approveSlugPetition,
	listSlugPetitions,
	rejectSlugPetition,
	setArtistVerifiedBySlug
} from '../src/lib/server/services/admin';

function printUsage(): void {
	console.log(`Quire Platform Admin CLI

Usage:
  pnpm admin verify <slug>
  pnpm admin unverify <slug>
  pnpm admin petitions [--status=pending|approved|rejected|all]
  pnpm admin approve-petition <petitionId> [--force] [--note="..."]
  pnpm admin reject-petition <petitionId> [--note="..."]
`);
}

function parseOption(args: string[], prefix: string): string | undefined {
	const direct = args.find((arg) => arg.startsWith(`${prefix}=`));
	if (direct) {
		return direct.slice(prefix.length + 1);
	}
	const idx = args.indexOf(prefix);
	if (idx >= 0 && idx + 1 < args.length && !args[idx + 1]?.startsWith('--')) {
		return args[idx + 1];
	}
	return undefined;
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const command = args[0];

	if (!command || command === '--help' || command === '-h') {
		printUsage();
		return;
	}

	if (command === 'verify' || command === 'unverify') {
		const slug = args[1];
		if (!slug) {
			console.error(`Missing <slug> argument for ${command}.`);
			process.exitCode = 1;
			return;
		}
		const verified = command === 'verify';
		const res = await setArtistVerifiedBySlug({ slug, verified });
		if (!res.ok) {
			console.error(`[${res.error.code}] ${res.error.message}`);
			process.exitCode = 1;
			return;
		}
		console.log(
			`[OK] Artist "${res.value.displayName}" (/a/${res.value.slug}) verified=${String(res.value.verified)}`
		);
		return;
	}

	if (command === 'petitions') {
		const statusFilter = parseOption(args.slice(1), '--status') ?? 'all';
		const res = await listSlugPetitions(statusFilter);
		if (!res.ok) {
			console.error(`[${res.error.code}] ${res.error.message}`);
			process.exitCode = 1;
			return;
		}
		if (res.value.length === 0) {
			console.log(`No handle petitions found (filter: ${statusFilter}).`);
			return;
		}
		for (const item of res.value) {
			const ownerInfo = item.existingArtistId
				? `${item.existingArtistDisplayName ?? item.existingArtistId} [status=${item.existingArtistStatus ?? 'unknown'}, slug=${item.existingArtistCurrentSlug ?? 'n/a'}]`
				: 'unassigned';
			console.log(
				`- ${item.id} | /a/${item.requestedSlug} | status=${item.status} | petitioner=${item.petitionerName} <${item.petitionerEmail}> | holder=${ownerInfo}`
			);
		}
		return;
	}

	if (command === 'approve-petition') {
		const petitionId = args[1];
		if (!petitionId || petitionId.startsWith('--')) {
			console.error('Missing <petitionId> argument for approve-petition.');
			process.exitCode = 1;
			return;
		}
		const forceActiveOverride = args.includes('--force');
		const note = parseOption(args.slice(2), '--note');
		const res = await approveSlugPetition({
			petitionId,
			note,
			forceActiveOverride
		});
		if (!res.ok) {
			console.error(`[${res.error.code}] ${res.error.message}`);
			process.exitCode = 1;
			return;
		}
		console.log(
			`[OK] Approved petition ${res.value.petitionId}. Handle /a/${res.value.releasedSlug} released (retired artist ${res.value.retiredArtistId ?? 'none'} -> ${res.value.retiredArtistNewSlug ?? 'n/a'}). Petitioner ${res.value.petitionerEmail} notified.`
		);
		return;
	}

	if (command === 'reject-petition') {
		const petitionId = args[1];
		if (!petitionId || petitionId.startsWith('--')) {
			console.error('Missing <petitionId> argument for reject-petition.');
			process.exitCode = 1;
			return;
		}
		const note = parseOption(args.slice(2), '--note');
		const res = await rejectSlugPetition({ petitionId, note });
		if (!res.ok) {
			console.error(`[${res.error.code}] ${res.error.message}`);
			process.exitCode = 1;
			return;
		}
		console.log(
			`[OK] Rejected petition ${res.value.petitionId} for /a/${res.value.requestedSlug}. Petitioner ${res.value.petitionerEmail} notified.`
		);
		return;
	}

	console.error(`Unknown command: ${command}`);
	printUsage();
	process.exitCode = 1;
}

main().catch((err) => {
	console.error('Admin CLI fatal error:', err);
	process.exitCode = 1;
});
