import { z } from 'zod';

export const stripeAccountIdSchema = z
	.string()
	.trim()
	.regex(/^acct_[a-zA-Z0-9_]+$/, 'Invalid Stripe Connect account ID format');

export const payoutChangeActionSchema = z.enum(['connect', 'replace', 'disconnect']);
export type PayoutChangeAction = z.infer<typeof payoutChangeActionSchema>;

/**
 * SPEC Section 6.4:
 * Changing the payout account requires entering the password again
 * and confirming by email, because the login is shared among bandmates.
 */
export const payoutAccountChangeRequestSchema = z.object({
	confirmPassword: z
		.string()
		.min(1, 'Please re-enter your shared band password to modify payout settings')
		.max(256),
	action: payoutChangeActionSchema.default('connect'),
	stripeAccountId: stripeAccountIdSchema.optional(),
	returnUrl: z.string().url().optional(),
	refreshUrl: z.string().url().optional()
});

export type PayoutAccountChangeRequestInput = z.infer<typeof payoutAccountChangeRequestSchema>;

export const payoutChangeConfirmationSchema = z.object({
	token: z
		.string()
		.trim()
		.min(16, 'Invalid payout confirmation token')
		.max(256, 'Invalid payout confirmation token')
});

export type PayoutChangeConfirmationInput = z.infer<typeof payoutChangeConfirmationSchema>;

export const stripeConnectOnboardingSchema = z.object({
	confirmPassword: z
		.string()
		.min(1, 'Please re-enter your password to start Stripe Express onboarding')
		.max(256),
	country: z.string().trim().length(2, 'ISO 2-letter country code required').default('US')
});

export type StripeConnectOnboardingInput = z.infer<typeof stripeConnectOnboardingSchema>;

export const artistSettingsUpdateSchema = z.object({
	generalWallApproveFirst: z.boolean().default(false),
	payoutsEnabled: z.boolean().optional(),
	stripeAccountId: stripeAccountIdSchema.optional().or(z.literal('')),
	confirmPassword: z.string().max(256).optional()
});

export type ArtistSettingsUpdateInput = z.infer<typeof artistSettingsUpdateSchema>;
