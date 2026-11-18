import Stripe from 'stripe';
import { z } from 'zod';
import {
	calculateTipBreakdown,
	MAX_TIP_CENTS,
	MIN_TIP_CENTS,
	type TipBreakdown
} from '$domain/tipping';
import { type Result, type DomainError, ok, err } from '$domain/types';
import { getConfig } from '$lib/server/config';

const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2025-02-24.acacia';

let cachedClient: { secretKey: string; client: Stripe } | null = null;

function readStripeSecretKey(): string | null {
	return getConfig().integrations.stripe.secretKey;
}

export function isStripeConfigured(): boolean {
	return readStripeSecretKey() !== null;
}

export function getStripeClient(): Stripe | null {
	const secretKey = readStripeSecretKey();
	if (!secretKey) return null;

	if (cachedClient && cachedClient.secretKey === secretKey) {
		return cachedClient.client;
	}

	const client = new Stripe(secretKey, {
		apiVersion: STRIPE_API_VERSION,
		typescript: true
	});
	cachedClient = { secretKey, client };
	return client;
}

function requireStripeClient(): Result<Stripe, DomainError> {
	const client = getStripeClient();
	if (!client) {
		return err({
			code: 'STRIPE_NOT_CONFIGURED',
			message: 'Stripe secret key is not configured.'
		});
	}
	return ok(client);
}

const createExpressAccountSchema = z.object({
	artistId: z.string().min(1, 'Artist ID is required'),
	email: z.string().email('Valid email is required'),
	displayName: z.string().min(1, 'Display name is required').max(120),
	country: z.string().length(2).default('US'),
	businessUrl: z.string().url().optional()
});

const accountLinkSchema = z.object({
	accountId: z.string().min(1, 'Stripe account ID is required'),
	refreshUrl: z.string().url('Valid refresh URL is required'),
	returnUrl: z.string().url('Valid return URL is required'),
	type: z.enum(['account_onboarding', 'account_update']).default('account_onboarding')
});

const accountIdSchema = z.object({
	accountId: z.string().min(1, 'Stripe account ID is required')
});

const tipPaymentIntentSchema = z.object({
	stripeAccountId: z.string().min(1, 'Connected Stripe account ID is required'),
	artistId: z.string().min(1, 'Artist ID is required'),
	issueId: z.string().min(1).nullable().optional(),
	amountGrossCents: z
		.number()
		.int('Tip amount must be an integer in cents')
		.min(MIN_TIP_CENTS, `Minimum tip is $${(MIN_TIP_CENTS / 100).toFixed(2)} USD`)
		.max(MAX_TIP_CENTS, `Maximum tip is $${(MAX_TIP_CENTS / 100).toFixed(2)} USD`),
	fanCoveredFees: z.boolean().default(false)
});

const tipCheckoutSessionSchema = tipPaymentIntentSchema.extend({
	artistName: z.string().min(1, 'Artist name is required').max(120),
	successUrl: z.string().url('Valid success URL is required'),
	cancelUrl: z.string().url('Valid cancel URL is required')
});

const webhookVerifySchema = z.object({
	signature: z.string().min(1, 'Missing stripe-signature header'),
	webhookSecret: z.string().min(1, 'STRIPE_WEBHOOK_SECRET is not configured')
});

export interface StripeExpressAccountSummary {
	accountId: string;
	payoutsEnabled: boolean;
	chargesEnabled: boolean;
	detailsSubmitted: boolean;
	requirementsCurrentlyDue: string[];
}

function toAccountSummary(account: Stripe.Account): StripeExpressAccountSummary {
	return {
		accountId: account.id,
		payoutsEnabled: Boolean(account.payouts_enabled),
		chargesEnabled: Boolean(account.charges_enabled),
		detailsSubmitted: Boolean(account.details_submitted),
		requirementsCurrentlyDue: account.requirements?.currently_due ?? []
	};
}

function formatStripeError(code: string, error: unknown): DomainError {
	if (error instanceof Stripe.errors.StripeError) {
		return {
			code,
			message: error.message
		};
	}
	return {
		code,
		message: error instanceof Error ? error.message : String(error)
	};
}

/**
 * Creates a Stripe Connect Express connected account for an Artist.
 */
export async function createExpressConnectedAccount(input: {
	artistId: string;
	email: string;
	displayName: string;
	country?: string;
	businessUrl?: string;
}): Promise<Result<StripeExpressAccountSummary, DomainError>> {
	const parsed = createExpressAccountSchema.safeParse(input);
	if (!parsed.success) {
		return err({
			code: 'INVALID_STRIPE_INPUT',
			message: parsed.error.issues[0]?.message || 'Invalid connected account input.'
		});
	}

	const clientResult = requireStripeClient();
	if (!clientResult.ok) return clientResult;

	try {
		const account = await clientResult.value.accounts.create({
			type: 'express',
			country: parsed.data.country.toUpperCase(),
			email: parsed.data.email,
			business_type: 'individual',
			capabilities: {
				card_payments: { requested: true },
				transfers: { requested: true }
			},
			business_profile: {
				name: parsed.data.displayName,
				...(parsed.data.businessUrl ? { url: parsed.data.businessUrl } : {})
			},
			metadata: {
				artistId: parsed.data.artistId
			}
		});

		return ok(toAccountSummary(account));
	} catch (error) {
		return err(formatStripeError('STRIPE_ACCOUNT_CREATE_FAILED', error));
	}
}

/**
 * Generates a single-use Stripe Connect Express onboarding or account update URL.
 */
export async function createExpressOnboardingLink(input: {
	accountId: string;
	refreshUrl: string;
	returnUrl: string;
	type?: 'account_onboarding' | 'account_update';
}): Promise<Result<{ url: string; expiresAt: Date }, DomainError>> {
	const parsed = accountLinkSchema.safeParse(input);
	if (!parsed.success) {
		return err({
			code: 'INVALID_STRIPE_INPUT',
			message: parsed.error.issues[0]?.message || 'Invalid account link input.'
		});
	}

	const clientResult = requireStripeClient();
	if (!clientResult.ok) return clientResult;

	try {
		const link = await clientResult.value.accountLinks.create({
			account: parsed.data.accountId,
			refresh_url: parsed.data.refreshUrl,
			return_url: parsed.data.returnUrl,
			type: parsed.data.type
		});

		return ok({
			url: link.url,
			expiresAt: new Date(link.expires_at * 1000)
		});
	} catch (error) {
		return err(formatStripeError('STRIPE_ACCOUNT_LINK_FAILED', error));
	}
}

/**
 * Retrieves live capability and onboarding state for a Stripe Express connected account.
 */
export async function inspectConnectedAccountStatus(
	accountId: string
): Promise<Result<StripeExpressAccountSummary, DomainError>> {
	const parsed = accountIdSchema.safeParse({ accountId });
	if (!parsed.success) {
		return err({
			code: 'INVALID_STRIPE_INPUT',
			message: parsed.error.issues[0]?.message || 'Invalid Stripe account ID.'
		});
	}

	const clientResult = requireStripeClient();
	if (!clientResult.ok) return clientResult;

	try {
		const account = await clientResult.value.accounts.retrieve(parsed.data.accountId);
		return ok(toAccountSummary(account));
	} catch (error) {
		return err(formatStripeError('STRIPE_ACCOUNT_RETRIEVE_FAILED', error));
	}
}

function buildTipMetadata(
	artistId: string,
	issueId: string | null | undefined,
	breakdown: TipBreakdown
): Record<string, string> {
	return {
		artistId,
		issueId: issueId ?? 'general',
		amountGrossCents: String(breakdown.grossCents),
		feePlatformCents: String(breakdown.feePlatformCents),
		feeStripeCents: String(breakdown.feeStripeCents),
		amountNetCents: String(breakdown.netArtistCents),
		fanCoveredFees: String(breakdown.fanCoveredFees)
	};
}

/**
 * Creates a Stripe Connect destination PaymentIntent for one-tap tips (Apple Pay / Google Pay / card),
 * applying the 5% platform cut as `application_fee_amount` and enforcing $2-$500 USD domain invariants.
 */
export async function createTipPaymentIntent(input: {
	stripeAccountId: string;
	artistId: string;
	issueId?: string | null;
	amountGrossCents: number;
	fanCoveredFees?: boolean;
}): Promise<
	Result<
		{
			paymentIntentId: string;
			clientSecret: string;
			breakdown: TipBreakdown;
		},
		DomainError
	>
> {
	const parsed = tipPaymentIntentSchema.safeParse(input);
	if (!parsed.success) {
		return err({
			code: 'INVALID_TIP_INPUT',
			message: parsed.error.issues[0]?.message || 'Invalid tip payment input.'
		});
	}

	const breakdownResult = calculateTipBreakdown(
		parsed.data.amountGrossCents,
		parsed.data.fanCoveredFees
	);
	if (!breakdownResult.ok) return breakdownResult;
	const breakdown = breakdownResult.value;

	const clientResult = requireStripeClient();
	if (!clientResult.ok) return clientResult;

	const metadata = buildTipMetadata(parsed.data.artistId, parsed.data.issueId, breakdown);

	try {
		const intent = await clientResult.value.paymentIntents.create({
			amount: breakdown.totalChargedCents,
			currency: 'usd',
			automatic_payment_methods: { enabled: true },
			application_fee_amount: breakdown.feePlatformCents,
			transfer_data: {
				destination: parsed.data.stripeAccountId
			},
			metadata
		});

		if (!intent.client_secret) {
			return err({
				code: 'STRIPE_PAYMENT_INTENT_ERROR',
				message: 'Stripe did not return a client secret for PaymentIntent.'
			});
		}

		return ok({
			paymentIntentId: intent.id,
			clientSecret: intent.client_secret,
			breakdown
		});
	} catch (error) {
		return err(formatStripeError('STRIPE_PAYMENT_INTENT_ERROR', error));
	}
}

/**
 * Creates a Stripe Checkout Session for hosted one-tap tip checkout with Stripe Connect
 * destination transfer and 5% platform `application_fee_amount`.
 */
export async function createTipCheckoutSession(input: {
	stripeAccountId: string;
	artistId: string;
	artistName: string;
	issueId?: string | null;
	amountGrossCents: number;
	fanCoveredFees?: boolean;
	successUrl: string;
	cancelUrl: string;
}): Promise<
	Result<
		{
			sessionId: string;
			url: string;
			breakdown: TipBreakdown;
		},
		DomainError
	>
> {
	const parsed = tipCheckoutSessionSchema.safeParse(input);
	if (!parsed.success) {
		return err({
			code: 'INVALID_TIP_INPUT',
			message: parsed.error.issues[0]?.message || 'Invalid tip checkout session input.'
		});
	}

	const breakdownResult = calculateTipBreakdown(
		parsed.data.amountGrossCents,
		parsed.data.fanCoveredFees
	);
	if (!breakdownResult.ok) return breakdownResult;
	const breakdown = breakdownResult.value;

	const clientResult = requireStripeClient();
	if (!clientResult.ok) return clientResult;

	const metadata = buildTipMetadata(parsed.data.artistId, parsed.data.issueId, breakdown);

	try {
		const session = await clientResult.value.checkout.sessions.create({
			mode: 'payment',
			line_items: [
				{
					price_data: {
						currency: 'usd',
						unit_amount: breakdown.totalChargedCents,
						product_data: {
							name: `Tip for ${parsed.data.artistName}`,
							description: breakdown.fanCoveredFees
								? 'Includes processing fee coverage'
								: 'Direct artist support via Quire'
						}
					},
					quantity: 1
				}
			],
			payment_intent_data: {
				application_fee_amount: breakdown.feePlatformCents,
				transfer_data: {
					destination: parsed.data.stripeAccountId
				},
				metadata
			},
			metadata,
			success_url: parsed.data.successUrl,
			cancel_url: parsed.data.cancelUrl
		});

		if (!session.url) {
			return err({
				code: 'STRIPE_CHECKOUT_SESSION_ERROR',
				message: 'Stripe did not return a hosted checkout URL.'
			});
		}

		return ok({
			sessionId: session.id,
			url: session.url,
			breakdown
		});
	} catch (error) {
		return err(formatStripeError('STRIPE_CHECKOUT_SESSION_ERROR', error));
	}
}

/**
 * Cryptographically verifies a Stripe webhook payload using `stripe.webhooks.constructEvent`.
 */
export function verifyStripeWebhookEvent(
	rawBody: string | Buffer,
	signature: string | null | undefined,
	webhookSecretOverride?: string
): Result<Stripe.Event, DomainError> {
	const webhookSecret = (webhookSecretOverride ?? getConfig().integrations.stripe.webhookSecret ?? '').trim();

	const parsed = webhookVerifySchema.safeParse({
		signature: signature ?? '',
		webhookSecret
	});

	if (!parsed.success) {
		return err({
			code: 'WEBHOOK_VERIFICATION_FAILED',
			message: parsed.error.issues[0]?.message || 'Webhook signature or secret missing.'
		});
	}

	if (!rawBody || (typeof rawBody === 'string' && rawBody.length === 0) || (Buffer.isBuffer(rawBody) && rawBody.length === 0)) {
		return err({
			code: 'WEBHOOK_EMPTY_BODY',
			message: 'Webhook request body cannot be empty.'
		});
	}

	const webhooks = getStripeClient()?.webhooks ?? Stripe.webhooks;

	try {
		const event = webhooks.constructEvent(
			rawBody,
			parsed.data.signature,
			parsed.data.webhookSecret
		);
		return ok(event);
	} catch (error) {
		return err(formatStripeError('WEBHOOK_SIGNATURE_INVALID', error));
	}
}
