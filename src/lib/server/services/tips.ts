import crypto from 'node:crypto';
import type Stripe from 'stripe';
import { z } from 'zod';
import { db, schema } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import {
	calculateTipBaseNetCents,
	calculateTipBreakdown,
	TipReversalStatus,
	TipStatus,
	type TipBreakdown
} from '$domain/tipping';
import { type Result, type DomainError, ok, err } from '$domain/types';
import {
	initiateTipSchema,
	stripeTipMetadataSchema,
	supportedStripeWebhookEventSchema
} from '$schemas/tipping';
import {
	payoutChangeConfirmationSchema,
	stripeAccountIdSchema,
	type PayoutChangeAction
} from '$schemas/payouts';
import { verifyUserCredentialPassword } from '$lib/server/auth';
import { sendPayoutAccountChangeConfirmationEmail, type EmailSendReceipt } from '$lib/server/email';
import {
	createExpressConnectedAccount,
	createExpressOnboardingLink,
	createTipCheckoutSession,
	createTipPaymentIntent,
	inspectConnectedAccountStatus,
	isStripeConfigured,
	type StripeExpressAccountSummary
} from '$lib/server/payments/stripe';

const startOnboardingSchema = z.object({
	artistId: z.string().min(1, 'Artist ID is required'),
	email: z.string().email('Valid artist email is required'),
	returnUrl: z.string().url('Valid return URL is required'),
	refreshUrl: z.string().url('Valid refresh URL is required')
});

const hostedTipSchema = initiateTipSchema.extend({
	successUrl: z.string().url('Valid success URL is required'),
	cancelUrl: z.string().url('Valid cancel URL is required')
});

const payoutChangeServiceInputSchema = z.object({
	artistId: z.string().min(1),
	userId: z.string().min(1),
	email: z.string().email(),
	password: z.string().min(1, 'Password confirmation is required'),
	action: z.enum(['connect', 'replace', 'disconnect']).default('replace'),
	newStripeAccountId: stripeAccountIdSchema.nullable(),
	origin: z.string().url('Valid application origin URL is required')
});

export type TipCheckoutResult =
	| {
			mode: 'stripe';
			paymentIntentId: string;
			clientSecret: string;
			breakdown: TipBreakdown;
	  }
	| {
			mode: 'mock';
			tipId: string;
			breakdown: TipBreakdown;
			simulatedPaymentId: string;
	  };

export interface WebhookHandlingResult {
	eventType: string;
	handled: boolean;
	action: string;
}

function extractPaymentIntentId(
	value: string | { id: string } | null | undefined
): string | null {
	if (!value) return null;
	if (typeof value === 'string') return value;
	return value.id || null;
}

function hashToken(rawToken: string): string {
	return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Starts or resumes Stripe Connect Express onboarding for an artist.
 */
export async function startArtistStripeOnboarding(input: {
	artistId: string;
	email: string;
	returnUrl: string;
	refreshUrl: string;
}): Promise<Result<{ accountId: string; onboardingUrl: string; expiresAt: Date }, DomainError>> {
	const parsed = startOnboardingSchema.safeParse(input);
	if (!parsed.success) {
		return err({
			code: 'INVALID_ONBOARDING_INPUT',
			message: parsed.error.issues[0]?.message || 'Invalid Stripe onboarding request.'
		});
	}

	const artist = await db.query.artists.findFirst({
		where: eq(schema.artists.id, parsed.data.artistId)
	});
	if (!artist) {
		return err({ code: 'ARTIST_NOT_FOUND', message: 'Artist does not exist.' });
	}

	let accountId = artist.stripeAccountId;
	const needsNewAccount = !accountId || accountId.startsWith('acct_demo_');

	if (needsNewAccount) {
		const created = await createExpressConnectedAccount({
			artistId: artist.id,
			email: parsed.data.email,
			displayName: artist.displayName
		});
		if (!created.ok) return created;

		accountId = created.value.accountId;

		await db
			.update(schema.artists)
			.set({
				stripeAccountId: accountId,
				payoutsEnabled: created.value.payoutsEnabled,
				updatedAt: new Date()
			})
			.where(eq(schema.artists.id, artist.id));
	}

	const linkResult = await createExpressOnboardingLink({
		accountId: accountId!,
		refreshUrl: parsed.data.refreshUrl,
		returnUrl: parsed.data.returnUrl,
		type: 'account_onboarding'
	});
	if (!linkResult.ok) return linkResult;

	return ok({
		accountId: accountId!,
		onboardingUrl: linkResult.value.url,
		expiresAt: linkResult.value.expiresAt
	});
}

/**
 * Syncs an artist's Stripe Express capabilities (`payouts_enabled`, etc.) from Stripe.
 */
export async function syncArtistStripeAccountStatus(
	artistId: string
): Promise<Result<StripeExpressAccountSummary, DomainError>> {
	if (!artistId) {
		return err({ code: 'INVALID_ARTIST_ID', message: 'Artist ID is required.' });
	}

	const artist = await db.query.artists.findFirst({
		where: eq(schema.artists.id, artistId)
	});
	if (!artist) {
		return err({ code: 'ARTIST_NOT_FOUND', message: 'Artist does not exist.' });
	}

	if (!artist.stripeAccountId || artist.stripeAccountId.startsWith('acct_demo_')) {
		return err({
			code: 'STRIPE_ACCOUNT_MISSING',
			message: 'Artist has not connected a live Stripe Express account.'
		});
	}

	const statusResult = await inspectConnectedAccountStatus(artist.stripeAccountId);
	if (!statusResult.ok) return statusResult;

	await db
		.update(schema.artists)
		.set({
			payoutsEnabled: statusResult.value.payoutsEnabled,
			updatedAt: new Date()
		})
		.where(eq(schema.artists.id, artist.id));

	return statusResult;
}

/**
 * Initiates a SPEC 6.4 payout account change: requires password re-entry, persists
 * a single-use hashed token in `payout_change_tokens`, and sends a Resend email confirmation link.
 */
export async function requestPayoutAccountChange(input: {
	artistId: string;
	userId: string;
	email: string;
	password: string;
	action?: PayoutChangeAction;
	newStripeAccountId: string | null;
	origin: string;
}): Promise<Result<{ confirmationSent: boolean; emailMode: EmailSendReceipt['mode'] }, DomainError>> {
	const parsed = payoutChangeServiceInputSchema.safeParse(input);
	if (!parsed.success) {
		return err({
			code: 'INVALID_PAYOUT_CHANGE_REQUEST',
			message: parsed.error.issues[0]?.message || 'Invalid payout account change request.'
		});
	}

	const artist = await db.query.artists.findFirst({
		where: eq(schema.artists.id, parsed.data.artistId)
	});
	if (!artist || artist.userId !== parsed.data.userId) {
		return err({ code: 'UNAUTHORIZED', message: 'Artist ownership verification failed.' });
	}

	const passwordValid = await verifyUserCredentialPassword(
		parsed.data.userId,
		parsed.data.password
	);
	if (!passwordValid) {
		return err({
			code: 'INVALID_PASSWORD',
			message: 'Password re-verification failed. Please re-enter your shared band password.'
		});
	}

	const now = new Date();
	const expiresAt = new Date(now.getTime() + 1000 * 60 * 30); // 30 minutes
	const rawToken = crypto.randomBytes(32).toString('base64url');
	const tokenHash = hashToken(rawToken);

	// Supersede any previous pending payout change tokens for this artist
	await db
		.update(schema.payoutChangeTokens)
		.set({ status: 'cancelled' })
		.where(
			and(
				eq(schema.payoutChangeTokens.artistId, artist.id),
				eq(schema.payoutChangeTokens.status, 'pending')
			)
		);

	await db.insert(schema.payoutChangeTokens).values({
		id: crypto.randomUUID(),
		artistId: artist.id,
		userId: parsed.data.userId,
		tokenHash,
		action: parsed.data.action,
		targetStripeAccountId: parsed.data.newStripeAccountId,
		status: 'pending',
		expiresAt,
		createdAt: now
	});

	const base = parsed.data.origin.replace(/\/$/, '');
	const confirmationUrl = `${base}/dashboard/settings?confirmPayoutToken=${encodeURIComponent(rawToken)}`;

	const receipt = await sendPayoutAccountChangeConfirmationEmail({
		to: parsed.data.email,
		artistName: artist.displayName,
		confirmationUrl,
		newStripeAccountId: parsed.data.newStripeAccountId ?? 'disconnect'
	});
	if (!receipt.ok) return receipt;

	return ok({
		confirmationSent: true,
		emailMode: receipt.value.mode
	});
}

/**
 * Verifies the single-use email confirmation token from SPEC 6.4 and commits the payout account change.
 */
export async function confirmPayoutAccountChange(
	rawToken: string
): Promise<Result<{ artistId: string; stripeAccountId: string | null }, DomainError>> {
	const parsed = payoutChangeConfirmationSchema.safeParse({ token: rawToken });
	if (!parsed.success) {
		return err({
			code: 'INVALID_TOKEN',
			message: parsed.error.issues[0]?.message || 'Malformed payout confirmation token.'
		});
	}

	const tokenHash = hashToken(parsed.data.token);
	const record = await db.query.payoutChangeTokens.findFirst({
		where: eq(schema.payoutChangeTokens.tokenHash, tokenHash)
	});

	if (!record) {
		return err({ code: 'INVALID_TOKEN', message: 'Payout confirmation token not found.' });
	}

	if (record.status !== 'pending') {
		return err({
			code: 'TOKEN_ALREADY_USED',
			message: `Payout confirmation token is already ${record.status}.`
		});
	}

	const now = new Date();
	if (now.getTime() > record.expiresAt.getTime()) {
		await db
			.update(schema.payoutChangeTokens)
			.set({ status: 'expired' })
			.where(eq(schema.payoutChangeTokens.id, record.id));
		return err({
			code: 'TOKEN_EXPIRED',
			message: 'Payout account confirmation link has expired. Please request a new one.'
		});
	}

	let nextAccountId: string | null = record.targetStripeAccountId;
	let payoutsEnabled = false;

	if (record.action === 'disconnect') {
		nextAccountId = null;
		payoutsEnabled = false;
	} else if (
		nextAccountId &&
		isStripeConfigured() &&
		!nextAccountId.startsWith('acct_demo_')
	) {
		const statusResult = await inspectConnectedAccountStatus(nextAccountId);
		if (statusResult.ok) {
			payoutsEnabled = statusResult.value.payoutsEnabled;
		}
	}

	await db
		.update(schema.payoutChangeTokens)
		.set({
			status: 'confirmed',
			confirmedAt: now
		})
		.where(eq(schema.payoutChangeTokens.id, record.id));

	await db
		.update(schema.artists)
		.set({
			stripeAccountId: nextAccountId,
			payoutsEnabled,
			updatedAt: now
		})
		.where(eq(schema.artists.id, record.artistId));

	return ok({
		artistId: record.artistId,
		stripeAccountId: nextAccountId
	});
}

/**
 * Creates a one-tap tip checkout (PaymentIntent via Stripe Connect Express when configured,
 * or simulated dev tip record when STRIPE_SECRET_KEY is absent).
 */
export async function createTipCheckout(params: {
	artistId: string;
	issueId?: string | null;
	amountGrossCents: number;
	fanCoveredFees?: boolean;
	returnUrl?: string;
}): Promise<Result<TipCheckoutResult, DomainError>> {
	const parsed = initiateTipSchema.safeParse(params);
	if (!parsed.success) {
		return err({
			code: 'INVALID_TIP_INPUT',
			message: parsed.error.issues[0]?.message || 'Invalid tip request.'
		});
	}

	const breakdownResult = calculateTipBreakdown(
		parsed.data.amountGrossCents,
		parsed.data.fanCoveredFees
	);
	if (!breakdownResult.ok) return breakdownResult;
	const breakdown = breakdownResult.value;

	const artist = await db.query.artists.findFirst({
		where: eq(schema.artists.id, parsed.data.artistId)
	});
	if (!artist) {
		return err({ code: 'ARTIST_NOT_FOUND', message: 'Artist does not exist.' });
	}

	if (!artist.payoutsEnabled) {
		return err({
			code: 'PAYOUTS_DISABLED',
			message: 'This artist has not enabled payouts yet.'
		});
	}

	const hasLiveConnectAccount =
		Boolean(artist.stripeAccountId) && !artist.stripeAccountId!.startsWith('acct_demo_');

	if (isStripeConfigured() && hasLiveConnectAccount) {
		const intentResult = await createTipPaymentIntent({
			stripeAccountId: artist.stripeAccountId!,
			artistId: artist.id,
			issueId: parsed.data.issueId ?? null,
			amountGrossCents: breakdown.grossCents,
			fanCoveredFees: breakdown.fanCoveredFees
		});
		if (!intentResult.ok) return intentResult;

		return ok({
			mode: 'stripe',
			paymentIntentId: intentResult.value.paymentIntentId,
			clientSecret: intentResult.value.clientSecret,
			breakdown
		});
	}

	if (isStripeConfigured() && !hasLiveConnectAccount) {
		return err({
			code: 'STRIPE_ACCOUNT_NOT_CONNECTED',
			message: 'Artist must connect a Stripe Express account before accepting live tips.'
		});
	}

	// Local dev / test fallback when STRIPE_SECRET_KEY is not configured
	const tipId = crypto.randomUUID();
	const simulatedPaymentId = `mock_pi_${crypto.randomBytes(12).toString('hex')}`;

	await db.insert(schema.tips).values({
		id: tipId,
		artistId: artist.id,
		issueId: parsed.data.issueId ?? null,
		amountGross: breakdown.grossCents,
		feeStripe: breakdown.feeStripeCents,
		feePlatform: breakdown.feePlatformCents,
		amountNet: breakdown.netArtistCents,
		fanCoveredFees: breakdown.fanCoveredFees,
		stripePaymentId: simulatedPaymentId,
		status: TipStatus.Succeeded,
		createdAt: new Date()
	});

	return ok({
		mode: 'mock',
		tipId,
		breakdown,
		simulatedPaymentId
	});
}

/**
 * Creates a hosted Stripe Checkout Session for a tip.
 */
export async function createHostedTipCheckout(params: {
	artistId: string;
	issueId?: string | null;
	amountGrossCents: number;
	fanCoveredFees?: boolean;
	successUrl: string;
	cancelUrl: string;
}): Promise<Result<{ sessionId: string; url: string; breakdown: TipBreakdown }, DomainError>> {
	const parsed = hostedTipSchema.safeParse(params);
	if (!parsed.success) {
		return err({
			code: 'INVALID_TIP_INPUT',
			message: parsed.error.issues[0]?.message || 'Invalid hosted tip checkout input.'
		});
	}

	const artist = await db.query.artists.findFirst({
		where: eq(schema.artists.id, parsed.data.artistId)
	});
	if (!artist) {
		return err({ code: 'ARTIST_NOT_FOUND', message: 'Artist does not exist.' });
	}
	if (!artist.payoutsEnabled || !artist.stripeAccountId || artist.stripeAccountId.startsWith('acct_demo_')) {
		return err({
			code: 'PAYOUTS_DISABLED',
			message: 'Artist is not ready to receive live Stripe Checkout tips.'
		});
	}

	return createTipCheckoutSession({
		stripeAccountId: artist.stripeAccountId,
		artistId: artist.id,
		artistName: artist.displayName,
		issueId: parsed.data.issueId ?? null,
		amountGrossCents: parsed.data.amountGrossCents,
		fanCoveredFees: parsed.data.fanCoveredFees,
		successUrl: parsed.data.successUrl,
		cancelUrl: parsed.data.cancelUrl
	});
}

async function recordSucceededTipIdempotent(params: {
	stripePaymentId: string;
	metadata: Record<string, string>;
}): Promise<Result<'recorded' | 'duplicate', DomainError>> {
	const parsedMeta = stripeTipMetadataSchema.safeParse(params.metadata);
	if (!parsedMeta.success || !parsedMeta.data.amountGrossCents) {
		return err({
			code: 'INVALID_WEBHOOK_METADATA',
			message: parsedMeta.success
				? 'Missing amountGrossCents in tip metadata.'
				: parsedMeta.error.issues[0]?.message || 'Missing required tip metadata.'
		});
	}

	const existing = await db.query.tips.findFirst({
		where: eq(schema.tips.stripePaymentId, params.stripePaymentId)
	});
	if (existing) {
		return ok('duplicate');
	}

	const breakdownResult = calculateTipBreakdown(
		Number(parsedMeta.data.amountGrossCents),
		parsedMeta.data.fanCoveredFees === 'true'
	);
	if (!breakdownResult.ok) return breakdownResult;
	const breakdown = breakdownResult.value;

	const resolvedIssueId =
		parsedMeta.data.issueId && parsedMeta.data.issueId !== 'general'
			? parsedMeta.data.issueId
			: null;

	await db.insert(schema.tips).values({
		id: crypto.randomUUID(),
		artistId: parsedMeta.data.artistId,
		issueId: resolvedIssueId,
		amountGross: breakdown.grossCents,
		feeStripe: breakdown.feeStripeCents,
		feePlatform: breakdown.feePlatformCents,
		amountNet: breakdown.netArtistCents,
		fanCoveredFees: breakdown.fanCoveredFees,
		stripePaymentId: params.stripePaymentId,
		status: TipStatus.Succeeded,
		createdAt: new Date()
	});

	return ok('recorded');
}

export interface ApplyTipReversalParams {
	stripePaymentId: string;
	status: TipReversalStatus;
	deductionCents: number;
}

async function applyTipReversalIdempotent(
	params: ApplyTipReversalParams
): Promise<'adjusted' | 'not_found'> {
	const existing = await db.query.tips.findFirst({
		where: eq(schema.tips.stripePaymentId, params.stripePaymentId)
	});
	if (!existing) {
		return 'not_found';
	}

	const baseNet = calculateTipBaseNetCents(existing);
	const updatedNet = baseNet - params.deductionCents;

	if (existing.amountNet !== updatedNet || existing.status !== params.status) {
		await db
			.update(schema.tips)
			.set({
				amountNet: updatedNet,
				status: params.status,
				refundedAt: existing.refundedAt ?? new Date()
			})
			.where(eq(schema.tips.id, existing.id));
	}

	return 'adjusted';
}

/**
 * Processes verified Stripe webhook events idempotently against the Quire database.
 */
export async function handleStripeWebhookEvent(
	event: Stripe.Event
): Promise<Result<WebhookHandlingResult, DomainError>> {
	const parsedEvent = supportedStripeWebhookEventSchema.safeParse(event);
	if (!parsedEvent.success) {
		return ok({
			eventType: event.type,
			handled: false,
			action: 'ignored_event_type'
		});
	}

	const typedEvent = parsedEvent.data;

	switch (typedEvent.type) {
		case 'payment_intent.succeeded': {
			const outcome = await recordSucceededTipIdempotent({
				stripePaymentId: typedEvent.data.object.id,
				metadata: typedEvent.data.object.metadata
			});
			if (!outcome.ok) return outcome;

			return ok({
				eventType: typedEvent.type,
				handled: true,
				action: outcome.value === 'duplicate' ? 'tip_already_recorded' : 'tip_recorded'
			});
		}

		case 'payment_intent.payment_failed': {
			// Per Decision 18 / SPEC 5.4: failed attempts are never queued, saved, or retried.
			return ok({
				eventType: typedEvent.type,
				handled: true,
				action: 'payment_failed_no_persistence'
			});
		}

		case 'checkout.session.completed': {
			const sessionObj = typedEvent.data.object;
			if (sessionObj.payment_status && sessionObj.payment_status !== 'paid') {
				return ok({
					eventType: typedEvent.type,
					handled: true,
					action: 'session_unpaid_ignored'
				});
			}

			const paymentId = extractPaymentIntentId(sessionObj.payment_intent) ?? sessionObj.id;
			const outcome = await recordSucceededTipIdempotent({
				stripePaymentId: paymentId,
				metadata: sessionObj.metadata ?? {}
			});
			if (!outcome.ok) return outcome;

			return ok({
				eventType: typedEvent.type,
				handled: true,
				action: outcome.value === 'duplicate' ? 'tip_already_recorded' : 'tip_recorded'
			});
		}

		case 'account.updated': {
			const acct = typedEvent.data.object;
			await db
				.update(schema.artists)
				.set({
					payoutsEnabled: acct.payouts_enabled,
					updatedAt: new Date()
				})
				.where(eq(schema.artists.stripeAccountId, acct.id));

			return ok({
				eventType: typedEvent.type,
				handled: true,
				action: `artist_payouts_synced:${String(acct.payouts_enabled)}`
			});
		}

		case 'charge.refunded': {
			const chargeObj = typedEvent.data.object;
			const paymentIntentId = extractPaymentIntentId(chargeObj.payment_intent);
			if (!paymentIntentId) {
				return ok({
					eventType: typedEvent.type,
					handled: true,
					action: 'refund_missing_payment_intent'
				});
			}

			const outcome = await applyTipReversalIdempotent({
				stripePaymentId: paymentIntentId,
				status: TipReversalStatus.Refunded,
				deductionCents: chargeObj.amount_refunded
			});

			return ok({
				eventType: typedEvent.type,
				handled: true,
				action: outcome === 'adjusted' ? 'tip_refund_absorbed' : 'tip_not_found'
			});
		}

		case 'charge.dispute.created': {
			const disputeObj = typedEvent.data.object;
			const paymentIntentId = extractPaymentIntentId(disputeObj.payment_intent);
			if (!paymentIntentId) {
				return ok({
					eventType: typedEvent.type,
					handled: true,
					action: 'dispute_missing_payment_intent'
				});
			}

			const outcome = await applyTipReversalIdempotent({
				stripePaymentId: paymentIntentId,
				status: TipReversalStatus.Disputed,
				deductionCents: disputeObj.amount
			});

			return ok({
				eventType: typedEvent.type,
				handled: true,
				action: outcome === 'adjusted' ? 'tip_dispute_absorbed' : 'tip_not_found'
			});
		}
	}
}
