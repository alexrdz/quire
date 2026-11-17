import { building } from '$app/environment';
import type { Handle } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { seedDatabase } from '$lib/server/seed';

let seedPromise: Promise<unknown> | null = null;

function ensureDevSeed(): Promise<unknown> | null {
	if (building) return null;
	if (process.env.NODE_ENV === 'production' || process.env.DISABLE_AUTO_SEED === 'true') {
		return null;
	}
	if (!seedPromise) {
		seedPromise = seedDatabase().catch((err) => {
			console.error('Database seed warning:', err);
			seedPromise = null;
		});
	}
	return seedPromise;
}

export const handle: Handle = async ({ event, resolve }) => {
	const pendingSeed = ensureDevSeed();
	if (pendingSeed) {
		await pendingSeed;
	}

	if (building) {
		event.locals.session = null;
		event.locals.user = null;
		return resolve(event);
	}

	if (event.url.pathname.startsWith('/api/auth')) {
		return auth.handler(event.request);
	}

	try {
		const sessionData = await auth.api.getSession({
			headers: event.request.headers
		});
		event.locals.session = sessionData?.session ?? null;
		event.locals.user = sessionData?.user ?? null;
	} catch {
		event.locals.session = null;
		event.locals.user = null;
	}

	return resolve(event);
};
