import crypto from 'node:crypto';
import { getConfig } from '$lib/server/config';
import { FEATURE_UNAVAILABLE } from '$lib/features';
import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { and, desc, eq, gt } from 'drizzle-orm';
import { ArtistAccountStatus } from '$domain/account';
import { db, schema } from '$lib/server/db';
import { auth, clearSessionCookie, verifyUserCredentialPassword } from '$lib/server/auth';
import { sendPayoutAccountChangeConfirmationEmail } from '$lib/server/email';
import {
	EMAIL_CONFIRMATION_REQUIRED,
	isEmailConfirmed,
	resendEmailConfirmation
} from '$lib/server/email/verification';
import { closeArtistAccount } from '$lib/server/services/account';
import {
	inspectConnectedAccountStatus,
	isStripeConfigured,
	type StripeExpressAccountSummary
} from '$lib/server/payments/stripe';
import {
	changeBandEmailSchema,
	changePasswordSchema,
	closeArtistAccountSchema
} from '$schemas/auth';
import {
	artistSettingsUpdateSchema,
	payoutAccountChangeRequestSchema,
	type PayoutChangeAction
} from '$lib/schemas/payouts';

export const load: ServerLoad = async ({ request, url }) => {
	const session = await auth.api.getSession({
		headers: request.headers
	});

	if (!session?.user) {
		throw redirect(303, '/login?redirect=/dashboard/settings');
	}

	const artist = await db.query.artists.findFirst({
		where: eq(schema.artists.userId, session.user.id)
	});

	if (!artist) {
		throw redirect(303, '/login');
	}

	if (artist.accountStatus === ArtistAccountStatus.Closed) {
		throw redirect(303, '/login?closed=1');
	}

	const stripeParam = url.searchParams.get('stripe');
	const stripeReturnState =
		stripeParam === 'return' || stripeParam === 'refresh' ? stripeParam : null;
	const verifiedReturn = url.searchParams.get('verified') === '1';
	const emailChangedReturn = url.searchParams.get('emailChanged') === '1';
	const stripeConfigured = isStripeConfigured();
	const isSeededDemoAccount = Boolean(artist.stripeAccountId?.startsWith('acct_demo_'));

	let currentArtist = artist;
	let stripeStatus: StripeExpressAccountSummary | null = null;
	let stripeSyncError: string | null = null;

	if (currentArtist.stripeAccountId && !isSeededDemoAccount && stripeConfigured) {
		const statusResult = await inspectConnectedAccountStatus(currentArtist.stripeAccountId);
		if (statusResult.ok) {
			stripeStatus = statusResult.value;
			if (statusResult.value.payoutsEnabled !== Boolean(currentArtist.payoutsEnabled)) {
				const now = new Date();
				await db
					.update(schema.artists)
					.set({
						payoutsEnabled: statusResult.value.payoutsEnabled,
						updatedAt: now
					})
					.where(eq(schema.artists.id, currentArtist.id));

				currentArtist = {
					...currentArtist,
					payoutsEnabled: statusResult.value.payoutsEnabled,
					updatedAt: now
				};
			}
		} else {
			stripeSyncError = statusResult.error.message;
		}
	}

	const now = new Date();
	const pendingToken = await db.query.payoutChangeTokens.findFirst({
		where: and(
			eq(schema.payoutChangeTokens.artistId, currentArtist.id),
			eq(schema.payoutChangeTokens.status, 'pending'),
			gt(schema.payoutChangeTokens.expiresAt, now)
		),
		orderBy: [desc(schema.payoutChangeTokens.createdAt)]
	});

	const credentialAccount = await db.query.accounts.findFirst({
		where: and(
			eq(schema.accounts.userId, session.user.id),
			eq(schema.accounts.providerId, 'credential')
		)
	});

	return {
		artist: currentArtist,
		userEmail: session.user.email,
		emailVerified: Boolean(session.user.emailVerified),
		verifiedReturn,
		emailChangedReturn,
		stripeConfigured,
		stripeReturnState,
		stripeStatus,
		stripeSyncError,
		isSeededDemoAccount,
		hasCredentialPassword: Boolean(credentialAccount?.password),
		pendingPayoutChange: pendingToken
			? {
					action: pendingToken.action,
					expiresAt: pendingToken.expiresAt.toISOString()
				}
			: null
	};
};

function buildEmailTargetLabel(action: PayoutChangeAction, stripeAccountId: string | null): string {
	if (action === 'disconnect') {
		return 'Disconnect Stripe Payout Account';
	}
	if (action === 'replace') {
		return 'Stripe Connect Express (Replace Connected Account)';
	}
	const hasLiveAccount = Boolean(stripeAccountId) && !stripeAccountId!.startsWith('acct_demo_');
	return hasLiveAccount
		? 'Stripe Connect Express (Resume Onboarding)'
		: 'Stripe Connect Express (New Onboarding)';
}

export const actions: Actions = {
	updateModeration: async ({ request }) => {
		const session = await auth.api.getSession({
			headers: request.headers
		});
		if (!session?.user) {
			return fail(401, { moderationError: 'Unauthorized' });
		}

		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.userId, session.user.id)
		});
		if (!artist) {
			return fail(401, { moderationError: 'Artist not found' });
		}

		const formData = await request.formData();
		const parsed = artistSettingsUpdateSchema
			.pick({ generalWallApproveFirst: true })
			.safeParse({
				generalWallApproveFirst: formData.get('generalWallApproveFirst') === 'true'
			});

		if (!parsed.success) {
			return fail(400, {
				moderationError: parsed.error.issues[0]?.message || 'Invalid moderation settings.'
			});
		}

		await db
			.update(schema.artists)
			.set({
				generalWallApproveFirst: parsed.data.generalWallApproveFirst,
				updatedAt: new Date()
			})
			.where(eq(schema.artists.id, artist.id));

		return {
			moderationSaved: true,
			generalWallApproveFirst: parsed.data.generalWallApproveFirst
		};
	},

	requestPayoutChange: async ({ request, url }) => {
		const { features } = getConfig();
		if (!features.payments) {
			return fail(503, { payoutError: FEATURE_UNAVAILABLE.payments });
		}
		if (!features.email) {
			return fail(503, { payoutError: FEATURE_UNAVAILABLE.email });
		}

		const session = await auth.api.getSession({
			headers: request.headers
		});
		if (!session?.user) {
			return fail(401, { payoutError: 'Unauthorized' });
		}

		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.userId, session.user.id)
		});
		if (!artist) {
			return fail(401, { payoutError: 'Artist not found' });
		}

		const formData = await request.formData();
		const rawAction = String(formData.get('action') ?? 'connect').trim();
		const rawPassword = String(formData.get('confirmPassword') ?? '');

		const parsed = payoutAccountChangeRequestSchema.safeParse({
			confirmPassword: rawPassword,
			action: rawAction
		});

		if (!parsed.success) {
			return fail(400, {
				payoutError: parsed.error.issues[0]?.message || 'Invalid payout change request.',
				selectedAction: rawAction
			});
		}

		const { confirmPassword, action } = parsed.data;

		// Decision 31: no Stripe Connect onboarding until the band email is confirmed.
		if (action !== 'disconnect' && !isEmailConfirmed(session.user)) {
			return fail(403, {
				payoutError: EMAIL_CONFIRMATION_REQUIRED.payouts,
				selectedAction: action
			});
		}

		if (action === 'disconnect' && !artist.stripeAccountId && !artist.payoutsEnabled) {
			return fail(400, {
				payoutError: 'No Stripe payout account is currently connected.',
				selectedAction: action
			});
		}

		const passwordValid = await verifyUserCredentialPassword(session.user.id, confirmPassword);
		if (!passwordValid) {
			return fail(403, {
				payoutError:
					'Incorrect password. Please re-enter your shared band password to modify payout settings.',
				selectedAction: action
			});
		}

		const now = new Date();
		const expiresAt = new Date(now.getTime() + 1000 * 60 * 60); // 1 hour
		const rawToken = crypto.randomBytes(32).toString('hex');
		const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
		const tokenId = crypto.randomUUID();

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
			id: tokenId,
			artistId: artist.id,
			userId: session.user.id,
			tokenHash,
			action,
			targetStripeAccountId: null,
			status: 'pending',
			expiresAt,
			createdAt: now
		});

		const origin = url.origin.replace(/\/$/, '');
		const confirmationUrl = `${origin}/dashboard/settings/confirm-payout?token=${encodeURIComponent(rawToken)}`;

		const emailResult = await sendPayoutAccountChangeConfirmationEmail({
			to: session.user.email,
			artistName: artist.displayName,
			confirmationUrl,
			newStripeAccountId: buildEmailTargetLabel(action, artist.stripeAccountId)
		});

		if (!emailResult.ok) {
			await db
				.update(schema.payoutChangeTokens)
				.set({ status: 'cancelled' })
				.where(eq(schema.payoutChangeTokens.id, tokenId));

			return fail(500, {
				payoutError: emailResult.error.message,
				selectedAction: action
			});
		}

		return {
			payoutConfirmationSent: true,
			payoutAction: action,
			emailMode: emailResult.value.mode,
			sentToEmail: session.user.email
		};
	},

	resendVerification: async ({ request }) => {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return fail(401, { accountError: 'Unauthorized' });
		}

		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.userId, session.user.id)
		});
		if (!artist || artist.accountStatus === ArtistAccountStatus.Closed) {
			return fail(403, { accountError: 'Active artist account required.' });
		}

		const result = await resendEmailConfirmation({
			user: session.user,
			headers: request.headers,
			callbackURL: '/dashboard/settings?verified=1',
			send: (args) => auth.api.sendVerificationEmail(args)
		});
		if (!result.ok) {
			return fail(result.status, { accountError: result.message });
		}
		if (result.alreadyConfirmed) {
			return { alreadyVerified: true };
		}

		return {
			verificationEmailSent: true,
			sentToEmail: session.user.email
		};
	},

	changeEmail: async ({ request }) => {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return fail(401, { emailError: 'Unauthorized' });
		}

		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.userId, session.user.id)
		});
		if (!artist || artist.accountStatus === ArtistAccountStatus.Closed) {
			return fail(403, { emailError: 'Active artist account required.' });
		}

		const formData = await request.formData();
		const newEmailRaw = String(formData.get('newEmail') || '');
		const currentPassword = String(formData.get('currentPassword') || '');

		const parsed = changeBandEmailSchema.safeParse({
			newEmail: newEmailRaw,
			currentPassword
		});

		if (!parsed.success) {
			return fail(400, {
				emailError: parsed.error.issues[0]?.message || 'Invalid email update request.'
			});
		}

		if (parsed.data.newEmail === session.user.email.toLowerCase()) {
			return fail(400, {
				emailError: 'New email matches your current band email.'
			});
		}

		const passwordValid = await verifyUserCredentialPassword(
			session.user.id,
			parsed.data.currentPassword
		);
		if (!passwordValid) {
			return fail(403, {
				emailError: 'Incorrect current password. Please re-enter your band password.'
			});
		}

		try {
			await auth.api.changeEmail({
				body: {
					newEmail: parsed.data.newEmail,
					callbackURL: '/dashboard/settings?emailChanged=1'
				},
				headers: request.headers
			});
		} catch (err: unknown) {
			const message =
				err instanceof Error ? err.message : 'Unable to initiate band email update.';
			return fail(400, { emailError: message });
		}

		return {
			emailChangeRequested: true,
			targetEmail: parsed.data.newEmail
		};
	},

	changePassword: async ({ request }) => {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return fail(401, { passwordError: 'Unauthorized' });
		}

		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.userId, session.user.id)
		});
		if (!artist || artist.accountStatus === ArtistAccountStatus.Closed) {
			return fail(403, { passwordError: 'Active artist account required.' });
		}

		const formData = await request.formData();
		const parsed = changePasswordSchema.safeParse({
			currentPassword: String(formData.get('currentPassword') || ''),
			newPassword: String(formData.get('newPassword') || ''),
			confirmNewPassword: String(formData.get('confirmNewPassword') || ''),
			revokeOtherSessions: formData.get('revokeOtherSessions') === 'true'
		});

		if (!parsed.success) {
			return fail(400, {
				passwordError: parsed.error.issues[0]?.message || 'Invalid password update request.'
			});
		}

		try {
			await auth.api.changePassword({
				body: {
					currentPassword: parsed.data.currentPassword,
					newPassword: parsed.data.newPassword,
					revokeOtherSessions: parsed.data.revokeOtherSessions
				},
				headers: request.headers
			});
		} catch (err: unknown) {
			const message =
				err instanceof Error ? err.message : 'Incorrect current password or invalid new password.';
			return fail(400, { passwordError: message });
		}

		return {
			passwordChanged: true
		};
	},

	closeAccount: async ({ request, cookies }) => {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return fail(401, { closeError: 'Unauthorized' });
		}

		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.userId, session.user.id)
		});
		if (!artist || artist.accountStatus === ArtistAccountStatus.Closed) {
			return fail(403, { closeError: 'Artist account not found or already closed.' });
		}

		const formData = await request.formData();
		const parsed = closeArtistAccountSchema.safeParse({
			confirmPassword: String(formData.get('confirmPassword') || ''),
			confirmPhrase: String(formData.get('confirmPhrase') || '').trim()
		});

		if (!parsed.success) {
			return fail(400, {
				closeError: parsed.error.issues[0]?.message || 'Please confirm password and type CLOSE.'
			});
		}

		const closeResult = await closeArtistAccount({
			artistId: artist.id,
			userId: session.user.id,
			confirmPassword: parsed.data.confirmPassword
		});

		if (!closeResult.ok) {
			const status = closeResult.error.code === 'INVALID_PASSWORD' ? 403 : 400;
			return fail(status, { closeError: closeResult.error.message });
		}

		await clearSessionCookie(cookies);
		throw redirect(303, '/login?closed=1');
	}
};
