/**
 * The schema as `seed.ts` used to create it at runtime with `ensureSchemaTables`,
 * before drizzle migrations became the only schema path (PRODUCTION_PLAN 3.5).
 * Copied verbatim from seed.ts at the commit that removed it. The Demo DB, the
 * production DB and old dev DBs were built this way, and the baseline tests
 * rebuild it to prove `db:baseline` accepts them. Test fixture only: never run
 * against a real database.
 */
import type { Client } from '@libsql/client';

export async function createLegacySchema(client: Client): Promise<void> {

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

	await ensureColumnExists(client, 'artists', 'account_status', "text DEFAULT 'active' NOT NULL");
	await ensureColumnExists(client, 'artists', 'closed_at', 'integer');
	await ensureColumnExists(client, 'issues', 'archived_at', 'integer');
	await ensureColumnExists(client, 'tips', 'status', "text DEFAULT 'succeeded' NOT NULL");
	await ensureColumnExists(client, 'tips', 'refunded_at', 'integer');
	await ensureColumnExists(client, 'artists', 'venmo_username', 'text');

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

async function ensureColumnExists(
	client: Client,
	tableName: string,
	columnName: string,
	columnDef: string
) {
	try {
		const info = await client.execute(`PRAGMA table_info(${tableName})`);
		const exists = info.rows.some((row) => String(row.name) === columnName);
		if (!exists) {
			await client.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
		}
	} catch {}
}
