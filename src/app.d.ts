// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Auth } from '$lib/server/auth';

type BetterAuthSession = Auth['$Infer']['Session'];

declare global {
	namespace App {
		interface Locals {
			session: BetterAuthSession['session'] | null;
			user: BetterAuthSession['user'] | null;
		}
	}
}

export {};
