import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { hashPassword, makeSignature } from 'better-auth/crypto';
import { db, schema } from '$lib/server/db';
import { authSecret } from '$lib/server/auth';
import * as stripeAdapter from '$lib/server/payments/stripe';
import {
	actions as settingsActions,
	load as settingsLoad
} from '../../../src/routes/dashboard/settings/+page.server';
import { load as confirmPayoutLoad } from '../../../src/routes/dashboard/settings/confirm-payout/+page.server';

const ORIGINAL_ENV = { ...process.env };

interface TestArtistFixture {
	userId: string;
	artistId: string;
	email: string;
	password: string;
	cookie: string;
}

async function createTestArtistFixture(options?: {
	stripeAccountId?: string | null;
	payoutsEnabled?: boolean;
	generalWallApproveFirst?: boolean;
}): Promise<TestArtistFixture> {
	const userId = crypto.randomUUID();
	const artistId = crypto.randomUUID();
	const email = `p5-band-${crypto.randomUUID()}@example.com`;
	const password = 'shared-band-password-42';
	const sessionToken = `test_p5_session_${crypto.randomUUID()}`;
	const now = new Date();
	const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24);

	const passwordHash = await hashPassword(password);

	await db.insert(schema.users).values({
		id: userId,
		name: 'Midnight Cassette',
		email,
		emailVerified: true,
		accountType: 'artist',
		createdAt: now,
		updatedAt: now
	});

	await db.insert(schema.accounts).values({
		id: crypto.randomUUID(),
		userId,
		accountId: userId,
		providerId: 'credential',
		password: passwordHash,
		createdAt: now,
		updatedAt: now
	});

	await db.insert(schema.sessions).values({
		id: crypto.randomUUID(),
		userId,
		token: sessionToken,
		expiresAt,
		createdAt: now,
		updatedAt: now
	});

	await db.insert(schema.artists).values({
		id: artistId,
		userId,
		slug: `midnight-cassette-${crypto.randomUUID().slice(0, 6)}`,
		displayName: 'Midnight Cassette',
		stripeAccountId: options?.stripeAccountId ?? null,
		payoutsEnabled: options?.payoutsEnabled ?? false,
		generalWallApproveFirst: options?.generalWallApproveFirst ?? false,
		createdAt: now,
		updatedAt: now
	});

	const signature = await makeSignature(sessionToken, authSecret);
	return {
		userId,
		artistId,
		email,
		password,
		cookie: `better-auth.session_token=${sessionToken}.${signature}`
	};
}

async function cleanupFixture(userId: string, artistId: string): Promise<void> {
	await db.delete(schema.payoutChangeTokens).where(eq(schema.payoutChangeTokens.artistId, artistId));
	await db.delete(schema.artists).where(eq(schema.artists.id, artistId));
	await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
	await db.delete(schema.accounts).where(eq(schema.accounts.userId, userId));
	await db.delete(schema.users).where(eq(schema.users.id, userId));
}

function buildFormRequest(
	url: string,
	cookie: string,
	entries: Record<string, string>
): Request {
	const formData = new FormData();
	for (const [key, value] of Object.entries(entries)) {
		formData.set(key, value);
	}
	return new Request(url, {
		method: 'POST',
		headers: { cookie },
		body: formData
	});
}

beforeEach(() => {
	process.env = { ...ORIGINAL_ENV };
	delete process.env.RESEND_API_KEY;
});

afterEach(() => {
	process.env = { ...ORIGINAL_ENV };
	vi.restoreAllMocks();
});

describe('Settings & Stripe Connect Payouts (P5)', () => {
	it('redirects unauthenticated requests to /login', async () => {
		const req = new Request('http://localhost:5173/dashboard/settings');
		try {
			await (settingsLoad as any)({
				request: req,
				url: new URL('http://localhost:5173/dashboard/settings')
			});
			expect.unreachable('Expected redirect');
		} catch (err: any) {
			expect(err.status).toBe(303);
			expect(err.location).toBe('/login?redirect=/dashboard/settings');
		}
	});

	it('updates generalWallApproveFirst via updateModeration without password re-entry', async () => {
		const fixture = await createTestArtistFixture({ generalWallApproveFirst: false });
		try {
			const url = new URL('http://localhost:5173/dashboard/settings?/updateModeration');
			const req = buildFormRequest(url.toString(), fixture.cookie, {
				generalWallApproveFirst: 'true'
			});

			const result = (await (settingsActions.updateModeration as any)({
				request: req,
				url
			})) as any;

			expect(result.moderationSaved).toBe(true);
			expect(result.generalWallApproveFirst).toBe(true);

			const updated = await db.query.artists.findFirst({
				where: eq(schema.artists.id, fixture.artistId)
			});
			expect(updated?.generalWallApproveFirst).toBe(true);
		} finally {
			await cleanupFixture(fixture.userId, fixture.artistId);
		}
	});

	it('syncs live Stripe Express payoutsEnabled status on load', async () => {
		const fixture = await createTestArtistFixture({
			stripeAccountId: 'acct_live_sync_test_123',
			payoutsEnabled: false
		});

		try {
			vi.spyOn(stripeAdapter, 'isStripeConfigured').mockReturnValue(true);
			vi.spyOn(stripeAdapter, 'inspectConnectedAccountStatus').mockResolvedValue({
				ok: true,
				value: {
					accountId: 'acct_live_sync_test_123',
					payoutsEnabled: true,
					chargesEnabled: true,
					detailsSubmitted: true,
					requirementsCurrentlyDue: []
				}
			});

			const url = new URL('http://localhost:5173/dashboard/settings?stripe=return');
			const req = new Request(url.toString(), {
				headers: { cookie: fixture.cookie }
			});

			const data = (await (settingsLoad as any)({ request: req, url })) as any;
			expect(data.stripeReturnState).toBe('return');
			expect(data.artist.payoutsEnabled).toBe(true);
			expect(data.stripeStatus?.chargesEnabled).toBe(true);

			const persisted = await db.query.artists.findFirst({
				where: eq(schema.artists.id, fixture.artistId)
			});
			expect(persisted?.payoutsEnabled).toBe(true);
		} finally {
			await cleanupFixture(fixture.userId, fixture.artistId);
		}
	});

	it('enforces SPEC 6.4 password re-entry and sends 1-hour single-use confirmation email', async () => {
		const fixture = await createTestArtistFixture();
		const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

		try {
			const url = new URL('http://localhost:5173/dashboard/settings?/requestPayoutChange');

			const badPassReq = buildFormRequest(url.toString(), fixture.cookie, {
				action: 'connect',
				confirmPassword: 'wrong-band-password'
			});
			const badRes = (await (settingsActions.requestPayoutChange as any)({
				request: badPassReq,
				url
			})) as any;
			expect(badRes.status).toBe(403);
			expect(badRes.data.payoutError).toContain('Incorrect password');

			const tokensAfterFail = await db.query.payoutChangeTokens.findMany({
				where: eq(schema.payoutChangeTokens.artistId, fixture.artistId)
			});
			expect(tokensAfterFail.length).toBe(0);

			const okReq = buildFormRequest(url.toString(), fixture.cookie, {
				action: 'connect',
				confirmPassword: fixture.password
			});
			const okRes = (await (settingsActions.requestPayoutChange as any)({
				request: okReq,
				url
			})) as any;

			expect(okRes.payoutConfirmationSent).toBe(true);
			expect(okRes.sentToEmail).toBe(fixture.email);

			const logText = infoSpy.mock.calls.flat().join('\n');
			const match = logText.match(/\/dashboard\/settings\/confirm-payout\?token=([a-f0-9]{64})/);
			expect(match).not.toBeNull();

			const storedToken = await db.query.payoutChangeTokens.findFirst({
				where: eq(schema.payoutChangeTokens.artistId, fixture.artistId)
			});
			expect(storedToken).toBeDefined();
			expect(storedToken?.status).toBe('pending');
			expect(storedToken?.confirmedAt).toBeNull();
			const expectedHash = crypto.createHash('sha256').update(match![1]).digest('hex');
			expect(storedToken?.tokenHash).toBe(expectedHash);

			const ttlMs = storedToken!.expiresAt.getTime() - storedToken!.createdAt.getTime();
			expect(ttlMs).toBe(1000 * 60 * 60);
		} finally {
			await cleanupFixture(fixture.userId, fixture.artistId);
		}
	});

	it('disconnects payouts atomically on /dashboard/settings/confirm-payout and rejects replay', async () => {
		const fixture = await createTestArtistFixture({
			stripeAccountId: 'acct_live_disconnect_123',
			payoutsEnabled: true
		});
		const otherFixture = await createTestArtistFixture();
		const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

		try {
			const reqUrl = new URL('http://localhost:5173/dashboard/settings?/requestPayoutChange');
			const req = buildFormRequest(reqUrl.toString(), fixture.cookie, {
				action: 'disconnect',
				confirmPassword: fixture.password
			});
			await (settingsActions.requestPayoutChange as any)({ request: req, url: reqUrl });

			const logText = infoSpy.mock.calls.flat().join('\n');
			const rawToken = logText.match(/confirm-payout\?token=([a-f0-9]{64})/)![1];
			const confirmUrl = new URL(
				`http://localhost:5173/dashboard/settings/confirm-payout?token=${rawToken}`
			);

			// Another artist cannot consume the token
			const otherRes = (await (confirmPayoutLoad as any)({
				request: new Request(confirmUrl.toString(), {
					headers: { cookie: otherFixture.cookie }
				}),
				url: confirmUrl
			})) as any;
			expect(otherRes.status).toBe('error');
			expect(otherRes.errorCode).toBe('UNAUTHORIZED');

			// Owning artist consumes token and disconnects
			const okRes = (await (confirmPayoutLoad as any)({
				request: new Request(confirmUrl.toString(), {
					headers: { cookie: fixture.cookie }
				}),
				url: confirmUrl
			})) as any;
			expect(okRes.status).toBe('disconnected');

			const updatedArtist = await db.query.artists.findFirst({
				where: eq(schema.artists.id, fixture.artistId)
			});
			expect(updatedArtist?.stripeAccountId).toBeNull();
			expect(updatedArtist?.payoutsEnabled).toBe(false);

			// Replaying the same token fails
			const replayRes = (await (confirmPayoutLoad as any)({
				request: new Request(confirmUrl.toString(), {
					headers: { cookie: fixture.cookie }
				}),
				url: confirmUrl
			})) as any;
			expect(replayRes.status).toBe('error');
			expect(replayRes.errorCode).toBe('TOKEN_ALREADY_USED');
		} finally {
			await cleanupFixture(fixture.userId, fixture.artistId);
			await cleanupFixture(otherFixture.userId, otherFixture.artistId);
		}
	});

	it('reports missing STRIPE_SECRET_KEY honestly or redirects to Stripe Express onboarding when configured', async () => {
		const fixture = await createTestArtistFixture();
		const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

		try {
			// Case 1: STRIPE_SECRET_KEY unset
			vi.spyOn(stripeAdapter, 'isStripeConfigured').mockReturnValue(false);

			const reqUrl = new URL('http://localhost:5173/dashboard/settings?/requestPayoutChange');
			await (settingsActions.requestPayoutChange as any)({
				request: buildFormRequest(reqUrl.toString(), fixture.cookie, {
					action: 'connect',
					confirmPassword: fixture.password
				}),
				url: reqUrl
			});

			let logText = infoSpy.mock.calls.flat().join('\n');
			const token1 = logText.match(/confirm-payout\?token=([a-f0-9]{64})/)![1];
			const confirmUrl1 = new URL(
				`http://localhost:5173/dashboard/settings/confirm-payout?token=${token1}`
			);

			const missingKeyRes = (await (confirmPayoutLoad as any)({
				request: new Request(confirmUrl1.toString(), {
					headers: { cookie: fixture.cookie }
				}),
				url: confirmUrl1
			})) as any;
			expect(missingKeyRes.status).toBe('error');
			expect(missingKeyRes.errorCode).toBe('STRIPE_NOT_CONFIGURED');
			expect(missingKeyRes.errorMessage).toBe(
				'Stripe is not configured on this server (missing STRIPE_SECRET_KEY).'
			);

			// Case 2: Stripe configured -> creates Express account + redirects to onboarding link
			vi.spyOn(stripeAdapter, 'isStripeConfigured').mockReturnValue(true);
			vi.spyOn(stripeAdapter, 'createExpressConnectedAccount').mockResolvedValue({
				ok: true,
				value: {
					accountId: 'acct_express_created_789',
					payoutsEnabled: false,
					chargesEnabled: false,
					detailsSubmitted: false,
					requirementsCurrentlyDue: ['individual.id_number']
				}
			});
			const linkSpy = vi
				.spyOn(stripeAdapter, 'createExpressOnboardingLink')
				.mockResolvedValue({
					ok: true,
					value: {
						url: 'https://connect.stripe.com/setup/e/acct_express_created_789/abc',
						expiresAt: new Date(Date.now() + 300_000)
					}
				});

			infoSpy.mockClear();
			await (settingsActions.requestPayoutChange as any)({
				request: buildFormRequest(reqUrl.toString(), fixture.cookie, {
					action: 'connect',
					confirmPassword: fixture.password
				}),
				url: reqUrl
			});

			logText = infoSpy.mock.calls.flat().join('\n');
			const token2 = logText.match(/confirm-payout\?token=([a-f0-9]{64})/)![1];
			const confirmUrl2 = new URL(
				`http://localhost:5173/dashboard/settings/confirm-payout?token=${token2}`
			);

			try {
				await (confirmPayoutLoad as any)({
					request: new Request(confirmUrl2.toString(), {
						headers: { cookie: fixture.cookie }
					}),
					url: confirmUrl2
				});
				expect.unreachable('Expected 303 redirect to Stripe Express onboarding');
			} catch (err: any) {
				expect(err.status).toBe(303);
				expect(err.location).toBe(
					'https://connect.stripe.com/setup/e/acct_express_created_789/abc'
				);
			}

			expect(linkSpy).toHaveBeenCalledWith({
				accountId: 'acct_express_created_789',
				returnUrl: 'http://localhost:5173/dashboard/settings?stripe=return',
				refreshUrl: 'http://localhost:5173/dashboard/settings?stripe=refresh',
				type: 'account_onboarding'
			});

			const updatedArtist = await db.query.artists.findFirst({
				where: eq(schema.artists.id, fixture.artistId)
			});
			expect(updatedArtist?.stripeAccountId).toBe('acct_express_created_789');
			expect(updatedArtist?.payoutsEnabled).toBe(false);

			// Case 3: Replace existing live account creates a brand new Express account
			vi.spyOn(stripeAdapter, 'createExpressConnectedAccount').mockResolvedValueOnce({
				ok: true,
				value: {
					accountId: 'acct_express_replaced_999',
					payoutsEnabled: false,
					chargesEnabled: false,
					detailsSubmitted: false,
					requirementsCurrentlyDue: []
				}
			});

			infoSpy.mockClear();
			await (settingsActions.requestPayoutChange as any)({
				request: buildFormRequest(reqUrl.toString(), fixture.cookie, {
					action: 'replace',
					confirmPassword: fixture.password
				}),
				url: reqUrl
			});

			logText = infoSpy.mock.calls.flat().join('\n');
			const token3 = logText.match(/confirm-payout\?token=([a-f0-9]{64})/)![1];
			const confirmUrl3 = new URL(
				`http://localhost:5173/dashboard/settings/confirm-payout?token=${token3}`
			);

			try {
				await (confirmPayoutLoad as any)({
					request: new Request(confirmUrl3.toString(), {
						headers: { cookie: fixture.cookie }
					}),
					url: confirmUrl3
				});
				expect.unreachable('Expected 303 redirect on replace');
			} catch (err: any) {
				expect(err.status).toBe(303);
			}

			const replacedArtist = await db.query.artists.findFirst({
				where: eq(schema.artists.id, fixture.artistId)
			});
			expect(replacedArtist?.stripeAccountId).toBe('acct_express_replaced_999');

			// Case 4: Expired token is rejected and marked expired
			const expiredRaw = crypto.randomBytes(32).toString('hex');
			const expiredHash = crypto.createHash('sha256').update(expiredRaw).digest('hex');
			const expiredId = crypto.randomUUID();
			await db.insert(schema.payoutChangeTokens).values({
				id: expiredId,
				artistId: fixture.artistId,
				userId: fixture.userId,
				tokenHash: expiredHash,
				action: 'connect',
				targetStripeAccountId: null,
				status: 'pending',
				expiresAt: new Date(Date.now() - 60_000),
				createdAt: new Date(Date.now() - 3_660_000)
			});

			const expiredUrl = new URL(
				`http://localhost:5173/dashboard/settings/confirm-payout?token=${expiredRaw}`
			);
			const expiredRes = (await (confirmPayoutLoad as any)({
				request: new Request(expiredUrl.toString(), {
					headers: { cookie: fixture.cookie }
				}),
				url: expiredUrl
			})) as any;
			expect(expiredRes.status).toBe('error');
			expect(expiredRes.errorCode).toBe('TOKEN_EXPIRED');

			const markedExpired = await db.query.payoutChangeTokens.findFirst({
				where: eq(schema.payoutChangeTokens.id, expiredId)
			});
			expect(markedExpired?.status).toBe('expired');
		} finally {
			await cleanupFixture(fixture.userId, fixture.artistId);
		}
	});
});
