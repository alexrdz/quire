import type { LayoutServerLoad } from './$types';
import { getConfig } from '$lib/server/config';
import { demoSignupUrl } from '$lib/components/site/demo-banner';

/** Feature flags for every page (ADR 0007, tier 2). Never includes secrets. */
export const load: LayoutServerLoad = async ({ locals }) => {
	// The Demo banner's link to the real site's sign-up (PUBLIC_PRODUCTION_URL).
	// Absent when unset or outside the Demo, so the banner shows no link.
	const signupUrl = locals.features?.mode === 'demo' ? demoSignupUrl(getConfig().productionUrl) : null;
	return {
		features: locals.features,
		...(signupUrl ? { demoSignupUrl: signupUrl } : {})
	};
};
