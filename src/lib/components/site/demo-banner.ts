/** Copy for the Demo banner (CONTEXT decision 29). Never claims anything is real. */
export const DEMO_BANNER_LEAD = "You're in the Demo.";
export const DEMO_BANNER_TEXT =
	'Nothing here is real: tips never open Venmo and nothing carries over to a real account.';
export const DEMO_BANNER_COMPACT = "Demo: this QR and its tips aren't real.";
export const DEMO_SIGNUP_LABEL = 'Sign up on the real Quire';

/**
 * The real site's sign-up page, from PUBLIC_PRODUCTION_URL's origin. Null when it
 * is unset, so the banner shows no link.
 */
export function demoSignupUrl(productionOrigin: string | null): string | null {
	return productionOrigin ? `${productionOrigin}/login?mode=signup` : null;
}
