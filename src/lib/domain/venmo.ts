/**
 * Direct Venmo tips (ADR 0008). Pure helpers: no I/O, safe on server and client.
 *
 * Quire never touches the money. A tip button opens Venmo with the amount and
 * note filled in, and the Fan confirms the payment inside Venmo.
 */
import { type Brand, type DomainError, type Result, err, ok } from './types';

export type VenmoUsername = Brand<string, 'VenmoUsername'>;

export const VENMO_USERNAME_MIN = 5;
export const VENMO_USERNAME_MAX = 30;
const VENMO_USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/;

const VENMO_BASE_URL = 'https://venmo.com';

/**
 * Normalises what an Artist types: trims, strips one leading @, then requires
 * 5-30 characters of letters, digits, hyphens or underscores.
 */
export function parseVenmoUsername(raw: string): Result<VenmoUsername, DomainError> {
	const trimmed = (raw ?? '').trim();
	const username = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;

	if (username.length === 0) {
		return err({ code: 'VENMO_USERNAME_REQUIRED', message: 'Enter your Venmo username.' });
	}
	if (username.length < VENMO_USERNAME_MIN || username.length > VENMO_USERNAME_MAX) {
		return err({
			code: 'VENMO_USERNAME_LENGTH',
			message: `Venmo usernames are ${VENMO_USERNAME_MIN} to ${VENMO_USERNAME_MAX} characters.`
		});
	}
	if (!VENMO_USERNAME_PATTERN.test(username)) {
		return err({
			code: 'VENMO_USERNAME_CHARACTERS',
			message: 'Venmo usernames use only letters, numbers, hyphens and underscores.'
		});
	}
	return ok(username as VenmoUsername);
}

/** Formats whole cents as Venmo's decimal amount, e.g. 500 becomes "5.00". */
export function formatVenmoAmount(amountCents: number): string {
	if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
		throw new RangeError('amountCents must be a positive whole number of cents.');
	}
	const dollars = Math.floor(amountCents / 100);
	const cents = String(amountCents % 100).padStart(2, '0');
	return `${dollars}.${cents}`;
}

/**
 * The Artist's public Venmo profile, used by "Test your link".
 * `/u/<username>` is Venmo's canonical public profile path (checked 2026-11-18).
 */
export function buildVenmoProfileUrl(username: VenmoUsername): string {
	return `${VENMO_BASE_URL}/u/${encodeURIComponent(username)}`;
}

/**
 * A Venmo pay link with the amount and note filled in:
 * `https://venmo.com/<username>?txn=pay&amount=<d.dd>&note=<urlencoded>`.
 * Checked 2026-11-18: venmo.com redirects this to account.venmo.com with the
 * query kept, where the Fan confirms the payment.
 */
export function buildVenmoPayUrl(input: {
	username: VenmoUsername;
	amountCents: number;
	note: string;
}): string {
	const amount = formatVenmoAmount(input.amountCents);
	const note = encodeURIComponent(input.note);
	return `${VENMO_BASE_URL}/${encodeURIComponent(input.username)}?txn=pay&amount=${amount}&note=${note}`;
}

/** Longest Artist name kept in a note, so the note stays short in Venmo's feed. */
const NOTE_NAME_MAX = 80;

/**
 * The Venmo note for a tip. It names only the Artist: never the venue, city or
 * date, because Venmo payments can be public and the note would reveal where the Fan was.
 */
export function tipNote(artistName: string): string {
	const name = (artistName ?? '').replace(/\s+/g, ' ').trim().slice(0, NOTE_NAME_MAX).trim();
	return `Tip for ${name || 'the artist'} via Quire`;
}
