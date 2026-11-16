import { describe, it, expect } from 'vitest';
import { quickIssueSchema, bookbinderIssueSchema } from '$schemas/issue';
import { submitNoteSchema, replyNoteSchema, flagNoteSchema } from '$schemas/wall';
import { initiateTipSchema, mockTipPaymentSchema } from '$schemas/tipping';
import { scanQuerySchema, claimStampSchema, saveIssueSchema } from '$schemas/scan';

describe('Zod Boundary Validation Schemas', () => {
	describe('Issue Schemas', () => {
		it('validates a correct Quick Issue form payload', () => {
			const valid = {
				city: 'Philadelphia',
				venue: "Johnny Brenda's",
				date: '2026-10-15',
				timezone: 'America/New_York',
				coverNote: 'Upstairs bar opens at 7.'
			};
			const parsed = quickIssueSchema.safeParse(valid);
			expect(parsed.success).toBe(true);
		});

		it('rejects invalid date formats', () => {
			const invalid = {
				city: 'Detroit',
				venue: 'El Club',
				date: '10/15/2026' // Not YYYY-MM-DD
			};
			const parsed = quickIssueSchema.safeParse(invalid);
			expect(parsed.success).toBe(false);
		});

		it('validates bookbinder multi-page issues', () => {
			const valid = {
				slug: 'neon-velvet-philly',
				city: 'Philadelphia',
				venue: "Johnny Brenda's",
				date: '2026-10-15',
				pages: [
					{
						position: 1,
						kind: 'setlist',
						content: { songs: ['Intro', 'Fuzz Glow', 'Encore'] }
					}
				]
			};
			const parsed = bookbinderIssueSchema.safeParse(valid);
			expect(parsed.success).toBe(true);
		});
	});

	describe('Wall Schemas', () => {
		it('rejects notes containing links, emails, and phone numbers at boundary', () => {
			expect(submitNoteSchema.safeParse({ body: 'Visit https://spam.com' }).success).toBe(false);
			expect(submitNoteSchema.safeParse({ body: 'Contact me at fan@music.org' }).success).toBe(false);
			expect(submitNoteSchema.safeParse({ body: 'Call 212-555-1212' }).success).toBe(false);
		});

		it('accepts clean note submissions', () => {
			const parsed = submitNoteSchema.safeParse({ body: 'Loved the acoustic encore!' });
			expect(parsed.success).toBe(true);
		});
	});

	describe('Tipping Schemas', () => {
		it('validates tips between $2 and $500', () => {
			expect(initiateTipSchema.safeParse({ artistId: 'a1', amountGrossCents: 200 }).success).toBe(true);
			expect(initiateTipSchema.safeParse({ artistId: 'a1', amountGrossCents: 50000 }).success).toBe(true);
			expect(initiateTipSchema.safeParse({ artistId: 'a1', amountGrossCents: 199 }).success).toBe(false);
			expect(initiateTipSchema.safeParse({ artistId: 'a1', amountGrossCents: 50001 }).success).toBe(false);
		});
	});

	describe('Scan Schemas', () => {
		it('validates scan query secret k parameter', () => {
			expect(scanQuerySchema.safeParse({ k: 'secret_hash_key' }).success).toBe(true);
			expect(scanQuerySchema.safeParse({}).success).toBe(false);
			expect(scanQuerySchema.safeParse({ k: '' }).success).toBe(false);
		});
	});
});
