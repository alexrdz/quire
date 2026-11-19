import crypto from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { client, db, schema } from './db';
import { eq, and } from 'drizzle-orm';
import { calculateStampWindow } from '$domain/stamping';
import { allowsSampleData, getConfig } from './config';

async function ensureColumnExists(tableName: string, columnName: string, columnDef: string) {
	try {
		const info = await client.execute(`PRAGMA table_info(${tableName})`);
		const exists = info.rows.some((row) => String(row.name) === columnName);
		if (!exists) {
			await client.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
		}
	} catch {}
}

export async function ensureSchemaTables() {
	await client.execute('PRAGMA foreign_keys = ON');

	const tableStatements = [
		`CREATE TABLE IF NOT EXISTS users (
			id text PRIMARY KEY NOT NULL,
			name text NOT NULL,
			email text NOT NULL,
			email_verified integer DEFAULT false NOT NULL,
			image text,
			account_type text DEFAULT 'fan' NOT NULL,
			created_at integer NOT NULL,
			updated_at integer NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS accounts (
			id text PRIMARY KEY NOT NULL,
			user_id text NOT NULL,
			account_id text NOT NULL,
			provider_id text NOT NULL,
			access_token text,
			refresh_token text,
			id_token text,
			access_token_expires_at integer,
			refresh_token_expires_at integer,
			scope text,
			expires_at integer,
			password text,
			created_at integer NOT NULL,
			updated_at integer NOT NULL,
			FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
		)`,
		`CREATE TABLE IF NOT EXISTS sessions (
			id text PRIMARY KEY NOT NULL,
			user_id text NOT NULL,
			token text NOT NULL,
			expires_at integer NOT NULL,
			ip_address text,
			user_agent text,
			created_at integer NOT NULL,
			updated_at integer NOT NULL,
			FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
		)`,
		`CREATE TABLE IF NOT EXISTS verifications (
			id text PRIMARY KEY NOT NULL,
			identifier text NOT NULL,
			value text NOT NULL,
			expires_at integer NOT NULL,
			created_at integer,
			updated_at integer
		)`,
		`CREATE TABLE IF NOT EXISTS artists (
			id text PRIMARY KEY NOT NULL,
			user_id text NOT NULL,
			slug text NOT NULL,
			display_name text NOT NULL,
			bio text DEFAULT '',
			cover_art_url text,
			accent_color text DEFAULT '#05D9E8' NOT NULL,
			type_pairing text DEFAULT 'sans-serif' NOT NULL,
			tip_presets_json text DEFAULT '[3, 5, 10]' NOT NULL,
			links_json text DEFAULT '[]' NOT NULL,
			stripe_account_id text,
			payouts_enabled integer DEFAULT false NOT NULL,
			verified integer DEFAULT false NOT NULL,
			general_wall_approve_first integer DEFAULT false NOT NULL,
			account_status text DEFAULT 'active' NOT NULL,
			closed_at integer,
			created_at integer NOT NULL,
			updated_at integer NOT NULL,
			FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
		)`,
		`CREATE TABLE IF NOT EXISTS slug_petitions (
			id text PRIMARY KEY NOT NULL,
			requested_slug text NOT NULL,
			existing_artist_id text NOT NULL,
			existing_artist_closed integer DEFAULT false NOT NULL,
			petitioner_name text NOT NULL,
			petitioner_email text NOT NULL,
			evidence_url text,
			rationale text NOT NULL,
			status text DEFAULT 'pending' NOT NULL,
			created_at integer NOT NULL,
			updated_at integer NOT NULL,
			FOREIGN KEY (existing_artist_id) REFERENCES artists(id) ON UPDATE no action ON DELETE cascade
		)`,
		`CREATE TABLE IF NOT EXISTS payout_change_tokens (
			id text PRIMARY KEY NOT NULL,
			artist_id text NOT NULL,
			user_id text NOT NULL,
			token_hash text NOT NULL,
			action text DEFAULT 'connect' NOT NULL,
			target_stripe_account_id text,
			status text DEFAULT 'pending' NOT NULL,
			expires_at integer NOT NULL,
			confirmed_at integer,
			created_at integer NOT NULL,
			FOREIGN KEY (artist_id) REFERENCES artists(id) ON UPDATE no action ON DELETE cascade,
			FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
		)`,
		`CREATE TABLE IF NOT EXISTS issues (
			id text PRIMARY KEY NOT NULL,
			artist_id text NOT NULL,
			slug text NOT NULL,
			city text NOT NULL,
			venue text NOT NULL,
			date text NOT NULL,
			timezone text DEFAULT 'America/New_York' NOT NULL,
			cover_note text DEFAULT '' NOT NULL,
			secret_key text NOT NULL,
			status text DEFAULT 'draft' NOT NULL,
			stamp_window_start integer,
			stamp_window_end integer,
			approve_first integer DEFAULT false NOT NULL,
			published_at integer,
			archived_at integer,
			created_at integer NOT NULL,
			updated_at integer NOT NULL,
			FOREIGN KEY (artist_id) REFERENCES artists(id) ON UPDATE no action ON DELETE cascade
		)`,
		`CREATE TABLE IF NOT EXISTS issue_pages (
			id text PRIMARY KEY NOT NULL,
			issue_id text NOT NULL,
			position integer NOT NULL,
			kind text NOT NULL,
			content_json text NOT NULL,
			created_at integer NOT NULL,
			FOREIGN KEY (issue_id) REFERENCES issues(id) ON UPDATE no action ON DELETE cascade
		)`,
		`CREATE TABLE IF NOT EXISTS template_pages (
			id text PRIMARY KEY NOT NULL,
			artist_id text NOT NULL,
			position integer NOT NULL,
			kind text NOT NULL,
			content_json text NOT NULL,
			created_at integer NOT NULL,
			FOREIGN KEY (artist_id) REFERENCES artists(id) ON UPDATE no action ON DELETE cascade
		)`,
		`CREATE TABLE IF NOT EXISTS tips (
			id text PRIMARY KEY NOT NULL,
			artist_id text NOT NULL,
			issue_id text,
			amount_gross integer NOT NULL,
			fee_stripe integer NOT NULL,
			fee_platform integer NOT NULL,
			amount_net integer NOT NULL,
			fan_covered_fees integer DEFAULT false NOT NULL,
			stripe_payment_id text NOT NULL,
			status text DEFAULT 'succeeded' NOT NULL,
			refunded_at integer,
			created_at integer NOT NULL,
			FOREIGN KEY (artist_id) REFERENCES artists(id) ON UPDATE no action ON DELETE cascade,
			FOREIGN KEY (issue_id) REFERENCES issues(id) ON UPDATE no action ON DELETE set null
		)`,
		`CREATE TABLE IF NOT EXISTS notes (
			id text PRIMARY KEY NOT NULL,
			artist_id text NOT NULL,
			issue_id text,
			fan_user_id text NOT NULL,
			body text NOT NULL,
			status text DEFAULT 'live' NOT NULL,
			flag_count integer DEFAULT 0 NOT NULL,
			flag_immune integer DEFAULT false NOT NULL,
			created_at integer NOT NULL,
			FOREIGN KEY (artist_id) REFERENCES artists(id) ON UPDATE no action ON DELETE cascade,
			FOREIGN KEY (issue_id) REFERENCES issues(id) ON UPDATE no action ON DELETE set null,
			FOREIGN KEY (fan_user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
		)`,
		`CREATE TABLE IF NOT EXISTS note_replies (
			id text PRIMARY KEY NOT NULL,
			note_id text NOT NULL,
			artist_id text NOT NULL,
			body text NOT NULL,
			created_at integer NOT NULL,
			FOREIGN KEY (note_id) REFERENCES notes(id) ON UPDATE no action ON DELETE cascade,
			FOREIGN KEY (artist_id) REFERENCES artists(id) ON UPDATE no action ON DELETE cascade
		)`,
		`CREATE TABLE IF NOT EXISTS note_flags (
			id text PRIMARY KEY NOT NULL,
			note_id text NOT NULL,
			fan_user_id text NOT NULL,
			created_at integer NOT NULL,
			FOREIGN KEY (note_id) REFERENCES notes(id) ON UPDATE no action ON DELETE cascade,
			FOREIGN KEY (fan_user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
		)`,
		`CREATE TABLE IF NOT EXISTS blocks (
			id text PRIMARY KEY NOT NULL,
			artist_id text NOT NULL,
			fan_user_id text NOT NULL,
			created_at integer NOT NULL,
			FOREIGN KEY (artist_id) REFERENCES artists(id) ON UPDATE no action ON DELETE cascade,
			FOREIGN KEY (fan_user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
		)`,
		`CREATE TABLE IF NOT EXISTS collections (
			id text PRIMARY KEY NOT NULL,
			fan_user_id text NOT NULL,
			issue_id text NOT NULL,
			kind text NOT NULL,
			created_at integer NOT NULL,
			FOREIGN KEY (fan_user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade,
			FOREIGN KEY (issue_id) REFERENCES issues(id) ON UPDATE no action ON DELETE cascade
		)`,
		`CREATE TABLE IF NOT EXISTS scans (
			id text PRIMARY KEY NOT NULL,
			issue_id text NOT NULL,
			token_hash text NOT NULL,
			scanned_at integer NOT NULL,
			FOREIGN KEY (issue_id) REFERENCES issues(id) ON UPDATE no action ON DELETE cascade
		)`,
		`CREATE TABLE IF NOT EXISTS rate_limits (
			key text PRIMARY KEY NOT NULL,
			count integer NOT NULL,
			window_start integer NOT NULL,
			expires_at integer NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS auth_rate_limits (
			id text PRIMARY KEY NOT NULL,
			key text NOT NULL,
			count integer NOT NULL,
			last_request integer NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS tip_taps (
			id text PRIMARY KEY NOT NULL,
			artist_id text NOT NULL,
			issue_id text,
			amount_selected_cents integer NOT NULL,
			created_at integer NOT NULL,
			FOREIGN KEY (artist_id) REFERENCES artists(id) ON UPDATE no action ON DELETE cascade,
			FOREIGN KEY (issue_id) REFERENCES issues(id) ON UPDATE no action ON DELETE set null
		)`,
		`CREATE TABLE IF NOT EXISTS venmo_change_tokens (
			id text PRIMARY KEY NOT NULL,
			artist_id text NOT NULL,
			new_username text,
			token_hash text NOT NULL,
			expires_at integer NOT NULL,
			used_at integer,
			created_at integer NOT NULL,
			FOREIGN KEY (artist_id) REFERENCES artists(id) ON UPDATE no action ON DELETE cascade
		)`
	];

	for (const stmt of tableStatements) {
		await client.execute(stmt);
	}

	await ensureColumnExists('artists', 'account_status', "text DEFAULT 'active' NOT NULL");
	await ensureColumnExists('artists', 'closed_at', 'integer');
	await ensureColumnExists('issues', 'archived_at', 'integer');
	await ensureColumnExists('tips', 'status', "text DEFAULT 'succeeded' NOT NULL");
	await ensureColumnExists('tips', 'refunded_at', 'integer');
	await ensureColumnExists('artists', 'venmo_username', 'text');

	const indexStatements = [
		`CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email)`,
		`CREATE INDEX IF NOT EXISTS users_account_type_idx ON users (account_type)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_unique ON sessions (token)`,
		`CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id)`,
		`CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at)`,
		`CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON accounts (user_id)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS accounts_provider_account_unique ON accounts (provider_id, account_id)`,
		`CREATE INDEX IF NOT EXISTS verifications_identifier_idx ON verifications (identifier)`,
		`CREATE INDEX IF NOT EXISTS verifications_expires_at_idx ON verifications (expires_at)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS artists_slug_unique ON artists (slug)`,
		`CREATE INDEX IF NOT EXISTS artists_user_id_idx ON artists (user_id)`,
		`CREATE INDEX IF NOT EXISTS artists_stripe_account_id_idx ON artists (stripe_account_id)`,
		`CREATE INDEX IF NOT EXISTS artists_account_status_idx ON artists (account_status)`,
		`CREATE INDEX IF NOT EXISTS slug_petitions_slug_status_idx ON slug_petitions (requested_slug, status)`,
		`CREATE INDEX IF NOT EXISTS slug_petitions_artist_idx ON slug_petitions (existing_artist_id)`,
		`CREATE INDEX IF NOT EXISTS slug_petitions_email_idx ON slug_petitions (petitioner_email)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS payout_change_tokens_token_hash_unique ON payout_change_tokens (token_hash)`,
		`CREATE INDEX IF NOT EXISTS payout_change_tokens_artist_status_idx ON payout_change_tokens (artist_id, status)`,
		`CREATE INDEX IF NOT EXISTS payout_change_tokens_expires_at_idx ON payout_change_tokens (expires_at)`,
		`CREATE INDEX IF NOT EXISTS template_pages_artist_position_idx ON template_pages (artist_id, position)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS issues_slug_unique ON issues (slug)`,
		`CREATE INDEX IF NOT EXISTS issues_artist_status_idx ON issues (artist_id, status)`,
		`CREATE INDEX IF NOT EXISTS issues_artist_date_idx ON issues (artist_id, date)`,
		`CREATE INDEX IF NOT EXISTS issue_pages_issue_position_idx ON issue_pages (issue_id, position)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS tips_stripe_payment_id_unique ON tips (stripe_payment_id)`,
		`CREATE INDEX IF NOT EXISTS tips_artist_created_idx ON tips (artist_id, created_at)`,
		`CREATE INDEX IF NOT EXISTS tips_issue_id_idx ON tips (issue_id)`,
		`CREATE INDEX IF NOT EXISTS tips_status_idx ON tips (status)`,
		`CREATE INDEX IF NOT EXISTS notes_artist_status_created_idx ON notes (artist_id, status, created_at)`,
		`CREATE INDEX IF NOT EXISTS notes_issue_status_idx ON notes (issue_id, status)`,
		`CREATE INDEX IF NOT EXISTS notes_fan_user_id_idx ON notes (fan_user_id)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS note_replies_note_id_unique ON note_replies (note_id)`,
		`CREATE INDEX IF NOT EXISTS note_replies_artist_id_idx ON note_replies (artist_id)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS note_flags_note_fan_unique ON note_flags (note_id, fan_user_id)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS blocks_artist_fan_unique ON blocks (artist_id, fan_user_id)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS collections_fan_issue_unique ON collections (fan_user_id, issue_id)`,
		`CREATE INDEX IF NOT EXISTS collections_issue_kind_idx ON collections (issue_id, kind)`,
		`CREATE INDEX IF NOT EXISTS scans_token_hash_idx ON scans (token_hash)`,
		`CREATE INDEX IF NOT EXISTS scans_issue_scanned_idx ON scans (issue_id, scanned_at)`,
		`CREATE INDEX IF NOT EXISTS rate_limits_expires_at_idx ON rate_limits (expires_at)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS auth_rate_limits_key_unique ON auth_rate_limits (key)`,
		`CREATE INDEX IF NOT EXISTS tip_taps_artist_issue_idx ON tip_taps (artist_id, issue_id)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS venmo_change_tokens_token_hash_unique ON venmo_change_tokens (token_hash)`,
		`CREATE INDEX IF NOT EXISTS venmo_change_tokens_artist_idx ON venmo_change_tokens (artist_id)`,
		`CREATE INDEX IF NOT EXISTS venmo_change_tokens_expires_at_idx ON venmo_change_tokens (expires_at)`
	];

	for (const stmt of indexStatements) {
		await client.execute(stmt);
	}
}

/**
 * Venmo username of the sample Artist (development, test and the Demo only).
 * It may belong to a real person, so the settings page never opens it outside production.
 */
export const SAMPLE_VENMO_USERNAME = 'quire-sample-band';

/** The sample Issue whose Stamp Window is kept open so the scan flow can be tried (and e2e-tested) at any time. */
export const OPEN_WINDOW_SAMPLE_SLUG = 'neon-velvet-brooklyn-2026-10-12';

/**
 * A 48-hour Stamp Window starting one hour before `now`. Used only for the Brooklyn
 * sample Issue: its fixed 2026-10-12 window has passed, which made a valid scan of the
 * sample data impossible. Its slug and date label stay unchanged. Sample data only exists
 * in development, test and the Demo, so this never touches a real Issue.
 */
export function openSampleStampWindow(now: Date): { start: Date; end: Date } {
	const start = new Date(now.getTime() - 60 * 60 * 1000);
	const end = new Date(start.getTime() + 48 * 60 * 60 * 1000 - 1);
	return { start, end };
}

async function reopenSampleStampWindow(now: Date): Promise<void> {
	const window = openSampleStampWindow(now);
	await db
		.update(schema.issues)
		.set({ stampWindowStart: window.start, stampWindowEnd: window.end })
		.where(eq(schema.issues.slug, OPEN_WINDOW_SAMPLE_SLUG));
}

export const SEED_REFUSED_MESSAGE =
	'Refusing to seed sample data in production mode. Run it with NODE_ENV=development or DEMO_MODE=true (ADR 0007).';

/**
 * Loads the sample Artist, Fan and Issues. Development, test and the Demo only:
 * throws in production so sample accounts with known passwords never reach a real database.
 */
export async function seedDatabase() {
	if (!allowsSampleData(getConfig().mode)) {
		throw new Error(SEED_REFUSED_MESSAGE);
	}

	await ensureSchemaTables();

	const existingArtist = await db.query.artists.findFirst({
		where: eq(schema.artists.slug, 'the-neon-velvet'),
		with: {
			issues: {
				with: {
					tips: true,
					issuePages: true
				}
			}
		}
	});

	const now = new Date();

	if (existingArtist) {
		await ensureArtistPasswordCredential(existingArtist.userId);
		await reopenSampleStampWindow(now);
		return existingArtist;
	}

	console.log('Seeding Quire database...');

	// 1. Create Artist User with real Better Auth credential hash (password: neonvelvet123)
	const artistUserId = crypto.randomUUID();
	const hashedPassword = await hashPassword('neonvelvet123');

	await db.insert(schema.users).values({
		id: artistUserId,
		name: 'The Neon Velvet',
		email: 'demo@neonvelvet.band',
		emailVerified: true,
		accountType: 'artist',
		createdAt: now,
		updatedAt: now
	});

	await db.insert(schema.accounts).values({
		id: crypto.randomUUID(),
		accountId: artistUserId,
		providerId: 'credential',
		userId: artistUserId,
		password: hashedPassword,
		createdAt: now,
		updatedAt: now
	});

	// 2. Create Fan Users
	const fan1Id = crypto.randomUUID();
	await db.insert(schema.users).values({
		id: fan1Id,
		name: 'Maya Lin',
		email: 'maya@example.com',
		emailVerified: true,
		accountType: 'fan',
		createdAt: now,
		updatedAt: now
	});

	const fan2Id = crypto.randomUUID();
	await db.insert(schema.users).values({
		id: fan2Id,
		name: 'Devon Vance',
		email: 'devon@example.com',
		emailVerified: true,
		accountType: 'fan',
		createdAt: now,
		updatedAt: now
	});

	const fan3Id = crypto.randomUUID();
	await db.insert(schema.users).values({
		id: fan3Id,
		name: 'Samir Patel',
		email: 'samir@example.com',
		emailVerified: true,
		accountType: 'fan',
		createdAt: now,
		updatedAt: now
	});

	// 3. Create Artist Profile
	const artistId = crypto.randomUUID();
	await db.insert(schema.artists).values({
		id: artistId,
		userId: artistUserId,
		slug: 'the-neon-velvet',
		displayName: 'The Neon Velvet',
		bio: 'Electric fuzz, analog synths, and post-punk grit from Brooklyn, NY. Catch us on the East Coast Fall Run.',
		coverArtUrl:
			'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=1200',
		accentColor: '#05D9E8',
		typePairing: 'sans-serif',
		tipPresetsJson: '[3, 5, 10]',
		linksJson: JSON.stringify([
			{ label: 'Bandcamp', url: 'https://bandcamp.com' },
			{ label: 'Tour Tickets', url: 'https://dice.fm' },
			{ label: 'Vinyl Merch', url: 'https://hellomerch.com' }
		]),
		venmoUsername: SAMPLE_VENMO_USERNAME,
		stripeAccountId: 'acct_demo_neon_velvet',
		payoutsEnabled: true,
		verified: true,
		generalWallApproveFirst: false,
		createdAt: now,
		updatedAt: now
	});

	// 4. Create Master Template Pages
	await db.insert(schema.templatePages).values([
		{
			id: crypto.randomUUID(),
			artistId,
			position: 1,
			kind: 'text',
			contentJson: JSON.stringify({
				title: 'Liner Notes: The East Coast Run',
				body: 'The Neon Velvet was born in damp rehearsal basements across Greenpoint. We believe physical presence and shared vibrations outlast algorithmic feeds. Every song on this run was tracked live to 2-inch tape.'
			}),
			createdAt: now
		},
		{
			id: crypto.randomUUID(),
			artistId,
			position: 2,
			kind: 'audio',
			contentJson: JSON.stringify({
				title: 'Studio Session 04 (Rough Bridge Mix)',
				duration: '03:42',
				body: 'Unreleased four-track bounce from our Greenpoint loft before loading the van. Needs more fuzz on the outro.'
			}),
			createdAt: now
		}
	]);

	// 5. Create 3-City Tour Issues
	const issue1Window = openSampleStampWindow(now);
	const issue1Id = crypto.randomUUID();
	await db.insert(schema.issues).values({
		id: issue1Id,
		artistId,
		slug: OPEN_WINDOW_SAMPLE_SLUG,
		city: 'Brooklyn',
		venue: "Baby's All Right",
		date: '2026-10-12',
		timezone: 'America/New_York',
		coverNote: 'Tour kickoff show! Playing the entire new record with extended fuzz jams.',
		secretKey: 'kickoff_babys_secret_2026',
		status: 'published',
		stampWindowStart: issue1Window.start,
		stampWindowEnd: issue1Window.end,
		approveFirst: false,
		publishedAt: new Date('2026-10-12T12:00:00Z'),
		createdAt: now,
		updatedAt: now
	});

	const issue2Window = calculateStampWindow('2026-10-15', 'America/New_York');
	const issue2Id = crypto.randomUUID();
	await db.insert(schema.issues).values({
		id: issue2Id,
		slug: 'neon-velvet-philly-2026-10-15',
		artistId,
		city: 'Philadelphia',
		venue: "Johnny Brenda's",
		date: '2026-10-15',
		timezone: 'America/New_York',
		coverNote: 'Balcony was shaking during the chorus. Fish & chips downstairs after the set.',
		secretKey: 'philly_jb_secret_2026',
		status: 'published',
		stampWindowStart: issue2Window.ok ? issue2Window.value.start : now,
		stampWindowEnd: issue2Window.ok ? issue2Window.value.end : now,
		approveFirst: false,
		publishedAt: new Date('2026-10-15T12:00:00Z'),
		createdAt: now,
		updatedAt: now
	});

	const issue3Window = calculateStampWindow('2026-10-18', 'America/New_York');
	const issue3Id = crypto.randomUUID();
	await db.insert(schema.issues).values({
		id: issue3Id,
		slug: 'neon-velvet-dc-2026-10-18',
		artistId,
		city: 'Washington, DC',
		venue: 'Black Cat',
		date: '2026-10-18',
		timezone: 'America/New_York',
		coverNote: 'Main stage tonight. Soundcheck sounded massive.',
		secretKey: 'dc_blackcat_secret_2026',
		status: 'published',
		stampWindowStart: issue3Window.ok ? issue3Window.value.start : now,
		stampWindowEnd: issue3Window.ok ? issue3Window.value.end : now,
		approveFirst: false,
		publishedAt: new Date('2026-10-18T12:00:00Z'),
		createdAt: now,
		updatedAt: now
	});

	// Bespoke Pages across all 3 issues
	await db.insert(schema.issuePages).values([
		{
			id: crypto.randomUUID(),
			issueId: issue1Id,
			position: 1,
			kind: 'setlist',
			contentJson: JSON.stringify({
				songs: [
					'Static Bloom',
					'Echoes on the Waterfront',
					'Velvet Wire',
					'Afterglow',
					'Subway Static (Encore)'
				]
			}),
			createdAt: now
		},
		{
			id: crypto.randomUUID(),
			issueId: issue1Id,
			position: 2,
			kind: 'photo',
			contentJson: JSON.stringify({
				title: 'Tour Diary: Brooklyn Kickoff',
				imageUrl:
					'https://images.unsplash.com/photo-1598387181032-a3103a2db5b3?auto=format&fit=crop&q=80&w=1000',
				body: 'Sold out the back room at Baby’s. You animals broke the barricade on song three.'
			}),
			createdAt: now
		},
		{
			id: crypto.randomUUID(),
			issueId: issue2Id,
			position: 1,
			kind: 'setlist',
			contentJson: JSON.stringify({
				songs: [
					'Concrete Choir',
					'Static Bloom',
					'Fishtown Rain (Improv)',
					'Velvet Wire',
					'Night Bus to Girard'
				]
			}),
			createdAt: now
		},
		{
			id: crypto.randomUUID(),
			issueId: issue3Id,
			position: 1,
			kind: 'setlist',
			contentJson: JSON.stringify({
				songs: [
					'14th Street Hum',
					'Static Bloom',
					'Echoes on the Waterfront',
					'Red Room Synth Jam',
					'Subway Static (Extended)'
				]
			}),
			createdAt: now
		},
		{
			id: crypto.randomUUID(),
			issueId: issue3Id,
			position: 2,
			kind: 'text',
			contentJson: JSON.stringify({
				title: 'Late Night at Black Cat',
				body: 'Drove down I-95 through pouring rain, loaded the Rhodes up the freight elevator, and walked out to a packed floor. DC always shows up loud.'
			}),
			createdAt: now
		}
	]);

	// Tip taps (ADR 0008) across Gig 1, Gig 2, Gig 3 and the General Back Page.
	// Taps only: a Fan opened Venmo. They never represent money received.
	const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);
	await db.insert(schema.tipTaps).values([
		{ id: crypto.randomUUID(), artistId, issueId: issue1Id, amountSelectedCents: 500, createdAt: hoursAgo(30) },
		{ id: crypto.randomUUID(), artistId, issueId: issue1Id, amountSelectedCents: 1000, createdAt: hoursAgo(29) },
		{ id: crypto.randomUUID(), artistId, issueId: issue1Id, amountSelectedCents: 300, createdAt: hoursAgo(28) },
		{ id: crypto.randomUUID(), artistId, issueId: issue2Id, amountSelectedCents: 500, createdAt: hoursAgo(20) },
		{ id: crypto.randomUUID(), artistId, issueId: issue2Id, amountSelectedCents: 500, createdAt: hoursAgo(19) },
		{ id: crypto.randomUUID(), artistId, issueId: issue3Id, amountSelectedCents: 1000, createdAt: hoursAgo(6) },
		{ id: crypto.randomUUID(), artistId, issueId: null, amountSelectedCents: 300, createdAt: hoursAgo(48) },
		{ id: crypto.randomUUID(), artistId, issueId: null, amountSelectedCents: 500, createdAt: hoursAgo(2) }
	]);

	// Tips across Gig 1, Gig 2, Gig 3, and General Back Page
	await db.insert(schema.tips).values([
		{
			id: crypto.randomUUID(),
			artistId,
			issueId: issue1Id,
			amountGross: 1000,
			feeStripe: 59,
			feePlatform: 50,
			amountNet: 891,
			fanCoveredFees: false,
			stripePaymentId: 'pi_demo_seed_1',
			createdAt: new Date('2026-10-12T22:15:00Z')
		},
		{
			id: crypto.randomUUID(),
			artistId,
			issueId: issue1Id,
			amountGross: 2500,
			feeStripe: 103,
			feePlatform: 125,
			amountNet: 2375,
			fanCoveredFees: true,
			stripePaymentId: 'pi_demo_seed_2',
			createdAt: new Date('2026-10-12T22:45:00Z')
		},
		{
			id: crypto.randomUUID(),
			artistId,
			issueId: issue1Id,
			amountGross: 500,
			feeStripe: 45,
			feePlatform: 25,
			amountNet: 430,
			fanCoveredFees: false,
			stripePaymentId: 'pi_demo_seed_3',
			createdAt: new Date('2026-10-12T23:05:00Z')
		},
		{
			id: crypto.randomUUID(),
			artistId,
			issueId: issue2Id,
			amountGross: 1500,
			feeStripe: 74,
			feePlatform: 75,
			amountNet: 1351,
			fanCoveredFees: false,
			stripePaymentId: 'pi_demo_seed_4',
			createdAt: new Date('2026-10-15T22:20:00Z')
		},
		{
			id: crypto.randomUUID(),
			artistId,
			issueId: issue2Id,
			amountGross: 1000,
			feeStripe: 59,
			feePlatform: 50,
			amountNet: 891,
			fanCoveredFees: false,
			stripePaymentId: 'pi_demo_seed_5',
			createdAt: new Date('2026-10-15T23:10:00Z')
		},
		{
			id: crypto.randomUUID(),
			artistId,
			issueId: issue3Id,
			amountGross: 2000,
			feeStripe: 88,
			feePlatform: 100,
			amountNet: 1812,
			fanCoveredFees: false,
			stripePaymentId: 'pi_demo_seed_6',
			createdAt: new Date('2026-10-18T22:10:00Z')
		},
		{
			id: crypto.randomUUID(),
			artistId,
			issueId: issue3Id,
			amountGross: 1000,
			feeStripe: 59,
			feePlatform: 50,
			amountNet: 950,
			fanCoveredFees: true,
			stripePaymentId: 'pi_demo_seed_7',
			createdAt: new Date('2026-10-18T22:55:00Z')
		},
		{
			id: crypto.randomUUID(),
			artistId,
			issueId: null,
			amountGross: 1000,
			feeStripe: 59,
			feePlatform: 50,
			amountNet: 891,
			fanCoveredFees: false,
			stripePaymentId: 'pi_demo_seed_general',
			createdAt: new Date('2026-10-19T14:00:00Z')
		}
	]);

	// Wall Notes & Replies
	const note1Id = crypto.randomUUID();
	const note2Id = crypto.randomUUID();
	const note3Id = crypto.randomUUID();
	const note4Id = crypto.randomUUID();
	const noteGeneralId = crypto.randomUUID();

	await db.insert(schema.notes).values([
		{
			id: note1Id,
			artistId,
			issueId: issue1Id,
			fanUserId: fan1Id,
			body: 'Best show you guys have ever played in Brooklyn! That bass fuzz was vibrating my chest.',
			status: 'live',
			flagCount: 0,
			flagImmune: false,
			createdAt: new Date('2026-10-12T23:20:00Z')
		},
		{
			id: note2Id,
			artistId,
			issueId: issue1Id,
			fanUserId: fan2Id,
			body: 'Came all the way from Jersey City for this kickoff. Worth every minute in traffic!',
			status: 'live',
			flagCount: 0,
			flagImmune: false,
			createdAt: new Date('2026-10-12T23:35:00Z')
		},
		{
			id: note3Id,
			artistId,
			issueId: issue2Id,
			fanUserId: fan2Id,
			body: 'Johnny Brenda’s upstairs room was electric tonight. Please press Fishtown Rain on 7-inch!',
			status: 'live',
			flagCount: 0,
			flagImmune: false,
			createdAt: new Date('2026-10-15T23:30:00Z')
		},
		{
			id: note4Id,
			artistId,
			issueId: issue3Id,
			fanUserId: fan1Id,
			body: 'Front row at Black Cat! The analog synth transition into Subway Static gave me chills.',
			status: 'live',
			flagCount: 0,
			flagImmune: false,
			createdAt: new Date('2026-10-18T23:15:00Z')
		},
		{
			id: noteGeneralId,
			artistId,
			issueId: null,
			fanUserId: fan3Id,
			body: 'Spinning the Bandcamp cassette nonstop in Boston—come north on the winter leg!',
			status: 'live',
			flagCount: 0,
			flagImmune: false,
			createdAt: new Date('2026-10-19T12:00:00Z')
		}
	]);

	await db.insert(schema.noteReplies).values({
		id: crypto.randomUUID(),
		noteId: note1Id,
		artistId,
		body: 'Thank you Maya! We dialled in the fuzz pedalboard just for this room. See you at the merch table!',
		createdAt: new Date('2026-10-12T23:40:00Z')
	});

	// Stamped & Saved Collections across all 3 issues
	await db.insert(schema.collections).values([
		{
			id: crypto.randomUUID(),
			fanUserId: fan1Id,
			issueId: issue1Id,
			kind: 'stamped',
			createdAt: new Date('2026-10-12T21:45:00Z')
		},
		{
			id: crypto.randomUUID(),
			fanUserId: fan2Id,
			issueId: issue1Id,
			kind: 'stamped',
			createdAt: new Date('2026-10-12T22:00:00Z')
		},
		{
			id: crypto.randomUUID(),
			fanUserId: fan3Id,
			issueId: issue1Id,
			kind: 'saved',
			createdAt: new Date('2026-10-13T10:00:00Z')
		},
		{
			id: crypto.randomUUID(),
			fanUserId: fan2Id,
			issueId: issue2Id,
			kind: 'stamped',
			createdAt: new Date('2026-10-15T21:50:00Z')
		},
		{
			id: crypto.randomUUID(),
			fanUserId: fan1Id,
			issueId: issue3Id,
			kind: 'stamped',
			createdAt: new Date('2026-10-18T21:30:00Z')
		},
		{
			id: crypto.randomUUID(),
			fanUserId: fan2Id,
			issueId: issue3Id,
			kind: 'stamped',
			createdAt: new Date('2026-10-18T21:45:00Z')
		},
		{
			id: crypto.randomUUID(),
			fanUserId: fan3Id,
			issueId: issue3Id,
			kind: 'saved',
			createdAt: new Date('2026-10-18T23:50:00Z')
		}
	]);

	console.log('Seeding complete: "The Neon Velvet" 3-city tour ready!');
	return { artistId, artistUserId };
}

async function ensureArtistPasswordCredential(userId: string) {
	const existingAccount = await db.query.accounts.findFirst({
		where: and(
			eq(schema.accounts.userId, userId),
			eq(schema.accounts.providerId, 'credential')
		)
	});
	if (!existingAccount) {
		const now = new Date();
		const hashedPassword = await hashPassword('neonvelvet123');
		await db.insert(schema.accounts).values({
			id: crypto.randomUUID(),
			accountId: userId,
			providerId: 'credential',
			userId,
			password: hashedPassword,
			createdAt: now,
			updatedAt: now
		});
	}
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('seed.ts')) {
	seedDatabase()
		.then(() => process.exit(0))
		.catch((e) => {
			console.error(e);
			process.exit(1);
		});
}
