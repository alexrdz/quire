import crypto from 'node:crypto';
import { withSessionModule } from '../helpers/session-event';
import { describe, expect, it } from 'vitest';
import {
	RATE_LIMITS,
	betterAuthRateLimitRules,
	consumeRateLimit,
	consumeRateLimits,
	getOrCreateTipDeviceId,
	TIP_DEVICE_COOKIE,
	verifyTipDeviceCookie,
	type RateLimitAction
} from '$lib/server/services/rate-limit';
import { db, schema } from '$lib/server/db';
import { eq, like } from 'drizzle-orm';
import { afterAll, beforeAll } from 'vitest';
import { seedDatabase } from '$lib/server/seed';
import { makeSignature } from 'better-auth/crypto';
import { authSecret } from '$lib/server/auth';
import { uniqueClientAddress } from '../helpers/client';
import * as __route1 from '../../../src/routes/(zine)/i/[slug]/+page.server';
const { actions: issueActions } = withSessionModule(__route1);
import * as __route2 from '../../../src/routes/(site)/login/+page.server';
const { actions: loginActions } = withSessionModule(__route2);
import { GET as scanGET } from '../../../src/routes/scan/[slug]/+server';

const createdUserIds: string[] = [];

// Creates the schema (and the seeded Artist the petition test names) on a fresh database.
beforeAll(async () => {
	await seedDatabase();
});

afterAll(async () => {
	for (const id of createdUserIds) {
		await db.delete(schema.users).where(eq(schema.users.id, id));
	}
});

async function createFanSession() {
	const userId = crypto.randomUUID();
	const token = `test_rl_${crypto.randomUUID()}`;
	const now = new Date();
	createdUserIds.push(userId);
	await db.insert(schema.users).values({
		id: userId,
		name: 'Rate Limit Fan',
		email: `rl-fan-${crypto.randomBytes(4).toString('hex')}@example.com`,
		emailVerified: true,
		accountType: 'fan',
		createdAt: now,
		updatedAt: now
	});
	await db.insert(schema.sessions).values({
		id: crypto.randomUUID(),
		userId,
		token,
		expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
		createdAt: now,
		updatedAt: now
	});
	return {
		userId,
		cookie: `better-auth.session_token=${token}.${await makeSignature(token, authSecret)}`
	};
}

/** An Artist to receive notes; deleting its user cascades to the notes. */
async function createArtist(ownerId: string) {
	const artistId = crypto.randomUUID();
	const now = new Date();
	await db.insert(schema.artists).values({
		id: artistId,
		userId: ownerId,
		slug: `rl-artist-${crypto.randomBytes(4).toString('hex')}`,
		displayName: 'Rate Limit Band',
		createdAt: now,
		updatedAt: now
	});
	return artistId;
}

/** A fixed clock at the start of a day, so every window starts fresh. */
const T0 = new Date(Date.UTC(2031, 0, 1, 0, 0, 0));
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000);
const subject = () => `subject-${crypto.randomUUID()}`;

function cookieJar(initial: Record<string, string> = {}) {
	const store = new Map(Object.entries(initial));
	return {
		store,
		get: (name: string) => store.get(name),
		getAll: () => [...store].map(([name, value]) => ({ name, value })),
		set: (name: string, value: string) => {
			store.set(name, value);
		},
		delete: (name: string) => {
			store.delete(name);
		},
		serialize: (name: string, value: string) => `${name}=${value}`
	};
}

describe('RATE_LIMITS config (PRODUCTION_PLAN 2.3)', () => {
	it('holds the planned starting limits', () => {
		expect(RATE_LIMITS.tipDevice).toMatchObject({ max: 10, windowSeconds: 3600 });
		expect(RATE_LIMITS.tipIp).toMatchObject({ max: 100, windowSeconds: 3600 });
		expect(RATE_LIMITS.petitionIp).toMatchObject({ max: 3, windowSeconds: 86400 });
		expect(RATE_LIMITS.petitionEmail).toMatchObject({ max: 1, windowSeconds: 86400 });
		expect(RATE_LIMITS.wallNoteIp).toMatchObject({ max: 5, windowSeconds: 600 });
		expect(RATE_LIMITS.flagIp).toMatchObject({ max: 20, windowSeconds: 3600 });
		expect(RATE_LIMITS.scanIp).toMatchObject({ max: 60, windowSeconds: 60 });
		expect(RATE_LIMITS.verificationResendUser).toMatchObject({ max: 3, windowSeconds: 3600 });
	});

	it('feeds Better Auth its sign-in, sign-up and reset rules from the same object', () => {
		const rules = betterAuthRateLimitRules();
		expect(rules['/sign-in/*']).toEqual({ window: 600, max: RATE_LIMITS.signInIp.max });
		expect(rules['/sign-up/*']).toEqual({ window: 3600, max: RATE_LIMITS.signUpIp.max });
		expect(rules['/request-password-reset']).toEqual({
			window: 3600,
			max: RATE_LIMITS.passwordResetIp.max
		});
	});
});

describe('consumeRateLimit', () => {
	const actions = Object.keys(RATE_LIMITS) as RateLimitAction[];

	it.each(actions)('%s trips at limit + 1 and resets after the window', async (action) => {
		const rule = RATE_LIMITS[action];
		const who = subject();

		for (let i = 1; i <= rule.max; i++) {
			const decision = await consumeRateLimit(action, who, T0);
			expect(decision.allowed).toBe(true);
		}

		const over = await consumeRateLimit(action, who, at(rule.windowSeconds - 1));
		expect(over.allowed).toBe(false);
		if (!over.allowed) {
			expect(over.message).toBe(rule.message);
			expect(over.retryAfterSeconds).toBe(1);
		}

		const nextWindow = await consumeRateLimit(action, who, at(rule.windowSeconds));
		expect(nextWindow.allowed).toBe(true);
		expect(nextWindow.count).toBe(1);
	});

	it('keeps subjects and actions apart', async () => {
		const who = subject();
		for (let i = 0; i < RATE_LIMITS.petitionEmail.max; i++) {
			await consumeRateLimit('petitionEmail', who, T0);
		}
		expect((await consumeRateLimit('petitionEmail', who, T0)).allowed).toBe(false);
		expect((await consumeRateLimit('petitionEmail', subject(), T0)).allowed).toBe(true);
		expect((await consumeRateLimit('petitionIp', who, T0)).allowed).toBe(true);
	});

	it('counts concurrent requests atomically', async () => {
		const who = subject();
		const decisions = await Promise.all(
			Array.from({ length: 12 }, () => consumeRateLimit('wallNoteIp', who, T0))
		);
		expect(decisions.filter((d) => d.allowed)).toHaveLength(RATE_LIMITS.wallNoteIp.max);
	});

	it('never stores the raw subject', async () => {
		const ip = `203.0.113.${crypto.randomInt(1, 254)}-${crypto.randomUUID()}`;
		await consumeRateLimit('scanIp', ip, T0);
		const leaked = await db
			.select()
			.from(schema.rateLimits)
			.where(like(schema.rateLimits.key, `%${ip}%`));
		expect(leaked).toHaveLength(0);
	});
});

describe('tip limits: device and IP are independent', () => {
	it('a device over its limit is refused while a new device on the same IP still tips', async () => {
		const ip = subject();
		const deviceA = subject();
		for (let i = 0; i < RATE_LIMITS.tipDevice.max; i++) {
			const ok = await consumeRateLimits([['tipDevice', deviceA], ['tipIp', ip]], T0);
			expect(ok.allowed).toBe(true);
		}
		const blocked = await consumeRateLimits([['tipDevice', deviceA], ['tipIp', ip]], T0);
		expect(blocked.allowed).toBe(false);
		if (!blocked.allowed) expect(blocked.message).toBe(RATE_LIMITS.tipDevice.message);

		const deviceB = await consumeRateLimits([['tipDevice', subject()], ['tipIp', ip]], T0);
		expect(deviceB.allowed).toBe(true);
	});

	it('an IP over its limit is refused even for a fresh device', async () => {
		const ip = subject();
		for (let i = 0; i < RATE_LIMITS.tipIp.max; i++) {
			const ok = await consumeRateLimits([['tipDevice', subject()], ['tipIp', ip]], T0);
			expect(ok.allowed).toBe(true);
		}
		const blocked = await consumeRateLimits([['tipDevice', subject()], ['tipIp', ip]], T0);
		expect(blocked.allowed).toBe(false);
		if (!blocked.allowed) expect(blocked.message).toBe(RATE_LIMITS.tipIp.message);

		// The same device on another network is not affected.
		const elsewhere = await consumeRateLimits([['tipDevice', subject()], ['tipIp', subject()]], T0);
		expect(elsewhere.allowed).toBe(true);
	});

	it('signs the device cookie and re-mints it when tampered with', () => {
		const jar = cookieJar();
		const id = getOrCreateTipDeviceId(jar as never);
		const value = jar.store.get(TIP_DEVICE_COOKIE)!;
		expect(verifyTipDeviceCookie(value)).toBe(id);
		expect(getOrCreateTipDeviceId(jar as never)).toBe(id);

		const forged = `${'a'.repeat(24)}.${value.split('.')[1]}`;
		expect(verifyTipDeviceCookie(forged)).toBeNull();
		const tampered = cookieJar({ [TIP_DEVICE_COOKIE]: forged });
		expect(getOrCreateTipDeviceId(tampered as never)).not.toBe('a'.repeat(24));
	});
});

describe('route over-limit responses', () => {
	it('wall notes and flags: 429 with a plain message from the Issue route', async () => {
		const fan = await createFanSession();
		const artistId = await createArtist(fan.userId);
		const getClientAddress = uniqueClientAddress();
		const call = (action: 'submitNote' | 'flagNote') => {
			const form = new FormData();
			form.set('artistId', artistId);
			form.set('body', 'Great show tonight');
			form.set('noteId', `missing-note-${crypto.randomUUID()}`);
			return issueActions[action]({
				params: { slug: `no-such-issue-${crypto.randomUUID()}` },
				request: new Request(`http://localhost:5173/i/x?/${action}`, {
					method: 'POST',
					headers: { cookie: fan.cookie },
					body: form
				}),
				getClientAddress
			} as never) as Promise<{ status: number; data: { error: string } }>;
		};

		for (let i = 0; i < RATE_LIMITS.wallNoteIp.max; i++) {
			expect((await call('submitNote')).status).not.toBe(429);
		}
		const note = await call('submitNote');
		expect(note.status).toBe(429);
		expect(note.data.error).toBe(RATE_LIMITS.wallNoteIp.message);

		for (let i = 0; i < RATE_LIMITS.flagIp.max; i++) {
			expect((await call('flagNote')).status).not.toBe(429);
		}
		const flag = await call('flagNote');
		expect(flag.status).toBe(429);
		expect(flag.data.error).toBe(RATE_LIMITS.flagIp.message);
	});

	it('petitions: the second petition for one email in a day gets a visible 429', async () => {
		const email = `petitioner-${crypto.randomUUID()}@example.com`;
		const petition = (rationale = 'We have played under this name for ten years.') => {
			const form = new FormData();
			form.set('requestedSlug', 'the-neon-velvet');
			form.set('petitionerName', 'Claimant');
			form.set('petitionerEmail', email);
			form.set('rationale', rationale);
			return loginActions.petitionSlug({
				request: new Request('http://localhost:5173/login?/petitionSlug', { method: 'POST', body: form }),
				getClientAddress: uniqueClientAddress()
			} as never) as Promise<{ status?: number; data?: { petitionError: string } }>;
		};

		// A malformed petition does not use up the day's petition for that email.
		expect((await petition('too short')).status).toBe(400);
		const first = await petition();
		expect(first.status).not.toBe(429);
		const second = await petition();
		expect(second.status).toBe(429);
		expect(second.data?.petitionError).toBe(RATE_LIMITS.petitionEmail.message);
	});

	it('scans: a plain 429 response after 60 a minute from one IP', async () => {
		const getClientAddress = uniqueClientAddress();
		const ip = getClientAddress();
		for (let i = 0; i < RATE_LIMITS.scanIp.max; i++) {
			await consumeRateLimit('scanIp', ip);
		}
		const response = (await scanGET({
			params: { slug: 'any-issue' },
			url: new URL('http://localhost:5173/scan/any-issue?k=secret'),
			cookies: cookieJar(),
			getClientAddress
		} as never)) as Response;
		expect(response.status).toBe(429);
		expect(await response.text()).toBe(RATE_LIMITS.scanIp.message);
		expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
	});
});
