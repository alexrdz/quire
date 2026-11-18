/**
 * Labels for Tip Taps (ADR 0008). Safe in the browser.
 *
 * A Tip Tap is a tap on a tip button, not a payment. It is always labelled as
 * a tap and never shown with a dollar sign.
 */
export const CHECK_VENMO = 'Check Venmo for what came in.';

/** "1 tip tap" / "14 tip taps". */
export function formatTipTaps(taps: number): string {
	return `${taps} tip ${taps === 1 ? 'tap' : 'taps'}`;
}

/** "In the Demo, this would open Venmo to pay $5 to @username." */
export function demoVenmoMessage(amountCents: number, username: string): string {
	const dollars = amountCents % 100 === 0 ? String(amountCents / 100) : (amountCents / 100).toFixed(2);
	return `In the Demo, this would open Venmo to pay $${dollars} to @${username}.`;
}
