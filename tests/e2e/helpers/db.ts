import os from 'node:os';
import path from 'node:path';
import { createClient } from '@libsql/client';

/**
 * Direct access to the local test database that `pnpm preview` (NODE_ENV=test)
 * serves from. Used to reset rate-limit counters (every e2e request comes from
 * the same address) and to add the Issue the CSP spec renders.
 */
function client(url = 'file:local.db') {
	return createClient({ url });
}

/**
 * The file database of a local Demo- or production-mode e2e server
 * (playwright.config.ts deletes and migrates it on every start).
 */
export function previewDatabasePath(name: 'demo' | 'production'): string {
	return path.join(os.tmpdir(), 'quire-e2e', `${name}.db`);
}

/**
 * A client that waits for the server's writes instead of failing with
 * SQLITE_BUSY: the server and parallel specs share this file.
 */
async function waitingClient(databaseUrl?: string) {
	const db = client(databaseUrl);
	await db.execute('PRAGMA busy_timeout = 5000');
	return db;
}

/** Clears app rate-limit counters so earlier runs on this machine cannot trip a limit. */
export async function resetRateLimits(): Promise<void> {
	const db = client();
	try {
		await db.execute('DELETE FROM rate_limits');
	} catch {
		// No database yet: the web server runs `pnpm db:migrate` before it starts.
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
	const db = client();
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
	const db = client();
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
