import { z } from 'zod';

export const initiateTipSchema = z.object({
	artistId: z.string().min(1, 'Artist ID is required'),
	issueId: z.string().nullable().optional(),
	amountGrossCents: z
		.number()
		.int('Amount must be an integer in cents')
		.min(200, 'Minimum tip is $2.00')
		.max(50000, 'Maximum tip is $500.00'),
	fanCoveredFees: z.boolean().default(false)
});

export type InitiateTipInput = z.infer<typeof initiateTipSchema>;

export const mockTipPaymentSchema = z.object({
	artistId: z.string().min(1),
	issueId: z.string().nullable().optional(),
	amountGrossCents: z.number().int().min(200).max(50000),
	fanCoveredFees: z.boolean().default(false)
});

export type MockTipPaymentInput = z.infer<typeof mockTipPaymentSchema>;
