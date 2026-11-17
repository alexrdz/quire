import crypto from 'node:crypto';
import Stripe from 'stripe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { db, schema } from '$lib/server/db';
import { seedDatabase } from '$lib/server/seed';
import {
	sendPasswordResetEmail,
	sendPayoutAccountChangeConfirmationEmail,
	sendVerificationEmail
} from '$lib/server/email';
import {
	createTipCheckoutSession,
	createTipPaymentIntent,
	verifyStripeWebhookEvent
} from '$lib/server/payments/stripe';
import {
	confirmPayoutAccountChange,
	createTipCheckout,
	handleStripeWebhookEvent,
	requestPayoutAccountChange
} from '$lib/server/services/tips';
import { POST as stripeWebhookPOST } from '../../../src/routes/api/webhooks/stripe/+server';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
	process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
	process.env = { ...ORIGINAL_ENV };
	vi.restoreAllMocks();
});

describe('Resend Email Infrastructure', () => {
	it('falls back to console logging ONLY when RESEND_API_KEY is unset', async () => {
		delete process.env.RESEND_API_KEY;
		const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

		const result = await sendVerificationEmail({
			to: 'band@example.com',
			artistName: 'The Neon Velvet',
			verificationUrl: 'https://quire.live/verify?token=abc'
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.mode).toBe('dev_console');
		expect(infoSpy).toHaveBeenCalled();
	});

	it('executes Resend API calls when RESEND_API_KEY is provided', async () => {
		process.env.RESEND_API_KEY = 're_test_123456789';
		process.env.RESEND_FROM_EMAIL = 'Quire <hello@quire.live>';

		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ id: 'email_resend_001' })
		});
		vi.stubGlobal('fetch', fetchMock);

		const result = await sendPayoutAccountChangeConfirmationEmail({
			to: 'band@example.com',
			artistName: 'The <Neon> Velvet',
			confirmationUrl: 'https://quire.live/dashboard/settings?confirmPayoutToken=tok',
			newStripeAccountId: 'acct_1RealConnect123'
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toEqual({ id: 'email_resend_001', mode: 'resend' });
		expect(fetchMock).toHaveBeenCalledTimes(1);

		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe('https://api.resend.com/emails');
		const body = JSON.parse(String(init.body));
		expect(body.from).toBe('Quire <hello@quire.live>');
		expect(body.to).toEqual(['band@example.com']);
		expect(body.html).toContain('The &lt;Neon&gt; Velvet');
		expect(body.html).toContain('acct_1RealConnect123');
	});

	it('rejects malformed email inputs with Zod validation errors', async () => {
		const result = await sendPasswordResetEmail({
			to: 'not-an-email',
			artistName: 'Artist',
			resetUrl: 'https://quire.live/reset'
		});

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe('INVALID_EMAIL_INPUT');
	});
});

describe('Stripe Connect & Webhook Infrastructure', () => {
	it('verifies cryptographic Stripe webhook signatures and rejects forged payloads', () => {
		const secret = 'whsec_test_quire_secret_12345';
		const payload = JSON.stringify({
			id: 'evt_test_1',
			object: 'event',
			type: 'account.updated',
			data: { object: { id: 'acct_123', payouts_enabled: true } }
		});

		const validHeader = Stripe.webhooks.generateTestHeaderString({
			payload,
			secret
		});

		const validResult = verifyStripeWebhookEvent(payload, validHeader, secret);
		expect(validResult.ok).toBe(true);
		if (validResult.ok) {
			expect(validResult.value.id).toBe('evt_test_1');
			expect(validResult.value.type).toBe('account.updated');
		}

		const invalidResult = verifyStripeWebhookEvent(payload, 't=123,v1=forged', secret);
		expect(invalidResult.ok).toBe(false);
		if (!invalidResult.ok) {
			expect(invalidResult.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
		}
	});

	it('enforces $2.00 min and $500.00 max USD tip invariants at payment adapter boundary', async () => {
		process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';

		const belowMin = await createTipPaymentIntent({
			stripeAccountId: 'acct_123',
			artistId: 'artist_1',
			amountGrossCents: 199,
			fanCoveredFees: false
		});
		expect(belowMin.ok).toBe(false);

		const aboveMax = await createTipCheckoutSession({
			stripeAccountId: 'acct_123',
			artistId: 'artist_1',
			artistName: 'The Neon Velvet',
			amountGrossCents: 50001,
			fanCoveredFees: true,
			successUrl: 'https://quire.live/success',
			cancelUrl: 'https://quire.live/cancel'
		});
		expect(aboveMax.ok).toBe(false);
	});

	it('handles Stripe webhook events idempotently via POST /api/webhooks/stripe', async () => {
		await seedDatabase();
		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.slug, 'the-neon-velvet')
		});
		expect(artist).toBeDefined();
		if (!artist) return;

		const secret = 'whsec_test_quire_endpoint_12345';
		process.env.STRIPE_WEBHOOK_SECRET = secret;

		const paymentIntentId = `pi_test_${crypto.randomUUID()}`;
		const eventPayload = JSON.stringify({
			id: `evt_${crypto.randomUUID()}`,
			object: 'event',
			type: 'payment_intent.succeeded',
			data: {
				object: {
					id: paymentIntentId,
					amount: 1059,
					currency: 'usd',
					metadata: {
						artistId: artist.id,
						issueId: 'general',
						amountGrossCents: '1000',
						fanCoveredFees: 'true'
					}
				}
			}
		});

		const signature = Stripe.webhooks.generateTestHeaderString({
			payload: eventPayload,
			secret
		});

		const res1 = await stripeWebhookPOST({
			request: new Request('http://localhost/api/webhooks/stripe', {
				method: 'POST',
				headers: { 'stripe-signature': signature },
				body: eventPayload
			})
		} as Parameters<typeof stripeWebhookPOST>[0]);

		expect(res1.status).toBe(200);
		const json1 = await res1.json();
		expect(json1.received).toBe(true);
		expect(json1.action).toBe('tip_recorded');

		// Replay same webhook to verify idempotency
		const res2 = await stripeWebhookPOST({
			request: new Request('http://localhost/api/webhooks/stripe', {
				method: 'POST',
				headers: { 'stripe-signature': signature },
				body: eventPayload
			})
		} as Parameters<typeof stripeWebhookPOST>[0]);

		expect(res2.status).toBe(200);
		const json2 = await res2.json();
		expect(json2.action).toBe('tip_already_recorded');

		const savedTip = await db.query.tips.findFirst({
			where: eq(schema.tips.stripePaymentId, paymentIntentId)
		});
		expect(savedTip).toBeDefined();
		expect(savedTip?.amountGross).toBe(1000);
		expect(savedTip?.feePlatform).toBe(50);
		expect(savedTip?.amountNet).toBe(950);
		expect(savedTip?.status).toBe('succeeded');

		// Simulate refund webhook absorbing refunded amount and marking status refunded
		const refundEvent = {
			id: `evt_${crypto.randomUUID()}`,
			object: 'event',
			type: 'charge.refunded',
			data: {
				object: {
					id: `ch_${crypto.randomUUID()}`,
					amount: 1059,
					amount_refunded: 1000,
					currency: 'usd',
					refunded: true,
					payment_intent: paymentIntentId
				}
			}
		} as unknown as Stripe.Event;

		const refundRes = await handleStripeWebhookEvent(refundEvent);
		expect(refundRes.ok).toBe(true);

		const refundedTip = await db.query.tips.findFirst({
			where: eq(schema.tips.stripePaymentId, paymentIntentId)
		});
		expect(refundedTip?.amountNet).toBe(-50);
		expect(refundedTip?.status).toBe('refunded');
		expect(refundedTip?.refundedAt).toBeInstanceOf(Date);

		// Clean up test tip
		await db.delete(schema.tips).where(eq(schema.tips.stripePaymentId, paymentIntentId));
	});

	it('enforces SPEC 6.4 password re-entry and single-use email confirmation for payout changes', async () => {
		await seedDatabase();
		delete process.env.RESEND_API_KEY;
		const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

		const uniqueEmail = `band-${crypto.randomUUID()}@example.com`;
		const userId = crypto.randomUUID();
		const artistId = crypto.randomUUID();
		const now = new Date();
		const hashedPassword = await hashPassword('shared-band-secret-99');

		await db.insert(schema.users).values({
			id: userId,
			name: 'Test Band',
			email: uniqueEmail,
			emailVerified: true,
			accountType: 'artist',
			createdAt: now,
			updatedAt: now
		});

		await db.insert(schema.accounts).values({
			id: crypto.randomUUID(),
			userId,
			accountId: userId,
			providerId: 'credential',
			password: hashedPassword,
			createdAt: now,
			updatedAt: now
		});

		await db.insert(schema.artists).values({
			id: artistId,
			userId,
			slug: `test-band-${crypto.randomUUID().slice(0, 6)}`,
			displayName: 'Test Band',
			payoutsEnabled: false,
			stripeAccountId: 'acct_old_123',
			createdAt: now,
			updatedAt: now
		});

		const badPasswordResult = await requestPayoutAccountChange({
			artistId,
			userId,
			email: uniqueEmail,
			password: 'wrong-password',
			newStripeAccountId: 'acct_new_456',
			origin: 'http://localhost:5173'
		});
		expect(badPasswordResult.ok).toBe(false);
		if (!badPasswordResult.ok) {
			expect(badPasswordResult.error.code).toBe('INVALID_PASSWORD');
		}

		const okRequest = await requestPayoutAccountChange({
			artistId,
			userId,
			email: uniqueEmail,
			password: 'shared-band-secret-99',
			action: 'replace',
			newStripeAccountId: 'acct_new_456',
			origin: 'http://localhost:5173'
		});
		expect(okRequest.ok).toBe(true);

		const logLine = infoSpy.mock.calls.flat().join('\n');
		const match = logLine.match(/confirmPayoutToken=([^\s&]+)/);
		expect(match).not.toBeNull();
		const token = decodeURIComponent(match![1]);

		const badConfirm = await confirmPayoutAccountChange(`${token}tampered`);
		expect(badConfirm.ok).toBe(false);

		const goodConfirm = await confirmPayoutAccountChange(token);
		expect(goodConfirm.ok).toBe(true);

		// Single-use token cannot be replayed
		const replayConfirm = await confirmPayoutAccountChange(token);
		expect(replayConfirm.ok).toBe(false);
		if (!replayConfirm.ok) {
			expect(replayConfirm.error.code).toBe('TOKEN_ALREADY_USED');
		}

		const updatedArtist = await db.query.artists.findFirst({
			where: eq(schema.artists.id, artistId)
		});
		expect(updatedArtist?.stripeAccountId).toBe('acct_new_456');

		// Cleanup
		await db.delete(schema.payoutChangeTokens).where(eq(schema.payoutChangeTokens.artistId, artistId));
		await db.delete(schema.artists).where(eq(schema.artists.id, artistId));
		await db.delete(schema.users).where(eq(schema.users.id, userId));
	});

	it('creates a local tip checkout record when STRIPE_SECRET_KEY is unset and payoutsEnabled is true', async () => {
		await seedDatabase();
		delete process.env.STRIPE_SECRET_KEY;

		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.slug, 'the-neon-velvet')
		});
		expect(artist).toBeDefined();
		if (!artist) return;

		const result = await createTipCheckout({
			artistId: artist.id,
			amountGrossCents: 500,
			fanCoveredFees: false,
			returnUrl: 'http://localhost:5173/a/the-neon-velvet'
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.mode).toBe('mock');
		if (result.value.mode === 'mock') {
			await db.delete(schema.tips).where(eq(schema.tips.id, result.value.tipId));
		}
	});
});
