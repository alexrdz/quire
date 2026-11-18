/**
 * Rate limiting in Turso (PRODUCTION_PLAN 2.3).
 *
 * Fixed window per `action + subject`, counted with one atomic
 * `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, so concurrent requests can
 * never all read the same stale count. Subjects (IPs, emails, device ids, user
 * ids) are stored only as an HMAC, never raw.
 *
 * Every limit lives in `RATE_LIMITS`. The Better Auth `/api/auth` rules are
 * derived from the same object in `betterAuthRateLimitRules()`.
 *
 * Client IPs always come from SvelteKit's `event.getClientAddress()`; on Netlify
 * the adapter resolves it from the platform's client-IP header.
 */
import crypto from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { lt, sql } from 'drizzle-orm';
import { getConfig } from '../config';
import { db, schema } from '../db';

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export interface RateLimitRule {
	/** Requests allowed per window. Request `max + 1` is refused. */
	max: number;
	windowSeconds: number;
	/** Plain message shown in the UI when the limit is hit. */
	message: string;
}

/** Every limit Quire enforces, in one place. */
export const RATE_LIMITS = {
	/** Tips: per device (signed cookie) and, independently, per IP so crowds on venue Wi-Fi still get through. */
	tipDevice: {
		max: 10,
		windowSeconds: HOUR,
		message: 'You have sent a lot of tips from this device in the last hour. Please try again later.'
	},
	tipIp: {
		max: 100,
		windowSeconds: HOUR,
		message: 'Too many tips from this network in the last hour. Please try again later.'
	},
	/** Handle petitions (login `petitionSlug`). */
	petitionIp: {
		max: 3,
		windowSeconds: DAY,
		message: 'Too many handle petitions from this network today. Please try again tomorrow.'
	},
	petitionEmail: {
		max: 1,
		windowSeconds: DAY,
		message: 'This email has already sent a handle petition today. Please try again tomorrow.'
	},
	wallNoteIp: {
		max: 5,
		windowSeconds: 10 * MINUTE,
		message: 'You are posting notes too quickly. Please wait a few minutes and try again.'
	},
	flagIp: {
		max: 20,
		windowSeconds: HOUR,
		message: 'Too many flags from this network in the last hour. Please try again later.'
	},
	scanIp: {
		max: 60,
		windowSeconds: MINUTE,
		message: 'Too many scans from this network. Please wait a minute and scan again.'
	},
	/** Artist email confirmation resend (2.4): per signed-in user. */
	verificationResendUser: {
		max: 3,
		windowSeconds: HOUR,
		message: 'We have sent a few confirmation emails already. Check your inbox, or try again in an hour.'
	},
	/**
	 * Sign-in, sign-up and password reset through Quire's own form actions. These
	 * call Better Auth's server API directly, which bypasses its HTTP rate limiter,
	 * so they are limited here with the same numbers as `/api/auth`.
	 */
	signInIp: {
		max: 10,
		windowSeconds: 10 * MINUTE,
		message: 'Too many sign-in attempts. Please wait a few minutes and try again.'
	},
	signUpIp: {
		max: 5,
		windowSeconds: HOUR,
		message: 'Too many new accounts from this network. Please try again later.'
	},
	passwordResetIp: {
		max: 5,
		windowSeconds: HOUR,
		message: 'Too many password reset requests. Please try again later.'
	}
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitAction = keyof typeof RATE_LIMITS;

/**
 * Better Auth `rateLimit.customRules` for its own `/api/auth` endpoints, taken
 * from `RATE_LIMITS` so the HTTP API and the form actions share one limit.
 */
export function betterAuthRateLimitRules(): Record<string, { window: number; max: number }> {
	const rule = (action: RateLimitAction) => ({
		window: RATE_LIMITS[action].windowSeconds,
		max: RATE_LIMITS[action].max
	});
	return {
		'/sign-in/*': rule('signInIp'),
		'/sign-up/*': rule('signUpIp'),
		'/request-password-reset': rule('passwordResetIp'),
		'/forget-password': rule('passwordResetIp'),
		'/reset-password': rule('passwordResetIp'),
		'/reset-password/*': rule('passwordResetIp'),
		'/send-verification-email': rule('verificationResendUser')
	};
}

export type RateLimitDecision =
	| { allowed: true; count: number; remaining: number }
	| { allowed: false; count: number; retryAfterSeconds: number; message: string };

/** HMAC of the subject, so the table never holds raw IPs or emails. */
function subjectKey(action: RateLimitAction, subject: string): string {
	const digest = crypto
		.createHmac('sha256', getConfig().core.cookieSecret)
		.update(`${action}\u0000${subject.trim().toLowerCase()}`)
		.digest('base64url');
	return `${action}:${digest}`;
}

let callsSincePrune = 0;
const PRUNE_EVERY = 200;

async function pruneExpired(nowMs: number): Promise<void> {
	callsSincePrune = 0;
	await db.delete(schema.rateLimits).where(lt(schema.rateLimits.expiresAt, nowMs));
}

/**
 * Counts one request for `action` by `subject` and says whether it is allowed.
 * `now` is injectable for tests (fake clock).
 *
 * If the database is unreachable the request is allowed and the error logged:
 * a fan at a gig should not lose the page because the limiter failed.
 */
export async function consumeRateLimit(
	action: RateLimitAction,
	subject: string,
	now: Date = new Date()
): Promise<RateLimitDecision> {
	const rule = RATE_LIMITS[action];
	const windowMs = rule.windowSeconds * 1000;
	const nowMs = now.getTime();
	const windowStart = Math.floor(nowMs / windowMs) * windowMs;
	const expiresAt = windowStart + windowMs;
	const key = subjectKey(action, subject);

	let row: { count: number; expiresAt: number } | undefined;
	try {
		// One statement: insert the first hit, or bump the counter, restarting it when the stored window has ended.
		const expired = sql`${schema.rateLimits.expiresAt} <= ${nowMs}`;
		[row] = await db
			.insert(schema.rateLimits)
			.values({ key, count: 1, windowStart, expiresAt })
			.onConflictDoUpdate({
				target: schema.rateLimits.key,
				set: {
					count: sql`CASE WHEN ${expired} THEN 1 ELSE ${schema.rateLimits.count} + 1 END`,
					windowStart: sql`CASE WHEN ${expired} THEN ${windowStart} ELSE ${schema.rateLimits.windowStart} END`,
					expiresAt: sql`CASE WHEN ${expired} THEN ${expiresAt} ELSE ${schema.rateLimits.expiresAt} END`
				}
			})
			.returning({ count: schema.rateLimits.count, expiresAt: schema.rateLimits.expiresAt });

		if (++callsSincePrune >= PRUNE_EVERY) {
			await pruneExpired(nowMs).catch(() => undefined);
		}
	} catch (error) {
		console.error(`[rate-limit] ${action} check failed; allowing the request.`, error);
		return { allowed: true, count: 0, remaining: rule.max };
	}

	const count = Number(row?.count ?? 1);
	if (count > rule.max) {
		const resetAt = Number(row?.expiresAt ?? expiresAt);
		return {
			allowed: false,
			count,
			retryAfterSeconds: Math.max(1, Math.ceil((resetAt - nowMs) / 1000)),
			message: rule.message
		};
	}
	return { allowed: true, count, remaining: rule.max - count };
}

/**
 * Counts every check (so each limit is independent) and returns the first refusal, if any.
 */
export async function consumeRateLimits(
	checks: ReadonlyArray<readonly [RateLimitAction, string]>,
	now: Date = new Date()
): Promise<RateLimitDecision> {
	let firstDenied: RateLimitDecision | null = null;
	let last: RateLimitDecision = { allowed: true, count: 0, remaining: Infinity };
	for (const [action, subject] of checks) {
		const decision = await consumeRateLimit(action, subject, now);
		if (!decision.allowed && !firstDenied) firstDenied = decision;
		last = decision;
	}
	return firstDenied ?? last;
}

/* ------------------------------------------------------------------------- */
/* Tip device cookie                                                          */
/* ------------------------------------------------------------------------- */

export const TIP_DEVICE_COOKIE = 'quire_tip_device';
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

function signDeviceId(deviceId: string): string {
	return crypto
		.createHmac('sha256', getConfig().core.cookieSecret)
		.update(`tip-device\u0000${deviceId}`)
		.digest('base64url');
}

/** Returns the device id if the cookie value carries a valid signature. */
export function verifyTipDeviceCookie(value: string | undefined): string | null {
	if (!value) return null;
	const dot = value.lastIndexOf('.');
	if (dot <= 0) return null;
	const deviceId = value.slice(0, dot);
	const signature = value.slice(dot + 1);
	if (!DEVICE_ID_PATTERN.test(deviceId)) return null;
	const expected = Buffer.from(signDeviceId(deviceId));
	const given = Buffer.from(signature);
	if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
	return deviceId;
}

/**
 * The tipping device id from its signed cookie, minting a new one when it is
 * missing or tampered with. Clearing cookies gets a fresh device id, which is why
 * tips are also limited per IP.
 */
export function getOrCreateTipDeviceId(cookies: Cookies): string {
	const existing = verifyTipDeviceCookie(cookies.get(TIP_DEVICE_COOKIE));
	if (existing) return existing;
	const deviceId = crypto.randomBytes(18).toString('base64url');
	cookies.set(TIP_DEVICE_COOKIE, `${deviceId}.${signDeviceId(deviceId)}`, {
		path: '/',
		httpOnly: true,
		secure: getConfig().isDeployed,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 365
	});
	return deviceId;
}

/** Clears every counter. Tests only. */
export async function resetRateLimitsForTests(): Promise<void> {
	await db.delete(schema.rateLimits);
}
