import { beforeAll, describe, expect, it } from 'vitest';
import { eq, isNull, and } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { SAMPLE_VENMO_USERNAME, seedDatabase } from '$lib/server/seed';
import { parseVenmoUsername } from '$domain/venmo';

beforeAll(async () => {
	await seedDatabase();
});

describe('Venmo sample data (ADR 0008)', () => {
	it('gives the sample Artist a valid Venmo username', async () => {
		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.slug, 'the-neon-velvet')
		});
		expect(artist?.venmoUsername).toBe(SAMPLE_VENMO_USERNAME);
		expect(parseVenmoUsername(SAMPLE_VENMO_USERNAME).ok).toBe(true);
	});

	it('seeds tip taps across Issues and General', async () => {
		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.slug, 'the-neon-velvet')
		});
		const taps = await db.query.tipTaps.findMany({
			where: eq(schema.tipTaps.artistId, artist!.id)
		});
		expect(taps.length).toBeGreaterThanOrEqual(5);
		const issueIds = new Set(taps.map((tap) => tap.issueId).filter(Boolean));
		expect(issueIds.size).toBeGreaterThanOrEqual(2);
		const general = await db.query.tipTaps.findMany({
			where: and(eq(schema.tipTaps.artistId, artist!.id), isNull(schema.tipTaps.issueId))
		});
		expect(general.length).toBeGreaterThan(0);
		for (const tap of taps) expect(tap.amountSelectedCents).toBeGreaterThan(0);
	});
});
