/**
 * Venmo username setup and change (ADR 0008, PRODUCTION_PLAN V.3).
 *
 * - First set: needs a confirmed band email, nothing else.
 * - Change or remove: needs the band password again plus a single-use, hashed,
 *   one-hour link sent to the account email. The old username keeps receiving
 *   tips until the link is confirmed. Loading the confirmation page only inspects
 *   the token; `confirmVenmoChange` (a POST) consumes it.
 * - A notice email follows every applied change.
 *
 * Raw tokens and links are never logged here. In development and test the email
 * module's console fallback prints the email body; in production it never does.
 */
import crypto from 'node:crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { parseVenmoUsername } from '$domain/venmo';
import { type DomainError, type Result, err, ok } from '$domain/types';
import { featureUnavailableMessage } from '$lib/features';
import { venmoChangeTokenSchema } from '$lib/schemas/venmo';
import { verifyUserCredentialPassword } from '../auth';
import { getConfig } from '../config';
import { db, schema } from '../db';
import { sendVenmoChangeConfirmationEmail, sendVenmoChangedNoticeEmail } from '../email';
import { EMAIL_CONFIRMATION_REQUIRED, isEmailConfirmed } from '../email/verification';
import { consumeRateLimit } from './rate-limit';

export const VENMO_CHANGE_TOKEN_TTL_MS = 60 * 60 * 1000;
export const VENMO_CONFIRM_PATH = '/dashboard/settings/confirm-venmo';

export interface VenmoArtist {
	id: string;
	displayName: string;
	venmoUsername: string | null;
}

export interface VenmoUser {
	id: string;
	email: string;
	emailVerified?: boolean | null;
}

/**
 * The emailed confirmation link. Always built from the configured app URL
 * (BETTER_AUTH_URL / PUBLIC_APP_URL, or the local default in development and
 * test), never from the request: a forged Host header from someone who knows
 * the band password would otherwise point the owner's email at their domain.
 */
export function buildVenmoConfirmUrl(rawToken: string): string {
	const appUrl = getConfig().core.appUrl.replace(/\/$/, '');
	return `${appUrl}${VENMO_CONFIRM_PATH}?token=${rawToken}`;
}

function hashToken(rawToken: string): string {
	return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/** Usernames compare without case: Venmo treats @Band and @band as the same profile. */
function sameUsername(a: string | null, b: string | null): boolean {
	return (a ?? '').toLowerCase() === (b ?? '').toLowerCase();
}

/** Sets the Venmo username for an Artist who has none yet. */
export async function setFirstVenmoUsername(input: {
	artist: VenmoArtist;
	user: VenmoUser;
	rawUsername: string;
}): Promise<Result<{ venmoUsername: string }, DomainError>> {
	if (input.artist.venmoUsername) {
		return err({
			code: 'VENMO_ALREADY_SET',
			message: 'You already have a Venmo username. Changing it needs your password and an email confirmation.'
		});
	}
	if (!isEmailConfirmed(input.user)) {
		return err({ code: 'EMAIL_NOT_CONFIRMED', message: EMAIL_CONFIRMATION_REQUIRED.venmo });
	}

	const parsed = parseVenmoUsername(input.rawUsername);
	if (!parsed.ok) return parsed;

	// Only when still unset, so a concurrent first set cannot overwrite a username without confirmation.
	const updated = await db
		.update(schema.artists)
		.set({ venmoUsername: parsed.value, updatedAt: new Date() })
		.where(and(eq(schema.artists.id, input.artist.id), isNull(schema.artists.venmoUsername)))
		.returning({ id: schema.artists.id });

	if (updated.length === 0) {
		return err({
			code: 'VENMO_ALREADY_SET',
			message: 'You already have a Venmo username. Changing it needs your password and an email confirmation.'
		});
	}
	return ok({ venmoUsername: parsed.value });
}

/**
 * Starts a change (`rawUsername` set) or removal (`rawUsername` null) of an
 * existing username: checks the password, stores a hashed token and emails the link.
 */
export async function requestVenmoChange(input: {
	artist: VenmoArtist;
	user: VenmoUser;
	rawUsername: string | null;
	password: string;
	now?: Date;
}): Promise<
	Result<
		{ newUsername: string | null; expiresAt: Date; sentTo: string; emailMode: string },
		DomainError
	>
> {
	const { artist, user } = input;
	const now = input.now ?? new Date();
	const { features, mode } = getConfig();

	if (!features.email) {
		return err({ code: 'EMAIL_UNAVAILABLE', message: featureUnavailableMessage('email', mode) });
	}
	if (!artist.venmoUsername) {
		return err({
			code: 'NO_VENMO_USERNAME',
			message: 'There is no Venmo username to change yet. Add one first.'
		});
	}

	let newUsername: string | null = null;
	if (input.rawUsername !== null) {
		const parsed = parseVenmoUsername(input.rawUsername);
		if (!parsed.ok) return parsed;
		newUsername = parsed.value;
		if (sameUsername(newUsername, artist.venmoUsername)) {
			return err({
				code: 'VENMO_UNCHANGED',
				message: `Tips already go to @${artist.venmoUsername}.`
			});
		}
	}

	// Counted before the password check, so the limit also slows password guessing.
	const limit = await consumeRateLimit('venmoChange', artist.id, now);
	if (!limit.allowed) {
		return err({ code: 'RATE_LIMITED', message: limit.message });
	}

	const passwordValid = await verifyUserCredentialPassword(user.id, input.password);
	if (!passwordValid) {
		return err({
			code: 'INVALID_PASSWORD',
			message: 'Incorrect password. Re-enter your band password to change the Venmo username.'
		});
	}

	const rawToken = crypto.randomBytes(32).toString('hex');
	const tokenId = crypto.randomUUID();
	const expiresAt = new Date(now.getTime() + VENMO_CHANGE_TOKEN_TTL_MS);

	// A new request replaces any earlier unconfirmed one.
	await db
		.delete(schema.venmoChangeTokens)
		.where(
			and(eq(schema.venmoChangeTokens.artistId, artist.id), isNull(schema.venmoChangeTokens.usedAt))
		);
	await db.insert(schema.venmoChangeTokens).values({
		id: tokenId,
		artistId: artist.id,
		newUsername,
		tokenHash: hashToken(rawToken),
		expiresAt,
		usedAt: null,
		createdAt: now
	});

	const confirmationUrl = buildVenmoConfirmUrl(rawToken);
	const sent = await sendVenmoChangeConfirmationEmail({
		to: user.email,
		artistName: artist.displayName,
		oldUsername: artist.venmoUsername,
		newUsername,
		confirmationUrl
	});

	if (!sent.ok) {
		await db.delete(schema.venmoChangeTokens).where(eq(schema.venmoChangeTokens.id, tokenId));
		return err({ code: sent.error.code, message: sent.error.message });
	}

	return ok({ newUsername, expiresAt, sentTo: user.email, emailMode: sent.value.mode });
}

export interface PendingVenmoChange {
	tokenId: string;
	oldUsername: string | null;
	newUsername: string | null;
	expiresAt: Date;
}

const INVALID_LINK: DomainError = {
	code: 'INVALID_TOKEN',
	message: 'This confirmation link is not valid. Request a new one from Settings.'
};

/**
 * Checks a confirmation link without using it up. Safe for the GET page load:
 * link scanners and previews that open the link change nothing.
 */
export async function inspectVenmoChange(input: {
	rawToken: string | null;
	artist: VenmoArtist;
	now?: Date;
}): Promise<Result<PendingVenmoChange, DomainError>> {
	const parsed = venmoChangeTokenSchema.safeParse({ token: input.rawToken ?? '' });
	if (!parsed.success) return err(INVALID_LINK);

	const record = await db.query.venmoChangeTokens.findFirst({
		where: eq(schema.venmoChangeTokens.tokenHash, hashToken(parsed.data.token))
	});
	if (!record) return err(INVALID_LINK);

	if (record.artistId !== input.artist.id) {
		return err({
			code: 'WRONG_ACCOUNT',
			message: 'This confirmation link belongs to a different artist account.'
		});
	}
	if (record.usedAt) {
		return err({
			code: 'TOKEN_USED',
			message: 'This confirmation link has already been used. Request a new one from Settings if you still need a change.'
		});
	}
	const now = input.now ?? new Date();
	if (record.expiresAt.getTime() <= now.getTime()) {
		return err({
			code: 'TOKEN_EXPIRED',
			message: 'This confirmation link has expired. Links work for 1 hour. Request a new one from Settings.'
		});
	}

	return ok({
		tokenId: record.id,
		oldUsername: input.artist.venmoUsername,
		newUsername: record.newUsername,
		expiresAt: record.expiresAt
	});
}

/** Consumes the link (POST only) and applies the change, then emails a notice. */
export async function confirmVenmoChange(input: {
	rawToken: string | null;
	artist: VenmoArtist;
	user: VenmoUser;
	now?: Date;
}): Promise<
	Result<{ oldUsername: string | null; newUsername: string | null; noticeSent: boolean }, DomainError>
> {
	const now = input.now ?? new Date();
	const pending = await inspectVenmoChange({ rawToken: input.rawToken, artist: input.artist, now });
	if (!pending.ok) return pending;

	// Single use even under a double submit: only one request can flip used_at.
	const claimed = await db
		.update(schema.venmoChangeTokens)
		.set({ usedAt: now })
		.where(
			and(
				eq(schema.venmoChangeTokens.id, pending.value.tokenId),
				isNull(schema.venmoChangeTokens.usedAt),
				gt(schema.venmoChangeTokens.expiresAt, now)
			)
		)
		.returning({ id: schema.venmoChangeTokens.id });
	if (claimed.length === 0) {
		return err({
			code: 'TOKEN_USED',
			message: 'This confirmation link has already been used. Request a new one from Settings if you still need a change.'
		});
	}

	await db
		.update(schema.artists)
		.set({ venmoUsername: pending.value.newUsername, updatedAt: now })
		.where(eq(schema.artists.id, input.artist.id));

	const notice = await sendVenmoChangedNoticeEmail({
		to: input.user.email,
		artistName: input.artist.displayName,
		newUsername: pending.value.newUsername
	});
	if (!notice.ok) {
		// The change stands; only the code is logged, never the address or a link.
		console.error(`[venmo] change applied but the notice email failed: ${notice.error.code}`);
	}

	return ok({
		oldUsername: pending.value.oldUsername,
		newUsername: pending.value.newUsername,
		noticeSent: notice.ok
	});
}

/** The newest unconfirmed, unexpired change for the settings page, if any. */
export async function getPendingVenmoChange(
	artistId: string,
	now: Date = new Date()
): Promise<{ newUsername: string | null; expiresAt: Date } | null> {
	const record = await db.query.venmoChangeTokens.findFirst({
		where: and(
			eq(schema.venmoChangeTokens.artistId, artistId),
			isNull(schema.venmoChangeTokens.usedAt),
			gt(schema.venmoChangeTokens.expiresAt, now)
		),
		orderBy: [desc(schema.venmoChangeTokens.createdAt)]
	});
	return record ? { newUsername: record.newUsername, expiresAt: record.expiresAt } : null;
}

/** Re-exported for the settings page: what the first-set gate tells the Artist. */
export { EMAIL_CONFIRMATION_REQUIRED };
