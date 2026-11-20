/**
 * Direct Venmo tips (ADR 0008). Pure helpers: no I/O, safe on server and client.
 *
 * Quire never touches the money. A tip button opens Venmo with the amount and
 * note filled in, and the Fan confirms the payment inside Venmo.
 */
import { type Brand, type DomainError, type Result, err, ok } from './types';
import { MAX_TIP_CENTS, MIN_TIP_CENTS } from './tipping';

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

/** Whole dollars, or dollars with one or two decimal places: "20", "12.5", "12.50", ".5". */
const TIP_DOLLARS_PATTERN = /^(\d*)(?:\.(\d{1,2}))?$/;

/**
 * A custom tip amount as the Fan typed it, in whole cents, or null when there is
 * no usable amount. Never throws.
 *
 * It takes what a `type="number"` input binds (a number, or null when the field
 * is empty or not a number), or a string. The decimal is read digit by digit,
 * never through floating-point arithmetic, so 12.5 is exactly 1250 cents.
 * Amounts with more than two decimal places (12.345) are rejected rather than
 * rounded, matching the tip-tap schema's whole-cents rule. The amount must be
 * from $2 to $500 (MIN_TIP_CENTS to MAX_TIP_CENTS).
 */
export function parseTipDollars(raw: unknown): number | null {
	let text: string;
	if (typeof raw === 'number') {
		if (!Number.isFinite(raw) || raw < 0) return null;
		// String(12.5) is "12.5"; tiny or huge numbers become "1e-7" / "1e+21" and fail the pattern.
		text = String(raw);
	} else if (typeof raw === 'string') {
		text = raw.trim();
	} else {
		return null;
	}

	const match = TIP_DOLLARS_PATTERN.exec(text);
	if (!match) return null;
	const [, whole = '', fraction = ''] = match;
	if (whole === '' && fraction === '') return null;
	if (whole.length > 6) return null;

	const cents = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0'));
	return cents >= MIN_TIP_CENTS && cents <= MAX_TIP_CENTS ? cents : null;
}
