import type { LayoutServerLoad } from './$types';

/** Feature flags for every page (ADR 0007, tier 2). Never includes secrets. */
export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		features: locals.features
	};
};
