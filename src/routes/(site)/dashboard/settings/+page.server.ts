import { getConfig, tipsOpenVenmo } from '$lib/server/config';
import { featureUnavailableMessage } from '$lib/features';
import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { ArtistAccountStatus } from '$domain/account';
import { buildVenmoProfileUrl, parseVenmoUsername } from '$domain/venmo';
import { db, schema } from '$lib/server/db';
import { auth, clearSessionCookie, verifyUserCredentialPassword } from '$lib/server/auth';
import { isEmailConfirmed, resendEmailConfirmation } from '$lib/server/email/verification';
import { closeArtistAccount } from '$lib/server/services/account';
import {
	EMAIL_CONFIRMATION_REQUIRED,
	getPendingVenmoChange,
	requestVenmoChange,
	setFirstVenmoUsername
} from '$lib/server/services/venmo';
import {
	changeBandEmailSchema,
	changePasswordSchema,
	closeArtistAccountSchema
} from '$schemas/auth';
import { artistSettingsUpdateSchema } from '$lib/schemas/payouts';
import { venmoChangeRequestSchema, venmoRemoveRequestSchema, venmoSetupSchema } from '$lib/schemas/venmo';

/** Status codes for Venmo service errors. */
const VENMO_ERROR_STATUS: Record<string, number> = {
	EMAIL_NOT_CONFIRMED: 403,
	INVALID_PASSWORD: 403,
	EMAIL_UNAVAILABLE: 503,
	RATE_LIMITED: 429
};

async function loadActiveArtist(request: Request) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) return null;
	const artist = await db.query.artists.findFirst({
		where: eq(schema.artists.userId, session.user.id)
	});
	if (!artist || artist.accountStatus === ArtistAccountStatus.Closed) return null;
	return { user: session.user, artist };
}

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

	const verifiedReturn = url.searchParams.get('verified') === '1';
	const emailChangedReturn = url.searchParams.get('emailChanged') === '1';
	const venmoChangedReturn = url.searchParams.get('venmo');
	const { features, mode } = getConfig();

	const parsedVenmo = artist.venmoUsername ? parseVenmoUsername(artist.venmoUsername) : null;
	const pendingVenmo = await getPendingVenmoChange(artist.id);

	const credentialAccount = await db.query.accounts.findFirst({
		where: and(
			eq(schema.accounts.userId, session.user.id),
			eq(schema.accounts.providerId, 'credential')
		)
	});

	return {
		artist,
		userEmail: session.user.email,
		emailVerified: Boolean(session.user.emailVerified),
		verifiedReturn,
		emailChangedReturn,
		hasCredentialPassword: Boolean(credentialAccount?.password),
		venmo: {
			username: artist.venmoUsername,
			profileUrl: parsedVenmo?.ok ? buildVenmoProfileUrl(parsedVenmo.value) : null,
			/** "Test your link" opens Venmo only in production; sample usernames may be real people. */
			testLinkOpens: tipsOpenVenmo(mode),
			canChange: features.email,
			changeBlockedMessage: features.email ? null : featureUnavailableMessage('email', mode),
			firstSetBlockedMessage: isEmailConfirmed(session.user) ? null : EMAIL_CONFIRMATION_REQUIRED.venmo,
			pending: pendingVenmo
				? { newUsername: pendingVenmo.newUsername, expiresAt: pendingVenmo.expiresAt.toISOString() }
				: null,
			changedReturn:
				venmoChangedReturn === 'changed' || venmoChangedReturn === 'removed' ? venmoChangedReturn : null
		}
	};
};

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

	/**
	 * One field plus Save (ADR 0008). With no username yet this sets it (confirmed
	 * email required). With one set, it starts a change: password plus email link.
	 */
	saveVenmo: async ({ request, url }) => {
		const active = await loadActiveArtist(request);
		if (!active) return fail(401, { venmoError: 'Unauthorized' });
		const { user, artist } = active;

		const formData = await request.formData();
		const rawUsername = String(formData.get('venmoUsername') ?? '');

		if (!artist.venmoUsername) {
			const parsed = venmoSetupSchema.safeParse({ venmoUsername: rawUsername });
			if (!parsed.success) {
				return fail(400, { venmoError: parsed.error.issues[0]?.message, venmoValue: rawUsername });
			}
			const result = await setFirstVenmoUsername({ artist, user, rawUsername });
			if (!result.ok) {
				return fail(VENMO_ERROR_STATUS[result.error.code] ?? 400, {
					venmoError: result.error.message,
					venmoValue: rawUsername
				});
			}
			return { venmoSaved: true, venmoUsername: result.value.venmoUsername };
		}

		const parsed = venmoChangeRequestSchema.safeParse({
			venmoUsername: rawUsername,
			confirmPassword: String(formData.get('confirmPassword') ?? '')
		});
		if (!parsed.success) {
			return fail(400, { venmoError: parsed.error.issues[0]?.message, venmoValue: rawUsername });
		}
		const result = await requestVenmoChange({
			artist,
			user,
			rawUsername: parsed.data.venmoUsername,
			password: parsed.data.confirmPassword,
			origin: url.origin
		});
		if (!result.ok) {
			return fail(VENMO_ERROR_STATUS[result.error.code] ?? 400, {
				venmoError: result.error.message,
				venmoValue: rawUsername
			});
		}
		return {
			venmoChangeRequested: true,
			pendingUsername: result.value.newUsername,
			sentToEmail: result.value.sentTo,
			emailMode: result.value.emailMode
		};
	},

	/** Removing the username is a change too: password plus email link. */
	removeVenmo: async ({ request, url }) => {
		const active = await loadActiveArtist(request);
		if (!active) return fail(401, { venmoError: 'Unauthorized' });
		const { user, artist } = active;

		const formData = await request.formData();
		const parsed = venmoRemoveRequestSchema.safeParse({
			confirmPassword: String(formData.get('confirmPassword') ?? '')
		});
		if (!parsed.success) {
			return fail(400, { venmoError: parsed.error.issues[0]?.message });
		}
		const result = await requestVenmoChange({
			artist,
			user,
			rawUsername: null,
			password: parsed.data.confirmPassword,
			origin: url.origin
		});
		if (!result.ok) {
			return fail(VENMO_ERROR_STATUS[result.error.code] ?? 400, { venmoError: result.error.message });
		}
		return {
			venmoChangeRequested: true,
			pendingUsername: null,
			sentToEmail: result.value.sentTo,
			emailMode: result.value.emailMode
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
