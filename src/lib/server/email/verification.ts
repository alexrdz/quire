/**
 * Artist email confirmation gate (PRODUCTION_PLAN 2.4, decision 31).
 *
 * Artists can sign in and build straight away (`requireEmailVerification: false`),
 * but publishing an Issue, uploading media and connecting payouts wait until the
 * band email is confirmed, because that email controls resets and payout changes.
 * Every check is server-side, in the form actions.
 */
import { getConfig } from '../config';
import { featureUnavailableMessage } from '$lib/features';
import { consumeRateLimit } from '../services/rate-limit';

export const EMAIL_CONFIRMATION_REQUIRED = {
	publish: 'Confirm your email to publish. Check your inbox for the confirmation link, or resend it from the bar at the top of the dashboard.',
	upload: 'Confirm your email to upload media. You can still paste an image URL or embed in the meantime.',
	payouts: 'Confirm your email before connecting payouts. Check your inbox for the confirmation link, or resend it from the bar at the top of the dashboard.'
} as const;

export type GatedArtistAction = keyof typeof EMAIL_CONFIRMATION_REQUIRED;

export function isEmailConfirmed(user: { emailVerified?: boolean | null } | null | undefined): boolean {
	return user?.emailVerified === true;
}

/** True when the submitted form carries at least one non-empty file. */
export function formHasFileUpload(formData: FormData): boolean {
	for (const value of formData.values()) {
		if (value instanceof File && value.size > 0) return true;
	}
	return false;
}

export interface EmailConfirmationStatus {
	email: string;
	confirmed: boolean;
	/** False when email is switched off (tier 2), so the resend control is disabled. */
	canResend: boolean;
	/** Why resend is off, when it is. */
	unavailableMessage: string | null;
}

export function getEmailConfirmationStatus(user: {
	email: string;
	emailVerified?: boolean | null;
}): EmailConfirmationStatus {
	const { features, mode } = getConfig();
	return {
		email: user.email,
		confirmed: isEmailConfirmed(user),
		canResend: features.email,
		unavailableMessage: features.email ? null : featureUnavailableMessage('email', mode)
	};
}

export type ResendConfirmationResult =
	| { ok: true; alreadyConfirmed: boolean }
	| { ok: false; status: 429 | 500 | 503; message: string };

/**
 * Resends the confirmation email for a signed-in artist, rate-limited per user
 * (`RATE_LIMITS.verificationResendUser`).
 */
export async function resendEmailConfirmation(input: {
	user: { id: string; email: string; emailVerified?: boolean | null };
	headers: Headers;
	callbackURL: string;
	send: (args: { body: { email: string; callbackURL: string }; headers: Headers }) => Promise<unknown>;
	now?: Date;
}): Promise<ResendConfirmationResult> {
	const { features, mode } = getConfig();
	if (!features.email) {
		return { ok: false, status: 503, message: featureUnavailableMessage('email', mode) };
	}
	if (isEmailConfirmed(input.user)) {
		return { ok: true, alreadyConfirmed: true };
	}

	const limit = await consumeRateLimit('verificationResendUser', input.user.id, input.now);
	if (!limit.allowed) {
		return { ok: false, status: 429, message: limit.message };
	}

	try {
		await input.send({
			body: { email: input.user.email, callbackURL: input.callbackURL },
			headers: input.headers
		});
	} catch (error) {
		return {
			ok: false,
			status: 500,
			message: error instanceof Error ? error.message : 'Unable to send the confirmation email right now.'
		};
	}
	return { ok: true, alreadyConfirmed: false };
}
