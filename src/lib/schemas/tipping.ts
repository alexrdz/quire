import { z } from 'zod';
import { TIP_REVERSAL_STATUSES, TIP_STATUSES } from '$domain/tipping';

export const tipCurrencySchema = z.literal('usd');
export const tipStatusSchema = z.enum(TIP_STATUSES);
export const tipReversalStatusSchema = z.enum(TIP_REVERSAL_STATUSES);

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

export const stripeTipMetadataSchema = z.object({
	artistId: z.string().min(1),
	issueId: z.string().optional().default('general'),
	fanCoveredFees: z.enum(['true', 'false']).optional().default('false'),
	amountGrossCents: z.string().regex(/^\d+$/).optional(),
	feePlatformCents: z.string().regex(/^\d+$/).optional(),
	feeStripeCents: z.string().regex(/^\d+$/).optional(),
	amountNetCents: z.string().regex(/^\d+$/).optional()
});

export type StripeTipMetadata = z.infer<typeof stripeTipMetadataSchema>;

export const stripePaymentIntentObjectSchema = z.object({
	id: z.string().min(1),
	object: z.literal('payment_intent').optional(),
	amount: z.number().int().nonnegative(),
	amount_received: z.number().int().nonnegative().optional(),
	currency: z.string().toLowerCase(),
	status: z.string().optional(),
	application_fee_amount: z.number().int().nonnegative().nullable().optional(),
	transfer_data: z
		.object({
			destination: z.string().min(1)
		})
		.nullable()
		.optional(),
	metadata: z.record(z.string(), z.string()).default({})
});

export const stripeCheckoutSessionObjectSchema = z.object({
	id: z.string().min(1),
	object: z.literal('checkout.session').optional(),
	payment_intent: z.union([z.string().min(1), z.object({ id: z.string().min(1) })]).nullable().optional(),
	amount_total: z.number().int().nonnegative().nullable().optional(),
	currency: z.string().toLowerCase().nullable().optional(),
	payment_status: z.string().optional(),
	metadata: z.record(z.string(), z.string()).nullable().optional()
});

export const stripeAccountObjectSchema = z.object({
	id: z.string().min(1),
	object: z.literal('account').optional(),
	charges_enabled: z.boolean().default(false),
	payouts_enabled: z.boolean().default(false),
	details_submitted: z.boolean().default(false),
	email: z.string().email().nullable().optional()
});

export const stripeChargeRefundedObjectSchema = z.object({
	id: z.string().min(1),
	object: z.literal('charge').optional(),
	payment_intent: z.union([z.string().min(1), z.object({ id: z.string().min(1) })]).nullable().optional(),
	amount: z.number().int().nonnegative(),
	amount_refunded: z.number().int().nonnegative().default(0),
	currency: z.string().toLowerCase(),
	refunded: z.boolean().default(true)
});

export const stripeDisputeObjectSchema = z.object({
	id: z.string().min(1),
	object: z.literal('dispute').optional(),
	charge: z.union([z.string().min(1), z.object({ id: z.string().min(1) })]),
	payment_intent: z.union([z.string().min(1), z.object({ id: z.string().min(1) })]).nullable().optional(),
	amount: z.number().int().nonnegative(),
	currency: z.string().toLowerCase(),
	reason: z.string().optional(),
	status: z.string().optional()
});

export const stripeWebhookEventSchema = z.object({
	id: z.string().min(1),
	type: z.string().min(1),
	api_version: z.string().nullable().optional(),
	created: z.number().int().nonnegative().optional(),
	livemode: z.boolean().optional(),
	data: z.object({
		object: z.record(z.string(), z.unknown())
	})
});

export type StripeWebhookEventInput = z.infer<typeof stripeWebhookEventSchema>;

export const supportedStripeWebhookEventSchema = z.discriminatedUnion('type', [
	z.object({
		id: z.string().min(1),
		type: z.literal('payment_intent.succeeded'),
		data: z.object({ object: stripePaymentIntentObjectSchema })
	}),
	z.object({
		id: z.string().min(1),
		type: z.literal('payment_intent.payment_failed'),
		data: z.object({ object: stripePaymentIntentObjectSchema })
	}),
	z.object({
		id: z.string().min(1),
		type: z.literal('checkout.session.completed'),
		data: z.object({ object: stripeCheckoutSessionObjectSchema })
	}),
	z.object({
		id: z.string().min(1),
		type: z.literal('account.updated'),
		data: z.object({ object: stripeAccountObjectSchema })
	}),
	z.object({
		id: z.string().min(1),
		type: z.literal('charge.refunded'),
		data: z.object({ object: stripeChargeRefundedObjectSchema })
	}),
	z.object({
		id: z.string().min(1),
		type: z.literal('charge.dispute.created'),
		data: z.object({ object: stripeDisputeObjectSchema })
	})
]);

export type SupportedStripeWebhookEvent = z.infer<typeof supportedStripeWebhookEventSchema>;
