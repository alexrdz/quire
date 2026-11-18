import { building } from '$app/environment';
import type { Handle } from '@sveltejs/kit';
import { getConfig, getPublicFeatures } from '$lib/server/config';
import { unavailableResponse } from '$lib/server/http/unavailable';
import { featureUnavailableMessage } from '$lib/features';

const config = getConfig();

if (!building && !config.core.ok) {
	console.error(
		`[config] Core configuration invalid in ${config.mode} mode. Missing or invalid: ${config.core.issues.join(', ')}. Serving 503 for every request.`
	);
}

/** Better Auth endpoints that send email; switched off with the email feature (tier 2). */
const EMAIL_AUTH_PATHS = [
	'/api/auth/sign-up/email',
	'/api/auth/request-password-reset',
	'/api/auth/forget-password',
	'/api/auth/send-verification-email',
	'/api/auth/change-email'
];

let seedPromise: Promise<unknown> | null = null;

async function ensureSeed(): Promise<void> {
	if (building || !config.autoSeed) return;
	if (!seedPromise) {
		seedPromise = import('$lib/server/seed')
			.then(({ seedDatabase }) => seedDatabase())
			.catch((err) => {
				console.error('Database seed warning:', err);
				seedPromise = null;
			});
	}
	await seedPromise;
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.session = null;
	event.locals.user = null;
	event.locals.features = getPublicFeatures();

	if (building) {
		return resolve(event);
	}

	// Tier 1: nothing that needs the database or auth may run without core config.
	if (!config.core.ok) {
		return unavailableResponse();
	}

	await ensureSeed();

	// Imported lazily so a broken core config never reaches auth or the database.
	const { auth } = await import('$lib/server/auth');

	if (event.url.pathname.startsWith('/api/auth')) {
		if (!config.features.email && EMAIL_AUTH_PATHS.includes(event.url.pathname)) {
			return Response.json(
				{ code: 'EMAIL_UNAVAILABLE', message: featureUnavailableMessage('email', config.mode) },
				{ status: 503 }
			);
		}
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
