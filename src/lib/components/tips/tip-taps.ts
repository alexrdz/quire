/**
 * Labels for Tip Taps (ADR 0008). Safe in the browser.
 *
 * A Tip Tap is a tap on a tip button, not a payment. It is always labelled as
 * a tap and never shown with a dollar sign.
 */
export const CHECK_VENMO = 'Check Venmo for what came in.';

/** Under the custom amount field while it is empty or valid. */
export const CUSTOM_HINT = 'Dollars and cents, for example 12.50.';
/** Under the custom amount field when what was typed is not a usable amount. */
export const CUSTOM_HINT_INVALID = 'Enter an amount from $2 to $500, with at most two decimal places.';

/** "1 tip tap" / "14 tip taps". */
export function formatTipTaps(taps: number): string {
	return `${taps} tip ${taps === 1 ? 'tap' : 'taps'}`;
}

/** "In the Demo, this would open Venmo to pay $5 to @username." */
export function demoVenmoMessage(amountCents: number, username: string): string {
	const dollars = amountCents % 100 === 0 ? String(amountCents / 100) : (amountCents / 100).toFixed(2);
	return `In the Demo, this would open Venmo to pay $${dollars} to @${username}.`;
}
