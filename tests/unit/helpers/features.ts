import type { PublicFeatures } from '$lib/features';

/** Every feature available, as in development. */
export const ALL_FEATURES_ON: PublicFeatures = {
	mode: 'test',
	payments: true,
	email: true,
	fanSignIn: true,
	uploads: true
};

export function featuresWith(overrides: Partial<PublicFeatures>): PublicFeatures {
	return { ...ALL_FEATURES_ON, ...overrides };
}
