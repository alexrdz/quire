import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { hashPassword } from 'better-auth/crypto';

/**
 * Direct access to the production-mode e2e server's database (P5V-T01).
 *
 * playwright.config.ts starts that server on `<tmp>/quire-e2e/production.db`,
 * deleted and rebuilt by the migrations on every start and never seeded. The
 * path below must match `previewServer('production', ...)` there. Production
 * has no sample data and no sign-up while email is off, so these helpers create
 * the Artists the Phase 5 checks need straight in the database.
 */
export const PRODUCTION_DB_PATH = path.join(os.tmpdir(), 'quire-e2e', 'production.db');

/** Port of the production-mode server with core config missing (playwright.config.ts). */
export const CORE_MISSING_URL = 'http://localhost:4176';

/** The only way these helpers open the database. */
async function withDb<T>(fn: (db: Client) => Promise<T>): Promise<T> {
	const db = createClient({ url: `file:${PRODUCTION_DB_PATH}` });
	try {
		// The server shares this file: wait for its writes instead of failing with SQLITE_BUSY.
		await db.execute('PRAGMA busy_timeout = 5000');
		return await fn(db);
	} finally {
		db.close();
	}
}

/** Clears rate-limit counters (every e2e request comes from one address). */
export async function resetProductionRateLimits(): Promise<void> {
	await withDb(async (db) => {
		await db.execute('DELETE FROM rate_limits');
		await db.execute('DELETE FROM auth_rate_limits');
	});
}

export interface ProductionArtist {
	userId: string;
	artistId: string;
	slug: string;
	displayName: string;
	email: string;
	password: string;
	issueId: string;
	issueSlug: string;
}

/**
 * An Artist who can sign in with email and password, with a confirmed email
 * (so upload checks reach the uploads switch, not the confirmation gate), an
 * optional Venmo username and one published Issue. Unique per call.
 */
export async function createProductionArtist(options: {
	displayName: string;
	venmoUsername: string | null;
	tipPresets?: number[];
}): Promise<ProductionArtist> {
	const tag = crypto.randomBytes(4).toString('hex');
	const userId = crypto.randomUUID();
	const artistId = crypto.randomUUID();
	const issueId = crypto.randomUUID();
	const slug = `p5-${tag}`;
	const issueSlug = `p5-${tag}-philly-2026-11-20`;
	const email = `p5-${tag}@example.com`;
	const password = `p5-password-${tag}`;
	const now = Math.floor(Date.now() / 1000);
	const hash = await hashPassword(password);

	await withDb(async (db) => {
		await db.batch(
			[
				{
					sql: `INSERT INTO users (id, name, email, email_verified, account_type, created_at, updated_at)
					      VALUES (?, ?, ?, 1, 'artist', ?, ?)`,
					args: [userId, options.displayName, email, now, now]
				},
				{
					sql: `INSERT INTO accounts (id, user_id, account_id, provider_id, password, created_at, updated_at)
					      VALUES (?, ?, ?, 'credential', ?, ?, ?)`,
					args: [crypto.randomUUID(), userId, userId, hash, now, now]
				},
				{
					sql: `INSERT INTO artists (id, user_id, slug, display_name, venmo_username, tip_presets_json, created_at, updated_at)
					      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
					args: [
						artistId,
						userId,
						slug,
						options.displayName,
						options.venmoUsername,
						JSON.stringify(options.tipPresets ?? [3, 5, 10]),
						now,
						now
					]
				},
				{
					sql: `INSERT INTO issues (id, artist_id, slug, city, venue, date, timezone, cover_note, secret_key, status, approve_first, published_at, created_at, updated_at)
					      VALUES (?, ?, ?, 'Philadelphia', 'The Secret Room', '2026-11-20', 'America/New_York', '', ?, 'published', 0, ?, ?, ?)`,
					args: [issueId, artistId, issueSlug, `p5_secret_${tag}`, now, now, now]
				}
			],
			'write'
		);
	});

	return { userId, artistId, slug, displayName: options.displayName, email, password, issueId, issueSlug };
}

export interface TipTapRow {
	issueId: string | null;
	amountSelectedCents: number;
}

/** The Tip Taps recorded for an Artist, oldest first. */
export async function tipTapsFor(artistId: string): Promise<TipTapRow[]> {
	return withDb(async (db) => {
		const result = await db.execute({
			sql: 'SELECT issue_id, amount_selected_cents FROM tip_taps WHERE artist_id = ? ORDER BY created_at, rowid',
			args: [artistId]
		});
		return result.rows.map((row) => ({
			issueId: (row.issue_id as string | null) ?? null,
			amountSelectedCents: Number(row.amount_selected_cents)
		}));
	});
}

/** How many Issues an Artist has (an upload that is refused must not create one). */
export async function issueCountFor(artistId: string): Promise<number> {
	return withDb(async (db) => {
		const result = await db.execute({ sql: 'SELECT count(*) AS n FROM issues WHERE artist_id = ?', args: [artistId] });
		return Number(result.rows[0]?.n ?? 0);
	});
}

/** The stored content of every page on an Issue, by id (to check a refused upload changed nothing). */
export async function issuePagesFor(issueId: string): Promise<Array<{ id: string; kind: string; contentJson: string }>> {
	return withDb(async (db) => {
		const result = await db.execute({
			sql: 'SELECT id, kind, content_json FROM issue_pages WHERE issue_id = ? ORDER BY position',
			args: [issueId]
		});
		return result.rows.map((row) => ({
			id: String(row.id),
			kind: String(row.kind),
			contentJson: String(row.content_json)
		}));
	});
}

/** Adds a page to an Issue, so the Bookbinder renders that page kind's editor. */
export async function addIssuePage(issueId: string, kind: string, content: Record<string, unknown>): Promise<string> {
	const id = crypto.randomUUID();
	await withDb(async (db) => {
		const position = await db.execute({
			sql: 'SELECT coalesce(max(position), -1) + 1 AS p FROM issue_pages WHERE issue_id = ?',
			args: [issueId]
		});
		await db.execute({
			sql: 'INSERT INTO issue_pages (id, issue_id, position, kind, content_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
			args: [id, issueId, Number(position.rows[0]?.p ?? 0), kind, JSON.stringify(content), Math.floor(Date.now() / 1000)]
		});
	});
	return id;
}

/** True when a user with this email exists (a refused sign-up must not create one). */
export async function userExists(email: string): Promise<boolean> {
	return withDb(async (db) => {
		const result = await db.execute({ sql: 'SELECT 1 FROM users WHERE email = ?', args: [email.toLowerCase()] });
		return result.rows.length > 0;
	});
}

/** How many sessions exist (a refused sign-in must not create one). */
export async function sessionCount(): Promise<number> {
	return withDb(async (db) => {
		const result = await db.execute('SELECT count(*) AS n FROM sessions');
		return Number(result.rows[0]?.n ?? 0);
	});
}

/** An Artist's cover art URL and template page count (a refused upload must change neither). */
export async function templateStateFor(artistId: string): Promise<{ coverArtUrl: string | null; templatePages: number }> {
	return withDb(async (db) => {
		const artist = await db.execute({ sql: 'SELECT cover_art_url FROM artists WHERE id = ?', args: [artistId] });
		const pages = await db.execute({ sql: 'SELECT count(*) AS n FROM template_pages WHERE artist_id = ?', args: [artistId] });
		return {
			coverArtUrl: (artist.rows[0]?.cover_art_url as string | null) ?? null,
			templatePages: Number(pages.rows[0]?.n ?? 0)
		};
	});
}
