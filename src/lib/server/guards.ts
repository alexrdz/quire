/**
 * Auth guards (PRODUCTION_PLAN 4.3).
 *
 * `hooks.server.ts` resolves the Better Auth session once per request into
 * `event.locals.session` and `event.locals.user`. Routes never call
 * `auth.api.getSession` themselves; they call one of these guards, which read
 * locals only.
 *
 * KEY TRAP: a `+layout.server.ts` guard protects nothing on its own.
 * - SvelteKit does not run layout loads for form actions, so an action behind
 *   a guarded layout is still reachable with a plain POST.
 * - Layout and page loads run in parallel, so a page load can finish (and read
 *   data) before the layout's redirect wins.
 * So the /dashboard layout guard is defense in depth only. Every dashboard page
 * load must call `requireArtist` and every Artist action `requireArtistAction`.
 * `tests/unit/routes/auth-guards.test.ts` enumerates the exported actions to
 * enforce this.
 */
import { fail, isActionFailure, redirect, type ActionFailure, type RequestEvent } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { ArtistAccountStatus } from '$domain/account';
import { resolveSafeRedirect } from '$schemas/auth';
import { db, schema } from '$lib/server/db';

/** What the guards need from an event: locals, plus the URL for the login redirect. */
export type GuardEvent = Pick<RequestEvent, 'locals' | 'url'>;

export type SessionUser = NonNullable<App.Locals['user']>;
export type AuthSession = NonNullable<App.Locals['session']>;
export type ArtistRow = typeof schema.artists.$inferSelect;

export interface SignedIn {
	user: SessionUser;
	session: AuthSession;
}

export interface ArtistContext extends SignedIn {
	artist: ArtistRow;
}

/** Shown when an action needs a signed-in user and there is none. */
export const SIGNED_OUT_MESSAGE = 'Unauthorized';
/** Shown when a signed-in user has no Artist, or the Artist account is closed. */
export const ARTIST_REQUIRED_MESSAGE = 'Active artist account required.';

/** The signed-in user and session, or null. Never redirects. */
export function optionalUser(event: GuardEvent): SignedIn | null {
	const { user, session } = event.locals;
	return user && session ? { user, session } : null;
}

/**
 * `/login?redirect=<this page>`, using the Phase 2 safe-redirect rules. Slashes
 * are left readable; everything else (query strings included) is encoded.
 */
export function loginRedirect(url: URL, fallback = '/dashboard'): string {
	const back = resolveSafeRedirect(`${url.pathname}${url.search}`, fallback);
	return `/login?redirect=${encodeURIComponent(back).replace(/%2F/g, '/')}`;
}

async function findArtist(userId: string): Promise<ArtistRow | undefined> {
	return db.query.artists.findFirst({ where: eq(schema.artists.userId, userId) });
}

/**
 * For page loads. Signed out: redirect to /login with this page as the safe
 * redirect. Signed in without an Artist: /login. Closed Artist: /login?closed=1.
 */
export async function requireArtist(event: GuardEvent): Promise<ArtistContext> {
	const signedIn = optionalUser(event);
	if (!signedIn) throw redirect(303, loginRedirect(event.url));

	const artist = await findArtist(signedIn.user.id);
	if (!artist) throw redirect(303, '/login');
	if (artist.accountStatus === ArtistAccountStatus.Closed) throw redirect(303, '/login?closed=1');

	return { ...signedIn, artist };
}

/** A guard's failure: one message under the page's error field, e.g. `{ error }`. */
export type Failure<K extends string = 'error'> = ActionFailure<{ [P in K]: string }>;

/** Narrows a guard result: true means return it from the action as is. */
export function isDenied<T extends object, F extends ActionFailure<object>>(result: T | F): result is F {
	return isActionFailure(result);
}

/**
 * For Artist form actions: the Artist context, or a failure to return as is.
 * 401 when signed out, 403 for a signed-in user without an active Artist.
 * `errorKey` is the form field the page shows errors under (default `error`).
 *
 *   const guard = await requireArtistAction(event);
 *   if (isDenied(guard)) return guard;
 */
export async function requireArtistAction<K extends string = 'error'>(
	event: GuardEvent,
	errorKey: K = 'error' as K
): Promise<ArtistContext | Failure<K>> {
	const failure = (status: 401 | 403, message: string) =>
		fail(status, { [errorKey]: message } as { [P in K]: string });

	const signedIn = optionalUser(event);
	if (!signedIn) return failure(401, SIGNED_OUT_MESSAGE);

	const artist = await findArtist(signedIn.user.id);
	if (!artist || artist.accountStatus === ArtistAccountStatus.Closed) {
		return failure(403, ARTIST_REQUIRED_MESSAGE);
	}
	return { ...signedIn, artist };
}

/**
 * For Fan actions (sign a Wall, flag, claim a Stamp, save an Issue): the
 * signed-in user, or a 401 failure carrying the page's sign-in prompt.
 * Any signed-in account may act as a Fan, as today; Artists can sign Walls too.
 */
export function requireFan(event: GuardEvent, message: string): SignedIn | Failure {
	return optionalUser(event) ?? fail(401, { error: message });
}

/**
 * For Fan page loads (e.g. /me/stubs): the signed-in user, or a redirect to
 * /login with this page as the safe redirect.
 */
export function requireFanPage(event: GuardEvent, fallback = '/me/stubs'): SignedIn {
	const signedIn = optionalUser(event);
	if (!signedIn) throw redirect(303, loginRedirect(event.url, fallback));
	return signedIn;
}

/**
 * What a page may know about the signed-in user (P4L-T05). Loads return this,
 * never the session record or the full user row: page data is serialized into
 * the HTML and `__data.json`, and the session token there would undo the
 * HttpOnly cookie that keeps it from scripts.
 */
export interface Viewer {
	id: string;
	name: string;
	image: string | null;
	accountType: SessionUser['accountType'];
}

export function toViewer(user: SessionUser): Viewer {
	return { id: user.id, name: user.name, image: user.image ?? null, accountType: user.accountType };
}

/** The signed-in user as a Viewer, or null. For public page loads. */
export function optionalViewer(event: GuardEvent): Viewer | null {
	const signedIn = optionalUser(event);
	return signedIn ? toViewer(signedIn.user) : null;
}
