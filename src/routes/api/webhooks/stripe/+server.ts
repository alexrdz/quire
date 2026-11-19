import { error, json, type RequestHandler } from '@sveltejs/kit';
import { z } from 'zod';
import { verifyStripeWebhookEvent } from '$lib/server/payments/stripe';
import { handleStripeWebhookEvent } from '$lib/server/services/tips';

const stripeSignatureHeaderSchema = z
	.string()
	.min(1, 'Missing stripe-signature header');

/**
 * Stripe is dormant (ADR 0008): tips go straight to the Artist's Venmo, so no
 * Stripe event is accepted. Every method on this endpoint is 404.
 */
export const fallback: RequestHandler = () => {
	throw error(404, 'Not found');
};

/**
 * The former POST handler, kept compiling but unwired (ADR 0008). To revive
 * Stripe, export it as `POST` again and restore Stripe in `config.ts`.
 */
export const _dormantStripeWebhookHandler: RequestHandler = async ({ request }) => {
	const headerResult = stripeSignatureHeaderSchema.safeParse(
		request.headers.get('stripe-signature') ?? ''
	);
	if (!headerResult.success) {
		return json(
			{
				received: false,
				error: headerResult.error.issues[0]?.message || 'Missing stripe-signature header'
			},
			{ status: 400 }
		);
	}

	const rawBody = await request.text();
	const verification = verifyStripeWebhookEvent(rawBody, headerResult.data);
	if (!verification.ok) {
		const status =
			verification.error.code === 'WEBHOOK_VERIFICATION_FAILED' &&
			verification.error.message.includes('STRIPE_WEBHOOK_SECRET')
				? 500
				: 400;
		return json(
			{
				received: false,
				code: verification.error.code,
				error: verification.error.message
			},
			{ status }
		);
	}

	const handled = await handleStripeWebhookEvent(verification.value);
	if (!handled.ok) {
		return json(
			{
				received: false,
				code: handled.error.code,
				error: handled.error.message
			},
			{ status: 422 }
		);
	}

	return json({
		received: true,
		...handled.value
	});
};
