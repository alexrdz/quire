// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Auth } from '$lib/server/auth';
import type { PublicFeatures } from '$lib/server/config';

type BetterAuthSession = Auth['$Infer']['Session'];

declare global {
	namespace App {
		interface Locals {
			session: BetterAuthSession['session'] | null;
			user: BetterAuthSession['user'] | null;
			features: PublicFeatures;
			/** Netlify's x-nf-request-id, or a random UUID. Logged with every server error. */
			requestId?: string;
		}
		interface Error {
			message: string;
			/** Present on unexpected errors: matches the id in the server log. */
			id?: string;
		}
	}
}

export {};
