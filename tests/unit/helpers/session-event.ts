import { getPublicFeatures } from '$lib/server/config';
import { resolveSessionLocals } from '../../../src/hooks.server';

/**
 * Route handlers read the session from `event.locals`, which `hooks.server.ts`
 * fills in on a real request (PRODUCTION_PLAN 4.3). Tests that call loads and
 * actions directly build that event here, by running the hook's own session
 * resolution on the request's cookie, so no test hand-forges `locals.user`.
 */
type AnyEvent = Record<string, any> & { request?: Request; url?: URL; locals?: Partial<App.Locals> };

export async function withSession<E extends AnyEvent>(event: E): Promise<E & { request: Request; url: URL; locals: App.Locals }> {
	const request = event.request ?? new Request('http://localhost:5173/');
	const url = event.url ?? new URL(request.url);
	const locals = {
		features: getPublicFeatures(),
		...(await resolveSessionLocals(request)),
		// A test may still set extra locals on purpose (e.g. a stub user for a pure check).
		...(event.locals ?? {})
	} as App.Locals;
	return { ...event, request, url, locals };
}

type Handler = (event: any) => any;

/** Wraps a module's `actions` so every call gets locals from its request's session cookie. */
export function withSessionActions<T extends Record<string, Handler>>(actions: T): T {
	return Object.fromEntries(
		Object.entries(actions).map(([name, action]) => [name, async (event: AnyEvent) => action(await withSession(event))])
	) as T;
}

/** Wraps a `load` the same way. */
export function withSessionLoad<T extends Handler>(load: T): T {
	return (async (event: AnyEvent) => load(await withSession(event))) as T;
}

/** A route module with its `load` and `actions` wrapped; other exports pass through. */
export function withSessionModule<M extends Record<string, any>>(mod: M): M {
	return {
		...mod,
		...(typeof mod.load === 'function' ? { load: withSessionLoad(mod.load) } : {}),
		...(mod.actions ? { actions: withSessionActions(mod.actions) } : {})
	} as M;
}
