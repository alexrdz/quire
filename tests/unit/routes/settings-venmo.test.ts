import crypto from 'node:crypto';
import { withSessionModule } from '../helpers/session-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { hashPassword, makeSignature } from 'better-auth/crypto';
import { isRedirect } from '@sveltejs/kit';
import type { Config } from '$lib/server/config';

/**
 * Venmo username setup and change (ADR 0008, PRODUCTION_PLAN V.3).
 * Replaces the Stripe Connect settings tests.
 */
const state = vi.hoisted(() => ({ override: null as null | ((base: Config) => Config) }));

vi.mock('$lib/server/config', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/config')>();
	return {
		...actual,
		getConfig: () => {
			const base = actual.getConfig();
			return state.override ? state.override(base) : base;
		}
	};
});

const { db, schema } = await import('$lib/server/db');
const { authSecret } = await import('$lib/server/auth');
const { seedDatabase } = await import('$lib/server/seed');
const { EMAIL_CONFIRMATION_REQUIRED } = await import('$lib/server/email/verification');
const { FEATURE_UNAVAILABLE } = await import('$lib/features');
const { RATE_LIMITS } = await import('$lib/server/services/rate-limit');
const settings = withSessionModule(await import('../../../src/routes/(site)/dashboard/settings/+page.server'));
const confirmVenmo = withSessionModule(await import('../../../src/routes/(site)/dashboard/settings/confirm-venmo/+page.server'));
const confirmPayout = await import(
	'../../../src/routes/(site)/dashboard/settings/confirm-payout/+server'
);

const PASSWORD = 'shared-band-password-42';
const BASE = 'http://localhost:5173';

interface Fixture {
	userId: string;
	artistId: string;
	email: string;
	cookie: string;
}

const created: Fixture[] = [];
let consoleInfo: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
	await seedDatabase();
});

beforeEach(() => {
	consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined);
	vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(async () => {
	state.override = null;
	vi.restoreAllMocks();
	while (created.length > 0) {
		const fixture = created.pop()!;
		await db.delete(schema.users).where(eq(schema.users.id, fixture.userId));
	}
});

async function createArtist(options: { emailVerified?: boolean; venmoUsername?: string | null } = {}) {
	const userId = crypto.randomUUID();
	const artistId = crypto.randomUUID();
	const suffix = crypto.randomBytes(4).toString('hex');
	const email = `venmo-${suffix}@example.com`;
	const token = `test_venmo_${crypto.randomUUID()}`;
	const now = new Date();

	await db.insert(schema.users).values({
		id: userId,
		name: 'Midnight Cassette',
		email,
		emailVerified: options.emailVerified ?? true,
		accountType: 'artist',
		createdAt: now,
		updatedAt: now
	});
	await db.insert(schema.accounts).values({
		id: crypto.randomUUID(),
		userId,
		accountId: userId,
		providerId: 'credential',
		password: await hashPassword(PASSWORD),
		createdAt: now,
		updatedAt: now
	});
	await db.insert(schema.artists).values({
		id: artistId,
		userId,
		slug: `midnight-cassette-${suffix}`,
		displayName: 'Midnight Cassette',
		venmoUsername: options.venmoUsername ?? null,
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
	const fixture = {
		userId,
		artistId,
		email,
		cookie: `better-auth.session_token=${token}.${await makeSignature(token, authSecret)}`
	};
	created.push(fixture);
	return fixture;
}

function post(path: string, cookie: string, fields: Record<string, string> = {}) {
	const form = new FormData();
	for (const [key, value] of Object.entries(fields)) form.set(key, value);
	return new Request(`${BASE}${path}`, { method: 'POST', headers: { cookie }, body: form });
}

function get(path: string, cookie: string) {
	return new Request(`${BASE}${path}`, { headers: { cookie } });
}

type Result = { status?: number; data?: Record<string, any> } & Record<string, any>;

async function run(fn: unknown, event: Record<string, unknown>): Promise<Result> {
	try {
		return (await (fn as (e: never) => Promise<unknown>)(event as never)) as Result;
	} catch (thrown) {
		return { thrown } as Result;
	}
}

const saveVenmo = (fixture: Fixture, fields: Record<string, string>) =>
	run(settings.actions.saveVenmo, {
		request: post('/dashboard/settings?/saveVenmo', fixture.cookie, fields),
		url: new URL(`${BASE}/dashboard/settings?/saveVenmo`)
	});

const removeVenmo = (fixture: Fixture, fields: Record<string, string>) =>
	run(settings.actions.removeVenmo, {
		request: post('/dashboard/settings?/removeVenmo', fixture.cookie, fields),
		url: new URL(`${BASE}/dashboard/settings?/removeVenmo`)
	});

const loadSettings = (fixture: Fixture) =>
	run(settings.load, {
		request: get('/dashboard/settings', fixture.cookie),
		url: new URL(`${BASE}/dashboard/settings`)
	});

const loadConfirm = (fixture: Fixture, token: string) => {
	const path = `/dashboard/settings/confirm-venmo?token=${token}`;
	return run(confirmVenmo.load, { request: get(path, fixture.cookie), url: new URL(`${BASE}${path}`) });
};

const postConfirm = (fixture: Fixture, token: string) => {
	const path = '/dashboard/settings/confirm-venmo';
	return run(confirmVenmo.actions.default, {
		request: post(path, fixture.cookie, { token }),
		url: new URL(`${BASE}${path}`)
	});
};

/** Everything the dev/test email stand-in printed. */
function loggedEmails(): string {
	return consoleInfo.mock.calls.map((call) => call.map(String).join(' ')).join('\n');
}

function lastConfirmToken(): string {
	const matches = [...loggedEmails().matchAll(/confirm-venmo\?token=([a-f0-9]{64})/g)];
	expect(matches.length).toBeGreaterThan(0);
	return matches.at(-1)![1]!;
}

async function venmoOf(artistId: string) {
	const artist = await db.query.artists.findFirst({ where: eq(schema.artists.id, artistId) });
	return artist?.venmoUsername ?? null;
}

async function unusedTokens(artistId: string) {
	return db.query.venmoChangeTokens.findMany({
		where: and(
			eq(schema.venmoChangeTokens.artistId, artistId),
			isNull(schema.venmoChangeTokens.usedAt)
		)
	});
}

describe('settings page', () => {
	it('redirects signed-out visitors to /login', async () => {
		const result = await run(settings.load, {
			request: new Request(`${BASE}/dashboard/settings`),
			url: new URL(`${BASE}/dashboard/settings`)
		});
		expect(isRedirect(result.thrown) && result.thrown.location).toBe(
			'/login?redirect=/dashboard/settings'
		);
	});

	it('updates General Wall moderation without a password', async () => {
		const fixture = await createArtist();
		const result = await run(settings.actions.updateModeration, {
			request: post('/dashboard/settings?/updateModeration', fixture.cookie, {
				generalWallApproveFirst: 'true'
			}),
			url: new URL(`${BASE}/dashboard/settings?/updateModeration`)
		});
		expect(result).toMatchObject({ moderationSaved: true, generalWallApproveFirst: true });
	});

	it('no longer offers Stripe Connect', () => {
		expect(Object.keys(settings.actions)).not.toContain('requestPayoutChange');
		expect(Object.keys(settings.actions)).toEqual(
			expect.arrayContaining(['saveVenmo', 'removeVenmo'])
		);
	});

	it('retires confirm-payout by redirecting to Settings', async () => {
		const result = await run(confirmPayout.GET, {
			request: new Request(`${BASE}/dashboard/settings/confirm-payout?token=abc`)
		});
		expect(isRedirect(result.thrown) && result.thrown.location).toBe('/dashboard/settings');
	});
});

describe('first Venmo username', () => {
	it('needs a confirmed email', async () => {
		const fixture = await createArtist({ emailVerified: false });
		const result = await saveVenmo(fixture, { venmoUsername: '@midnight-cassette' });
		expect(result.status).toBe(403);
		expect(result.data?.venmoError).toBe(EMAIL_CONFIRMATION_REQUIRED.venmo);
		expect(await venmoOf(fixture.artistId)).toBeNull();

		const page = await loadSettings(fixture);
		expect(page.venmo.firstSetBlockedMessage).toBe(EMAIL_CONFIRMATION_REQUIRED.venmo);
	});

	it('needs nothing else: no password, no email link', async () => {
		const fixture = await createArtist();
		const result = await saveVenmo(fixture, { venmoUsername: '  @Midnight-Cassette ' });
		expect(result).toMatchObject({ venmoSaved: true, venmoUsername: 'Midnight-Cassette' });
		expect(await venmoOf(fixture.artistId)).toBe('Midnight-Cassette');
		expect(loggedEmails()).not.toMatch(/confirm-venmo/);
	});

	it('rejects an invalid username', async () => {
		const fixture = await createArtist();
		const result = await saveVenmo(fixture, { venmoUsername: 'bad name!' });
		expect(result.status).toBe(400);
		expect(await venmoOf(fixture.artistId)).toBeNull();
	});

	it('still works when email is off, if the email is confirmed', async () => {
		state.override = (base) => ({ ...base, features: { ...base.features, email: false } });
		const fixture = await createArtist();
		const result = await saveVenmo(fixture, { venmoUsername: 'midnight-cassette' });
		expect(result).toMatchObject({ venmoSaved: true });
	});
});

describe('Test your link', () => {
	it('shows the profile URL without opening it outside production', async () => {
		const fixture = await createArtist({ venmoUsername: 'midnight-cassette' });
		const page = await loadSettings(fixture);
		expect(page.venmo.profileUrl).toBe('https://venmo.com/u/midnight-cassette');
		expect(page.venmo.testLinkOpens).toBe(false);
	});

	it('opens the profile in production', async () => {
		state.override = (base) => ({ ...base, mode: 'production' });
		const fixture = await createArtist({ venmoUsername: 'midnight-cassette' });
		const page = await loadSettings(fixture);
		expect(page.venmo.testLinkOpens).toBe(true);
	});
});

describe('changing the Venmo username', () => {
	it('needs the password and leaves the old username live', async () => {
		const fixture = await createArtist({ venmoUsername: 'old-cassette' });

		const missing = await saveVenmo(fixture, { venmoUsername: 'new-cassette' });
		expect(missing.status).toBe(400);

		const wrong = await saveVenmo(fixture, { venmoUsername: 'new-cassette', confirmPassword: 'nope' });
		expect(wrong.status).toBe(403);
		expect(await unusedTokens(fixture.artistId)).toHaveLength(0);

		const ok = await saveVenmo(fixture, { venmoUsername: '@new-cassette', confirmPassword: PASSWORD });
		expect(ok).toMatchObject({ venmoChangeRequested: true, pendingUsername: 'new-cassette' });
		expect(await venmoOf(fixture.artistId)).toBe('old-cassette');

		const page = await loadSettings(fixture);
		expect(page.venmo.pending).toMatchObject({ newUsername: 'new-cassette' });
	});

	it('builds the emailed link from the configured app URL, never the request Host', async () => {
		for (const appUrl of [null, 'https://quire.live']) {
			state.override = appUrl ? (base) => ({ ...base, core: { ...base.core, appUrl } }) : null;
			const expectedBase = appUrl ?? 'http://localhost:5173';
			const fixture = await createArtist({ venmoUsername: 'old-cassette' });

			const form = new FormData();
			form.set('venmoUsername', 'new-cassette');
			form.set('confirmPassword', PASSWORD);
			const forged = new Request('https://evil.example/dashboard/settings?/saveVenmo', {
				method: 'POST',
				headers: {
					cookie: fixture.cookie,
					host: 'evil.example',
					'x-forwarded-host': 'evil.example',
					origin: 'https://evil.example'
				},
				body: form
			});
			const result = await run(settings.actions.saveVenmo, {
				request: forged,
				url: new URL('https://evil.example/dashboard/settings?/saveVenmo')
			});
			expect(result).toMatchObject({ venmoChangeRequested: true });

			const emails = loggedEmails();
			expect(emails).not.toContain('evil.example');
			const links = [...emails.matchAll(/(\S+)\/dashboard\/settings\/confirm-venmo\?token=[a-f0-9]{64}/g)];
			expect(links.length).toBeGreaterThan(0);
			expect(links.at(-1)![1]).toBe(expectedBase);
			consoleInfo.mockClear();
		}
	});

	it('stores only a hash of the single-use token, valid for 1 hour', async () => {
		const fixture = await createArtist({ venmoUsername: 'old-cassette' });
		const before = Date.now();
		await saveVenmo(fixture, { venmoUsername: 'new-cassette', confirmPassword: PASSWORD });
		const rawToken = lastConfirmToken();
		const [stored] = await unusedTokens(fixture.artistId);
		expect(stored!.tokenHash).not.toBe(rawToken);
		expect(stored!.tokenHash).toBe(crypto.createHash('sha256').update(rawToken).digest('hex'));
		const ttl = stored!.expiresAt.getTime() - before;
		expect(ttl).toBeGreaterThan(59 * 60 * 1000);
		expect(ttl).toBeLessThanOrEqual(61 * 60 * 1000);
	});

	it('GET shows the change without consuming the token; POST applies it once and emails a notice', async () => {
		const fixture = await createArtist({ venmoUsername: 'old-cassette' });
		await saveVenmo(fixture, { venmoUsername: 'new-cassette', confirmPassword: PASSWORD });
		const token = lastConfirmToken();

		for (let i = 0; i < 2; i++) {
			const page = await loadConfirm(fixture, token);
			expect(page).toMatchObject({
				status: 'pending',
				oldUsername: 'old-cassette',
				newUsername: 'new-cassette'
			});
		}
		expect(await unusedTokens(fixture.artistId)).toHaveLength(1);
		expect(await venmoOf(fixture.artistId)).toBe('old-cassette');

		const confirmed = await postConfirm(fixture, token);
		expect(isRedirect(confirmed.thrown) && confirmed.thrown.location).toBe(
			'/dashboard/settings?venmo=changed'
		);
		expect(await venmoOf(fixture.artistId)).toBe('new-cassette');
		expect(await unusedTokens(fixture.artistId)).toHaveLength(0);
		expect(loggedEmails()).toContain(
			"Your Venmo username was changed to @new-cassette.\nIf this wasn't you, reset your password."
		);

		const replay = await postConfirm(fixture, token);
		expect(replay.status).toBe(400);
		expect(replay.data?.errorCode).toBe('TOKEN_USED');
		const reload = await loadConfirm(fixture, token);
		expect(reload).toMatchObject({ status: 'error', errorCode: 'TOKEN_USED' });
	});

	it('refuses an expired link with a clear message', async () => {
		const fixture = await createArtist({ venmoUsername: 'old-cassette' });
		await saveVenmo(fixture, { venmoUsername: 'new-cassette', confirmPassword: PASSWORD });
		const token = lastConfirmToken();
		await db
			.update(schema.venmoChangeTokens)
			.set({ expiresAt: new Date(Date.now() - 1000) })
			.where(eq(schema.venmoChangeTokens.artistId, fixture.artistId));

		const page = await loadConfirm(fixture, token);
		expect(page).toMatchObject({ status: 'error', errorCode: 'TOKEN_EXPIRED' });
		expect(page.errorMessage).toMatch(/expired/i);
		const result = await postConfirm(fixture, token);
		expect(result.data?.errorCode).toBe('TOKEN_EXPIRED');
		expect(await venmoOf(fixture.artistId)).toBe('old-cassette');
	});

	it("refuses another artist's link", async () => {
		const owner = await createArtist({ venmoUsername: 'old-cassette' });
		await saveVenmo(owner, { venmoUsername: 'new-cassette', confirmPassword: PASSWORD });
		const token = lastConfirmToken();
		const other = await createArtist({ venmoUsername: 'other-band' });

		expect(await loadConfirm(other, token)).toMatchObject({ errorCode: 'WRONG_ACCOUNT' });
		expect((await postConfirm(other, token)).status).toBe(403);
		expect(await venmoOf(owner.artistId)).toBe('old-cassette');
		expect(await venmoOf(other.artistId)).toBe('other-band');
	});

	it('a new request replaces an earlier unconfirmed link', async () => {
		const fixture = await createArtist({ venmoUsername: 'old-cassette' });
		await saveVenmo(fixture, { venmoUsername: 'first-choice', confirmPassword: PASSWORD });
		const first = lastConfirmToken();
		await saveVenmo(fixture, { venmoUsername: 'second-choice', confirmPassword: PASSWORD });
		expect(await unusedTokens(fixture.artistId)).toHaveLength(1);
		expect(await loadConfirm(fixture, first)).toMatchObject({ errorCode: 'INVALID_TOKEN' });
	});

	it('removing needs the password and a link, then emails a notice', async () => {
		const fixture = await createArtist({ venmoUsername: 'old-cassette' });
		expect((await removeVenmo(fixture, { confirmPassword: 'nope' })).status).toBe(403);
		const requested = await removeVenmo(fixture, { confirmPassword: PASSWORD });
		expect(requested).toMatchObject({ venmoChangeRequested: true, pendingUsername: null });
		expect(await venmoOf(fixture.artistId)).toBe('old-cassette');

		const token = lastConfirmToken();
		expect(await loadConfirm(fixture, token)).toMatchObject({ status: 'pending', newUsername: null });
		const confirmed = await postConfirm(fixture, token);
		expect(isRedirect(confirmed.thrown) && confirmed.thrown.location).toBe(
			'/dashboard/settings?venmo=removed'
		);
		expect(await venmoOf(fixture.artistId)).toBeNull();
		expect(loggedEmails()).toContain('Your Venmo username was removed.');
	});

	it('is blocked with "We can\'t send email right now" when email is off', async () => {
		state.override = (base) => ({ ...base, features: { ...base.features, email: false } });
		const fixture = await createArtist({ venmoUsername: 'old-cassette' });

		const change = await saveVenmo(fixture, { venmoUsername: 'new-cassette', confirmPassword: PASSWORD });
		expect(change.status).toBe(503);
		expect(change.data?.venmoError).toBe(FEATURE_UNAVAILABLE.email);
		const remove = await removeVenmo(fixture, { confirmPassword: PASSWORD });
		expect(remove.data?.venmoError).toBe(FEATURE_UNAVAILABLE.email);
		expect(await unusedTokens(fixture.artistId)).toHaveLength(0);
		expect(await venmoOf(fixture.artistId)).toBe('old-cassette');

		const page = await loadSettings(fixture);
		expect(page.venmo.canChange).toBe(false);
	});

	it('is rate-limited per artist', async () => {
		const fixture = await createArtist({ venmoUsername: 'old-cassette' });
		const max = RATE_LIMITS.venmoChange.max;
		for (let i = 0; i < max; i++) {
			const ok = await saveVenmo(fixture, { venmoUsername: `next-band-${i}`, confirmPassword: PASSWORD });
			expect(ok, `request ${i + 1}`).toMatchObject({ venmoChangeRequested: true });
		}
		const limited = await saveVenmo(fixture, { venmoUsername: 'one-too-many', confirmPassword: PASSWORD });
		expect(limited.status).toBe(429);
		expect(limited.data?.venmoError).toBe(RATE_LIMITS.venmoChange.message);
	});

	it('never logs the link outside development and test', async () => {
		state.override = (base) => ({ ...base, mode: 'production', live: { ...base.live, email: false } });
		const fixture = await createArtist({ venmoUsername: 'old-cassette' });
		const result = await saveVenmo(fixture, { venmoUsername: 'new-cassette', confirmPassword: PASSWORD });
		// Production without a live email key cannot send, so the request fails closed.
		expect(result.status).toBeGreaterThanOrEqual(400);
		expect(loggedEmails()).not.toMatch(/confirm-venmo|token=/);
		expect(await unusedTokens(fixture.artistId)).toHaveLength(0);
	});
});
