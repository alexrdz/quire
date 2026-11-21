/**
 * Direct access to `local.db`, the test database that `pnpm preview`
 * (NODE_ENV=test) serves from. The helpers reset rate-limit counters (every e2e
 * request comes from the same address), add the Issues, pages, Fans and Wall
 * notes specs need, and read back what the server stored.
 */
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { hashPassword } from 'better-auth/crypto';

/**
 * The file database of a local Demo- or production-mode e2e server
 * (playwright.config.ts deletes and migrates it on every start).
 */
export function previewDatabasePath(name: 'demo' | 'production'): string {
	return path.join(os.tmpdir(), 'quire-e2e', `${name}.db`);
}

/**
 * The only way the helpers open the database: a client that waits for the
 * server's writes instead of failing with SQLITE_BUSY, since the server and
 * parallel specs share this file.
 */
async function waitingClient(databaseUrl = 'file:local.db') {
	const db = createClient({ url: databaseUrl });
	try {
		await db.execute('PRAGMA busy_timeout = 5000');
	} catch (error) {
		db.close();
		throw error;
	}
	return db;
}

/** Clears app rate-limit counters so earlier runs on this machine cannot trip a limit. */
export async function resetRateLimits(): Promise<void> {
	const db = await waitingClient();
	try {
		await db.execute('DELETE FROM rate_limits');
	} catch (error) {
		// Only a database the migrations haven't built yet is fine: there are no
		// counters to clear. This happens only when PLAYWRIGHT_BASE_URL points at a
		// server that doesn't use local.db; Playwright's own web server always runs
		// `pnpm db:migrate` first. Anything else, SQLITE_BUSY included, leaves
		// limits in place, so it must fail the spec.
		if (!/no such table: rate_limits/.test(String(error))) throw error;
	} finally {
		db.close();
	}
}

/** The R2 origin the e2e preview server is given (playwright.config.ts webServer.env). */
export const E2E_MEDIA_ORIGIN = 'https://media.e2e.quire.test';

export const EMBED_ISSUE_SLUG = 'e2e-csp-embeds';

/**
 * A published Issue for the sample Artist with one page per third-party source
 * the CSP must allow: an R2 photo and R2 audio, plus YouTube, Vimeo and Bandcamp
 * embeds. Recreated on each call so earlier runs can't leave it stale.
 */
export async function seedEmbedIssue(): Promise<string> {
	const db = await waitingClient();
	try {
		const artist = await db.execute({
			sql: 'SELECT id FROM artists WHERE slug = ?',
			args: ['the-neon-velvet']
		});
		const artistId = artist.rows[0]?.id;
		if (!artistId) throw new Error('Sample artist missing: the server seeds it on first request.');

		const existing = await db.execute({ sql: 'SELECT id FROM issues WHERE slug = ?', args: [EMBED_ISSUE_SLUG] });
		for (const row of existing.rows) {
			await db.execute({ sql: 'DELETE FROM issue_pages WHERE issue_id = ?', args: [row.id] });
			await db.execute({ sql: 'DELETE FROM issues WHERE id = ?', args: [row.id] });
		}

		const issueId = `e2e-csp-${Date.now()}`;
		const now = Math.floor(Date.now() / 1000);
		await db.execute({
			sql: `INSERT INTO issues (id, artist_id, slug, city, venue, date, timezone, cover_note, secret_key, status, approve_first, published_at, created_at, updated_at)
			      VALUES (?, ?, ?, 'Testville', 'The CSP Room', '2026-11-20', 'America/New_York', '', 'e2e_csp_secret', 'published', 0, ?, ?, ?)`,
			args: [issueId, artistId, EMBED_ISSUE_SLUG, now, now, now]
		});

		const pages: Array<[string, Record<string, unknown>]> = [
			['photo', { title: 'R2 Photo', imageUrl: `${E2E_MEDIA_ORIGIN}/photos/stage.webp` }],
			['audio', { title: 'R2 Audio', audioUrl: `${E2E_MEDIA_ORIGIN}/audio/demo.mp3` }],
			['video', { title: 'YouTube Clip', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }],
			['video', { title: 'Vimeo Clip', videoUrl: 'https://vimeo.com/76979871' }],
			[
				'video',
				{
					title: 'Bandcamp Player',
					videoUrl: 'https://bandcamp.com/EmbeddedPlayer/album=1234567890/size=large/tracklist=false'
				}
			]
		];
		for (const [index, [kind, content]] of pages.entries()) {
			await db.execute({
				sql: 'INSERT INTO issue_pages (id, issue_id, position, kind, content_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
				args: [`${issueId}-p${index}`, issueId, index, kind, JSON.stringify(content), now]
			});
		}
		return EMBED_ISSUE_SLUG;
	} finally {
		db.close();
	}
}

/** The stored image URL of the newest photo page on an Issue in `city`, or null. */
export async function latestPhotoUrlForCity(city: string, databaseUrl?: string): Promise<string | null> {
	const db = await waitingClient(databaseUrl);
	try {
		const result = await db.execute({
			sql: `SELECT p.content_json FROM issue_pages p JOIN issues i ON i.id = p.issue_id
			      WHERE i.city = ? AND p.kind = 'photo' ORDER BY p.created_at DESC LIMIT 1`,
			args: [city]
		});
		const json = result.rows[0]?.content_json;
		return typeof json === 'string' ? (JSON.parse(json).imageUrl ?? null) : null;
	} finally {
		db.close();
	}
}

/** How many Issues exist in `city` (a refused upload must not create one). */
export async function issueCountForCity(city: string): Promise<number> {
	const db = await waitingClient();
	try {
		const result = await db.execute({ sql: 'SELECT count(*) AS n FROM issues WHERE city = ?', args: [city] });
		return Number(result.rows[0]?.n ?? 0);
	} finally {
		db.close();
	}
}


/** The newest Issue in `city`, as `{ id, slug }`, or null (Quick Issue answers with neither in plain JSON). */
export async function issueForCity(city: string): Promise<{ id: string; slug: string } | null> {
	const db = await waitingClient();
	try {
		const result = await db.execute({
			sql: 'SELECT id, slug FROM issues WHERE city = ? ORDER BY created_at DESC LIMIT 1',
			args: [city]
		});
		const row = result.rows[0];
		return row ? { id: String(row.id), slug: String(row.slug) } : null;
	} finally {
		db.close();
	}
}

/**
 * Z-T07: adds a photo page in the format Quick Issue used before captions moved
 * to the back of the polaroid (`imageUrl` plus the caption as `body`), so the
 * reader can be checked against pages already published that way.
 */
export async function addLegacyQuickPhotoPage(issueId: string, page: { title: string; imageUrl: string; body: string }): Promise<void> {
	const db = await waitingClient();
	try {
		const next = await db.execute({
			sql: 'SELECT coalesce(max(position), 0) + 1 AS position FROM issue_pages WHERE issue_id = ?',
			args: [issueId]
		});
		await db.execute({
			sql: 'INSERT INTO issue_pages (id, issue_id, position, kind, content_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
			args: [
				`${issueId}-legacy-photo`,
				issueId,
				Number(next.rows[0]!.position),
				'photo',
				JSON.stringify(page),
				Math.floor(Date.now() / 1000)
			]
		});
	} finally {
		db.close();
	}
}

/**
 * A published Issue for the sample Artist with one page of every content kind
 * the zine reader styles (Z-T05), under its own slug so parallel specs never
 * share it: a setlist, a photo, a text scrap, a mock and a real audio track,
 * and YouTube, Vimeo, Bandcamp and link-out video pages.
 */
export async function seedZineContentIssue(slug: string): Promise<string> {
	const db = await waitingClient();
	try {
		const artist = await db.execute({ sql: 'SELECT id FROM artists WHERE slug = ?', args: ['the-neon-velvet'] });
		const artistId = artist.rows[0]?.id;
		if (!artistId) throw new Error('Sample artist missing: the server seeds it on first request.');

		const issueId = `e2e-zine-${slug}`;
		const now = Math.floor(Date.now() / 1000);
		await db.execute({
			sql: `INSERT INTO issues (id, artist_id, slug, city, venue, date, timezone, cover_note, secret_key, status, approve_first, published_at, created_at, updated_at)
			      VALUES (?, ?, ?, 'Zineville', 'The Paste-Up', '2026-11-20', 'America/New_York', '', 'e2e_zine_secret', 'published', 0, ?, ?, ?)`,
			args: [issueId, artistId, slug, now, now, now]
		});
		const pages: Array<[string, Record<string, unknown>]> = [
			['setlist', { title: 'Zine Setlist', songs: ['Opener', 'Second Song', 'Encore Song'] }],
			['photo', { title: 'Zine Photo', body: 'Caption body', imageUrl: `${E2E_MEDIA_ORIGIN}/photos/zine.webp` }],
			['text', { title: 'Zine Text', body: 'Words on a scrap.' }],
			['audio', { title: 'Zine Demo' }],
			['audio', { title: 'Zine Track', audioUrl: `${E2E_MEDIA_ORIGIN}/audio/zine.mp3`, duration: '02:10' }],
			['video', { title: 'Zine YouTube', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }],
			['video', { title: 'Zine Vimeo', videoUrl: 'https://vimeo.com/76979871' }],
			['video', { title: 'Zine Bandcamp', videoUrl: 'https://bandcamp.com/EmbeddedPlayer/album=1234567890/size=large/tracklist=false' }],
			['video', { title: 'Zine Link', videoUrl: 'https://example.com/watch' }]
		];
		for (const [index, [kind, content]] of pages.entries()) {
			await db.execute({
				sql: 'INSERT INTO issue_pages (id, issue_id, position, kind, content_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
				args: [`${issueId}-p${index}`, issueId, index, kind, JSON.stringify(content), now]
			});
		}
		return slug;
	} finally {
		db.close();
	}
}

export interface E2eFan {
	id: string;
	name: string;
	email: string;
	password: string;
}

/**
 * B1-T16: a new Fan with a password login and no stamps, saves or notes, so a
 * test, and each --repeat-each copy of it, owns its Fan state instead of sharing
 * Maya's with every other copy running in parallel.
 */
export async function createFan(label: string): Promise<E2eFan> {
	const id = crypto.randomUUID();
	const tag = id.slice(0, 8);
	const fan = { id, name: `${label} ${tag}`, email: `e2e-fan-${tag}@example.com`, password: `e2e-fan-password-${tag}` };
	const hash = await hashPassword(fan.password);
	const now = Math.floor(Date.now() / 1000);
	const db = await waitingClient();
	try {
		await db.batch(
			[
				{
					sql: `INSERT INTO users (id, name, email, email_verified, account_type, created_at, updated_at)
					      VALUES (?, ?, ?, 1, 'fan', ?, ?)`,
					args: [fan.id, fan.name, fan.email, now, now]
				},
				{
					sql: `INSERT INTO accounts (id, user_id, account_id, provider_id, password, created_at, updated_at)
					      VALUES (?, ?, ?, 'credential', ?, ?, ?)`,
					args: [crypto.randomUUID(), fan.id, fan.id, hash, now, now]
				}
			],
			'write'
		);
	} finally {
		db.close();
	}
	return fan;
}

/**
 * B1-T16: a live note on an Issue's Wall from a new Fan who is stamped at that
 * show, with the Artist's reply. The Wall test checks the note it made, so it
 * never depends on the seeded note and reply still being live in a `local.db`
 * that earlier runs and local development share.
 */
export async function addRepliedWallNote(
	issueSlug: string,
	note: { body: string; reply: string }
): Promise<{ fanName: string }> {
	const fan = await createFan('Wall Fan');
	const noteId = crypto.randomUUID();
	const now = Math.floor(Date.now() / 1000);
	const db = await waitingClient();
	try {
		const issue = await db.execute({ sql: 'SELECT id, artist_id FROM issues WHERE slug = ?', args: [issueSlug] });
		const row = issue.rows[0];
		if (!row) throw new Error(`Issue ${issueSlug} missing: the server seeds it on first request.`);
		await db.batch(
			[
				{
					sql: `INSERT INTO collections (id, fan_user_id, issue_id, kind, created_at) VALUES (?, ?, ?, 'stamped', ?)`,
					args: [crypto.randomUUID(), fan.id, row.id, now]
				},
				{
					sql: `INSERT INTO notes (id, artist_id, issue_id, fan_user_id, body, status, flag_count, flag_immune, created_at)
					      VALUES (?, ?, ?, ?, ?, 'live', 0, 0, ?)`,
					args: [noteId, row.artist_id, row.id, fan.id, note.body, now]
				},
				{
					sql: 'INSERT INTO note_replies (id, note_id, artist_id, body, created_at) VALUES (?, ?, ?, ?, ?)',
					args: [crypto.randomUUID(), noteId, row.artist_id, note.reply, now]
				}
			],
			'write'
		);
	} finally {
		db.close();
	}
	return { fanName: fan.name };
}
