import { describe, it, expect } from 'vitest';
import { createTipCheckout } from '$lib/server/services/payments';
import { db, schema } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { seedDatabase } from '$lib/server/seed';

describe('Payment & Tip Service', () => {
	it('creates a simulated tip payment in offline/demo mode and records to database', async () => {
		await seedDatabase();

		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.slug, 'the-neon-velvet')
		});
		expect(artist).toBeDefined();
		if (!artist) return;

		const result = await createTipCheckout({
			artistId: artist.id,
			amountGrossCents: 1500, // $15.00
			fanCoveredFees: true,
			returnUrl: 'http://localhost:5173/a/the-neon-velvet'
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.value.breakdown.grossCents).toBe(1500);
		expect(result.value.breakdown.feePlatformCents).toBe(75); // 5% of 1500

		if (result.value.mode === 'mock') {
			// Verify tip record exists in DB
			const record = await db.query.tips.findFirst({
				where: eq(schema.tips.id, result.value.tipId)
			});
			expect(record).toBeDefined();
			expect(record?.amountGross).toBe(1500);
			expect(record?.amountNet).toBe(1425); // 1500 - 75
		}
	});
});
