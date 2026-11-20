/**
 * Server error logging (PRODUCTION_PLAN 3.6). Every unexpected error is logged
 * with a request id, and the client gets only a generic message and that id, so
 * support can find the log line without any internals reaching the browser.
 */
import crypto from 'node:crypto';

export const GENERIC_ERROR_MESSAGE = 'Something went wrong.';
export const NOT_FOUND_MESSAGE = 'Page not found.';

/** Netlify's id for the request. Kept only when it looks like an id, so it can't inject log text. */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function requestIdFor(request: Request): string {
	const fromNetlify = request.headers.get('x-nf-request-id')?.trim();
	return fromNetlify && REQUEST_ID_PATTERN.test(fromNetlify) ? fromNetlify : crypto.randomUUID();
}

export interface LoggedError {
	message: string;
	id: string;
}

/**
 * Logs the error and returns what the client may see. Only the path is logged,
 * never the query string, which can carry tokens (scan keys, confirmation links).
 */
export function logServerError(input: {
	error: unknown;
	id: string;
	status: number;
	method: string;
	pathname: string;
}): LoggedError {
	const where = `${input.method} ${input.pathname}`;
	if (input.status === 404) {
		// Unknown routes are routine (bots, old links): one line, no stack.
		console.warn(`[error] id=${input.id} status=404 ${where}`);
		return { message: NOT_FOUND_MESSAGE, id: input.id };
	}
	console.error(`[error] id=${input.id} status=${input.status} ${where}`, input.error);
	return { message: GENERIC_ERROR_MESSAGE, id: input.id };
}
