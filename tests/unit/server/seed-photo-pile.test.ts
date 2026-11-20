import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { and, asc, eq } from 'drizzle-orm';
import { resolvePhotoEntries } from '$domain/photo-pile';
import { photoEntriesSchema } from '$lib/schemas/issue';

/**
 * B1-T03: the sample Issues show the multi-photo format, so dev, e2e and the
 * Demo (which reseeds nightly from seed.ts) show a captioned polaroid pile.
 * Runs on its own fresh database, never local.db, which other test files share
 * and which is only seeded once.
 */

const state = vi.hoisted(() => {
	const nodeFs = require('node:fs') as typeof import('node:fs');
	const nodeOs = require('node:os') as typeof import('node:os');
	const nodePath = require('node:path') as typeof import('node:path');
	const dir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), 'quire-seed-pile-'));
	return { dir, url: `file:${nodePath.join(dir, 'seed.db')}` };
});

vi.mock('$lib/server/db', async () => {
	const { createClient } = await import('@libsql/client');
	const { drizzle } = await import('drizzle-orm/libsql');
	const dbSchema = await import('$lib/server/db/schema');
	const client = createClient({ url: state.url });
	return { client, db: drizzle(client, { schema: dbSchema }), schema: dbSchema };
});

const BROOKLYN = 'neon-velvet-brooklyn-2026-10-12';
const PHILLY = 'neon-velvet-philly-2026-10-15';
const DC = 'neon-velvet-dc-2026-10-18';

async function pagesOf(slug: string) {
	const { db, schema } = await import('$lib/server/db');
	const issue = await db.query.issues.findFirst({ where: eq(schema.issues.slug, slug) });
	expect(issue, slug).toBeDefined();
	return db.query.issuePages.findMany({
		where: eq(schema.issuePages.issueId, issue!.id),
		orderBy: [asc(schema.issuePages.position)]
	});
}

async function photoPageOf(slug: string) {
	const { db, schema } = await import('$lib/server/db');
	const issue = await db.query.issues.findFirst({ where: eq(schema.issues.slug, slug) });
	const page = await db.query.issuePages.findFirst({
		where: and(eq(schema.issuePages.issueId, issue!.id), eq(schema.issuePages.kind, 'photo'))
	});
	expect(page, `${slug} photo page`).toBeDefined();
	return JSON.parse(page!.contentJson) as Record<string, unknown>;
}

beforeAll(async () => {
	const { client } = await import('$lib/server/db');
	const { runMigrations } = await import('$lib/server/db/migrate');
	await runMigrations(client);
	const { seedDatabase } = await import('$lib/server/seed');
	await seedDatabase();
});

afterAll(async () => {
	const { client } = await import('$lib/server/db');
	client.close();
	fs.rmSync(state.dir, { recursive: true, force: true });
});

describe('sample photo piles on a freshly seeded database', () => {
	it('Brooklyn Tour Diary is a pile of 4 or 5, most captioned, at least one bare', async () => {
		const content = await photoPageOf(BROOKLYN);
		expect(content.title).toBe('Tour Diary: Brooklyn Kickoff');
		expect(content.body).toBe('Sold out the back room at Baby’s. You animals broke the barricade on song three.');

		const photos = resolvePhotoEntries(content);
		expect(photos.length).toBeGreaterThanOrEqual(4);
		expect(photos.length).toBeLessThanOrEqual(5);
		const captioned = photos.filter((photo) => photo.caption);
		expect(captioned.length).toBeGreaterThan(photos.length / 2);
		expect(photos.some((photo) => !photo.caption)).toBe(true);
		// The first photo is still the one this page always had.
		expect(photos[0].url).toContain('photo-1598387181032-a3103a2db5b3');
	});

	it('the second sample Issue (Philadelphia) has a 3-photo pile, every photo captioned', async () => {
		const content = await photoPageOf(PHILLY);
		const photos = resolvePhotoEntries(content);
		expect(photos).toHaveLength(3);
		for (const photo of photos) expect(photo.caption, photo.url).toBeTruthy();
	});

	it.each([BROOKLYN, PHILLY])('%s is stored as the Bookbinder saves it, valid and on the CSP-allowed host', async (slug) => {
		const content = await photoPageOf(slug);
		const parsed = photoEntriesSchema.safeParse(content.photos);
		expect(parsed.success).toBe(true);
		const photos = content.photos as Array<{ url: string }>;
		expect(content.imageUrl).toBe(photos[0].url);
		for (const { url } of photos) {
			expect(new URL(url).origin).toBe('https://images.unsplash.com');
		}
		expect(new Set(photos.map((photo) => photo.url)).size).toBe(photos.length);
	});

	it('page kinds and positions are unchanged, with the Philly pile added after its setlist', async () => {
		const shape = async (slug: string) =>
			(await pagesOf(slug)).map((page) => `${page.position}:${page.kind}`);
		expect(await shape(BROOKLYN)).toEqual(['1:setlist', '2:photo']);
		expect(await shape(PHILLY)).toEqual(['1:setlist', '2:photo']);
		expect(await shape(DC)).toEqual(['1:setlist', '2:text']);
	});
});
