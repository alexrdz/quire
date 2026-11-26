/**
 * Finish what the Fan started after Google sign-in (SPEC.md §5.5, B1-T37).
 *
 * A signed-out Fan who taps Post on a Wall note, or Claim Stamp, is sent to Google
 * sign-in. Before the redirect, `googleAuth` sets a resume token for that Issue: a
 * short-lived, HMAC-signed, httpOnly cookie naming the action. On return the reader
 * sees the intent (`readResumeIntent`) and submits the Fan's form once, through the
 * normal action, which spends the token first (`consumeResumeIntent`) and then runs
 * every usual rule. Spending it deletes the cookie and claims its nonce in the
 * database, so a refresh, Back or a replayed request never acts twice. The note's
 * text itself stays in the browser's sessionStorage, as SPEC says.
 */
import crypto from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { getConfig } from '../config';
import { claimOnceWithin, RATE_LIMITS } from './rate-limit';

export type ResumeAction = 'note' | 'stamp';

/** How long a sign-in has to come back and finish the action. */
export const RESUME_TTL_SECONDS = RATE_LIMITS.resumeIntent.windowSeconds;

export const resumeCookieName = (slug: string) => `quire_resume_${slug}`;

const cookiePath = (slug: string) => `/i/${slug}`;

interface ResumePayload {
	action: ResumeAction;
	slug: string;
	/** Expiry, epoch milliseconds. */
	exp: number;
	nonce: string;
}

export function isResumeAction(value: unknown): value is ResumeAction {
	return value === 'note' || value === 'stamp';
}

function sign(body: string): string {
	// A purpose prefix, so this signature can never stand in for another cookie's.
	return crypto.createHmac('sha256', getConfig().core.cookieSecret).update(`resume-intent:${body}`).digest('base64url');
}

export function signResumeToken(action: ResumeAction, slug: string, now: Date = new Date()): string {
	const payload: ResumePayload = {
		action,
		slug,
		exp: now.getTime() + RESUME_TTL_SECONDS * 1000,
		nonce: crypto.randomBytes(16).toString('base64url')
	};
	const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
	return `${body}.${sign(body)}`;
}

/** The token's payload if it is well formed, correctly signed, for `slug` and not expired. */
export function verifyResumeToken(token: string | undefined, slug: string, now: Date = new Date()): ResumePayload | null {
	if (!token) return null;
	const [body, signature, extra] = token.split('.');
	if (!body || !signature || extra !== undefined) return null;
	const expected = sign(body);
	if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
		return null;
	}
	try {
		const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<ResumePayload>;
		if (!isResumeAction(payload.action) || payload.slug !== slug) return null;
		if (typeof payload.exp !== 'number' || payload.exp <= now.getTime()) return null;
		if (typeof payload.nonce !== 'string' || payload.nonce.length < 16) return null;
		return payload as ResumePayload;
	} catch {
		return null;
	}
}

/** Sets the resume token for `action` on this Issue, replacing any earlier one. */
export function setResumeIntent(cookies: Cookies, slug: string, action: ResumeAction, now: Date = new Date()): void {
	cookies.set(resumeCookieName(slug), signResumeToken(action, slug, now), {
		path: cookiePath(slug),
		httpOnly: true,
		secure: getConfig().isDeployed,
		// Lax, so the cookie comes back on the top-level redirect from Google.
		sameSite: 'lax',
		maxAge: RESUME_TTL_SECONDS
	});
}

export function clearResumeIntent(cookies: Cookies, slug: string): void {
	cookies.delete(resumeCookieName(slug), { path: cookiePath(slug) });
}

/** The action waiting on this Issue, if a valid token is there. Read-only: nothing is spent. */
export function readResumeIntent(cookies: Cookies, slug: string, now: Date = new Date()): ResumeAction | null {
	return verifyResumeToken(cookies.get(resumeCookieName(slug)), slug, now)?.action ?? null;
}

/**
 * Spends the resume token for `action` on this Issue. True only the first time a
 * valid token is spent; the cookie is deleted either way. Called before the action
 * does anything else, so a refused action has still used its one go.
 */
export async function consumeResumeIntent(
	cookies: Cookies,
	slug: string,
	action: ResumeAction,
	now: Date = new Date()
): Promise<boolean> {
	const payload = verifyResumeToken(cookies.get(resumeCookieName(slug)), slug, now);
	clearResumeIntent(cookies, slug);
	if (!payload || payload.action !== action) return false;
	return claimOnceWithin('resumeIntent', payload.nonce, now, { failClosed: true });
}
