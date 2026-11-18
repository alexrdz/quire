import crypto from 'node:crypto';
import { db, schema } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import {
	calculateTipBreakdown,
	type TipBreakdown,
	MIN_TIP_CENTS,
	MAX_TIP_CENTS
} from '$domain/tipping';
import { type Result, type DomainError, ok, err } from '$domain/types';

import { getConfig } from '$lib/server/config';
import { getStripeClient } from '$lib/server/payments/stripe';

import { FEATURE_UNAVAILABLE } from '$lib/features';

export interface CreateTipParams {
	artistId: string;
	issueId?: string | null;
	amountGrossCents: number;
	fanCoveredFees?: boolean;
	returnUrl: string;
}

export type TipCheckoutResult =
	| {
			mode: 'stripe';
			clientSecret: string;
			breakdown: TipBreakdown;
	  }
	| {
			mode: 'mock';
			tipId: string;
			breakdown: TipBreakdown;
			simulatedPaymentId: string;
	  };

/**
 * Creates a tip checkout session:
 * - If Stripe Connect is configured with live/test key, creates Stripe PaymentIntent.
 * - If Stripe is unconfigured (offline/dev/demo), runs 1-tap local simulator and writes tip record (ADR 0003).
 */
export async function createTipCheckout(
	params: CreateTipParams
): Promise<Result<TipCheckoutResult, DomainError>> {
	const config = getConfig();
	if (!config.features.payments) {
		return err({ code: 'PAYMENTS_UNAVAILABLE', message: FEATURE_UNAVAILABLE.payments });
	}

	const breakdownResult = calculateTipBreakdown(
		params.amountGrossCents,
		params.fanCoveredFees ?? false
	);

	if (!breakdownResult.ok) {
		return err(breakdownResult.error);
	}

	const breakdown = breakdownResult.value;

	const artist = await db.query.artists.findFirst({
		where: eq(schema.artists.id, params.artistId)
	});

	if (!artist) {
		return err({ code: 'ARTIST_NOT_FOUND', message: 'Artist does not exist.' });
	}

	// 1. Stripe Connect flow
	const stripe = config.live.payments ? getStripeClient() : null;
	if (stripe && artist.stripeAccountId && artist.payoutsEnabled) {
		try {
			const paymentIntent = await stripe.paymentIntents.create({
				amount: breakdown.totalChargedCents,
				currency: 'usd',
				application_fee_amount: breakdown.feePlatformCents,
				transfer_data: {
					destination: artist.stripeAccountId
				},
				metadata: {
					artistId: artist.id,
					issueId: params.issueId ?? 'general',
					fanCoveredFees: String(breakdown.fanCoveredFees)
				}
			});

			return ok({
				mode: 'stripe',
				clientSecret: paymentIntent.client_secret!,
				breakdown
			});
		} catch (error) {
			return err({
				code: 'STRIPE_SESSION_ERROR',
				message: `Failed to initialize Stripe PaymentIntent: ${String(error)}`
			});
		}
	}

	// 2. Offline / Demo Mock Payment Simulator (ADR 0003). Never in production (ADR 0007).
	if (config.mode === 'production') {
		return err({ code: 'PAYMENTS_UNAVAILABLE', message: FEATURE_UNAVAILABLE.payments });
	}
	const tipId = crypto.randomUUID();
	const simulatedPaymentId = `mock_pi_${crypto.randomBytes(12).toString('hex')}`;

	await db.insert(schema.tips).values({
		id: tipId,
		artistId: artist.id,
		issueId: params.issueId ?? null,
		amountGross: breakdown.grossCents,
		feeStripe: breakdown.feeStripeCents,
		feePlatform: breakdown.feePlatformCents,
		amountNet: breakdown.netArtistCents,
		fanCoveredFees: breakdown.fanCoveredFees,
		stripePaymentId: simulatedPaymentId,
		createdAt: new Date()
	});

	return ok({
		mode: 'mock',
		tipId,
		breakdown,
		simulatedPaymentId
	});
}
