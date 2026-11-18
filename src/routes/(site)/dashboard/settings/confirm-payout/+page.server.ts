import crypto from 'node:crypto';
import { redirect, type ServerLoad } from '@sveltejs/kit';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db, schema } from '$lib/server/db';
import { auth } from '$lib/server/auth';
import { payoutChangeConfirmationSchema } from '$lib/schemas/payouts';
import { resolveSafeRedirect } from '$schemas/auth';
import { EMAIL_CONFIRMATION_REQUIRED, isEmailConfirmed } from '$lib/server/email/verification';
import {
	createExpressConnectedAccount,
	createExpressOnboardingLink,
	isStripeConfigured
} from '$lib/server/payments/stripe';

export const load: ServerLoad = async ({ request, url }) => {
	const session = await auth.api.getSession({
		headers: request.headers
	});

	if (!session?.user) {
		const redirectTarget = resolveSafeRedirect(
			`/dashboard/settings/confirm-payout${url.search}`,
			'/dashboard/settings'
		);
		throw redirect(303, `/login?redirect=${encodeURIComponent(redirectTarget)}`);
	}

	const artist = await db.query.artists.findFirst({
		where: eq(schema.artists.userId, session.user.id)
	});

	if (!artist) {
		throw redirect(303, '/login');
	}

	const rawToken = url.searchParams.get('token') ?? '';
	const parsed = payoutChangeConfirmationSchema.safeParse({ token: rawToken });

	if (!parsed.success) {
		return {
			artist,
			status: 'error' as const,
			errorCode: 'INVALID_TOKEN',
			errorMessage:
				parsed.error.issues[0]?.message || 'Invalid or missing payout confirmation token.'
		};
	}

	const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');
	const record = await db.query.payoutChangeTokens.findFirst({
		where: eq(schema.payoutChangeTokens.tokenHash, tokenHash)
	});

	if (!record) {
		return {
			artist,
			status: 'error' as const,
			errorCode: 'INVALID_TOKEN',
			errorMessage: 'Payout confirmation link not found or invalid.'
		};
	}

	if (record.artistId !== artist.id || record.userId !== session.user.id) {
		return {
			artist,
			status: 'error' as const,
			errorCode: 'UNAUTHORIZED',
			errorMessage: 'This payout confirmation link belongs to a different artist account.'
		};
	}

	if (record.status !== 'pending' || record.confirmedAt !== null) {
		const statusLabel = record.status === 'confirmed' ? 'used' : record.status;
		return {
			artist,
			status: 'error' as const,
			errorCode: 'TOKEN_ALREADY_USED',
			errorMessage: `This payout confirmation link has already been ${statusLabel}. Please request a new confirmation email from Settings & Payouts.`
		};
	}

	// Decision 31: Stripe Connect onboarding waits for a confirmed email. Checked before the token is used up.
	if (record.action !== 'disconnect' && !isEmailConfirmed(session.user)) {
		return {
			artist,
			status: 'error' as const,
			errorCode: 'EMAIL_NOT_CONFIRMED',
			errorMessage: EMAIL_CONFIRMATION_REQUIRED.payouts
		};
	}

	const now = new Date();
	if (record.expiresAt.getTime() <= now.getTime()) {
		await db
			.update(schema.payoutChangeTokens)
			.set({ status: 'expired' })
			.where(
				and(
					eq(schema.payoutChangeTokens.id, record.id),
					eq(schema.payoutChangeTokens.status, 'pending')
				)
			);

		return {
			artist,
			status: 'error' as const,
			errorCode: 'TOKEN_EXPIRED',
			errorMessage:
				'This payout confirmation link has expired (links are valid for 1 hour). Please request a new one from Settings & Payouts.'
		};
	}

	// Atomically consume the single-use confirmation token
	const consumed = await db
		.update(schema.payoutChangeTokens)
		.set({
			status: 'confirmed',
			confirmedAt: now
		})
		.where(
			and(
				eq(schema.payoutChangeTokens.id, record.id),
				eq(schema.payoutChangeTokens.status, 'pending'),
				isNull(schema.payoutChangeTokens.confirmedAt),
				gt(schema.payoutChangeTokens.expiresAt, now)
			)
		)
		.returning();

	if (consumed.length === 0) {
		return {
			artist,
			status: 'error' as const,
			errorCode: 'TOKEN_ALREADY_USED',
			errorMessage: 'This payout confirmation link has already been used or has expired.'
		};
	}

	if (record.action === 'disconnect') {
		await db
			.update(schema.artists)
			.set({
				stripeAccountId: null,
				payoutsEnabled: false,
				updatedAt: now
			})
			.where(eq(schema.artists.id, artist.id));

		return {
			artist: {
				...artist,
				stripeAccountId: null,
				payoutsEnabled: false,
				updatedAt: now
			},
			status: 'disconnected' as const,
			errorCode: null,
			errorMessage: null
		};
	}

	if (!isStripeConfigured()) {
		return {
			artist,
			status: 'error' as const,
			errorCode: 'STRIPE_NOT_CONFIGURED',
			errorMessage: 'Stripe is not configured on this server (missing STRIPE_SECRET_KEY).'
		};
	}

	let targetAccountId = artist.stripeAccountId;
	const shouldCreateNewAccount =
		record.action === 'replace' ||
		!targetAccountId ||
		targetAccountId.startsWith('acct_demo_');

	if (shouldCreateNewAccount) {
		const created = await createExpressConnectedAccount({
			artistId: artist.id,
			email: session.user.email,
			displayName: artist.displayName
		});

		if (!created.ok) {
			return {
				artist,
				status: 'error' as const,
				errorCode: created.error.code,
				errorMessage: created.error.message
			};
		}

		targetAccountId = created.value.accountId;

		await db
			.update(schema.artists)
			.set({
				stripeAccountId: targetAccountId,
				payoutsEnabled: created.value.payoutsEnabled,
				updatedAt: new Date()
			})
			.where(eq(schema.artists.id, artist.id));
	}

	const origin = url.origin.replace(/\/$/, '');
	const linkResult = await createExpressOnboardingLink({
		accountId: targetAccountId!,
		returnUrl: `${origin}/dashboard/settings?stripe=return`,
		refreshUrl: `${origin}/dashboard/settings?stripe=refresh`,
		type: 'account_onboarding'
	});

	if (!linkResult.ok) {
		return {
			artist,
			status: 'error' as const,
			errorCode: linkResult.error.code,
			errorMessage: linkResult.error.message
		};
	}

	throw redirect(303, linkResult.value.url);
};
