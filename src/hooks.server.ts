import { building } from '$app/environment';
import type { Handle, HandleServerError, RequestEvent } from '@sveltejs/kit';
import { getConfig, getPublicFeatures } from '$lib/server/config';
import { unavailableResponse } from '$lib/server/http/unavailable';
import { withSecurityHeaders } from '$lib/server/http/security-headers';
import { GENERIC_ERROR_MESSAGE, logServerError, requestIdFor } from '$lib/server/http/errors';
import { featureUnavailableMessage } from '$lib/features';

const startupConfig = getConfig();

if (!building && !startupConfig.core.ok) {
	console.error(
		`[config] Core configuration invalid in ${startupConfig.mode} mode. Missing or invalid: ${startupConfig.core.issues.join(', ')}. Serving 503 for every request.`
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

/** Reports health on its own: no auto-seed, no session lookup, no 503 page (PRODUCTION_PLAN 3.6). */
const HEALTH_PATH = '/healthz';

let seedPromise: Promise<unknown> | null = null;

async function ensureSeed(): Promise<void> {
	if (building || !getConfig().autoSeed) return;
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

const routeRequest: Handle = async ({ event, resolve }) => {
	event.locals.session = null;
	event.locals.user = null;
	event.locals.features = getPublicFeatures();

	if (building) {
		return resolve(event);
	}

	if (event.url.pathname === HEALTH_PATH) {
		return resolve(event);
	}

	const config = getConfig();

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

function logFor(event: RequestEvent, error: unknown, status: number) {
	return logServerError({
		error,
		id: event.locals.requestId ?? requestIdFor(event.request),
		status,
		method: event.request.method,
		pathname: event.url.pathname
	});
}

/**
 * Every response leaves through here, so the early returns above (/api/auth,
 * the 503 page, the email-off JSON) get the security headers too (PRODUCTION_PLAN 3.4).
 */
export const handle: Handle = async (input) => {
	input.event.locals.requestId = requestIdFor(input.event.request);
	const { mode, mediaOrigin } = getConfig();

	let response: Response;
	try {
		response = await routeRequest(input);
	} catch (error) {
		// A crash in the hook itself (not in a load, which SvelteKit hands to handleError).
		const body = logFor(input.event, error, 500);
		response = Response.json(
			{ message: GENERIC_ERROR_MESSAGE, id: body.id },
			{ status: 500, headers: { 'cache-control': 'no-store' } }
		);
	}
	return withSecurityHeaders(response, { mode, mediaOrigin, pathname: input.event.url.pathname });
};

/** Unexpected errors: logged with the request id; the client sees only a generic message and the id. */
export const handleError: HandleServerError = ({ error, event, status }) => {
	return logFor(event, error, status);
};
