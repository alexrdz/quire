import { createClient } from '@libsql/client';

/**
 * Direct access to the local test database that `pnpm preview` (NODE_ENV=test)
 * serves from. Used to reset rate-limit counters (every e2e request comes from
 * the same address) and to add the Issue the CSP spec renders.
 */
function client() {
	return createClient({ url: 'file:local.db' });
}

/** Clears app rate-limit counters so earlier runs on this machine cannot trip a limit. */
export async function resetRateLimits(): Promise<void> {
	const db = client();
	try {
		await db.execute('DELETE FROM rate_limits');
	} catch {
		// Table not created yet: the server creates it on first request.
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
