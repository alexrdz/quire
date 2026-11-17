import crypto from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { hashPassword, makeSignature } from 'better-auth/crypto';
import {
	archiveIssuesOnClosure,
	ArtistAccountStatus,
	isArtistClosed,
	SlugPetitionStatus
} from '$domain/account';
import { createArtistId, createIssueId } from '$domain/types';
import {
	changeBandEmailSchema,
	changePasswordSchema,
	closeArtistAccountSchema,
	slugPetitionSchema
} from '$schemas/auth';
import { authSecret, verifyUserCredentialPassword } from '$lib/server/auth';
import { db, schema } from '$lib/server/db';
import { seedDatabase } from '$lib/server/seed';
import { actions as settingsActions, load as settingsLoad } from '../../../src/routes/dashboard/settings/+page.server';
import { actions as loginActions, load as loginLoad } from '../../../src/routes/login/+page.server';
import { actions as backPageActions, load as backPageLoad } from '../../../src/routes/a/[slug]/+page.server';
import { actions as issueActions, load as issueLoad } from '../../../src/routes/i/[slug]/+page.server';

const createdUserIds: string[] = [];
const createdSessionTokens: string[] = [];

afterEach(async () => {
	while (createdSessionTokens.length > 0) {
		const token = createdSessionTokens.pop()!;
		await db.delete(schema.sessions).where(eq(schema.sessions.token, token));
	}
	while (createdUserIds.length > 0) {
		const userId = createdUserIds.pop()!;
		await db.delete(schema.users).where(eq(schema.users.id, userId));
	}
});

async function createArtistFixture(opts?: { emailVerified?: boolean; password?: string }) {
	const suffix = crypto.randomBytes(4).toString('hex');
	const userId = crypto.randomUUID();
	const artistId = crypto.randomUUID();
	const sessionToken = `test_acct_sess_${crypto.randomUUID()}`;
	const slug = `velvet-signal-${suffix}`;
	const email = `band-${suffix}@example.com`;
	const password = opts?.password ?? 'correct-horse-battery';
	const now = new Date();
	const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24);

	createdUserIds.push(userId);
	createdSessionTokens.push(sessionToken);

	await db.insert(schema.users).values({
		id: userId,
		name: 'Velvet Signal',
		email,
		emailVerified: opts?.emailVerified ?? false,
		accountType: 'artist',
		createdAt: now,
		updatedAt: now
	});

	const passwordHash = await hashPassword(password);
	await db.insert(schema.accounts).values({
		id: crypto.randomUUID(),
		userId,
		accountId: userId,
		providerId: 'credential',
		password: passwordHash,
		createdAt: now,
		updatedAt: now
	});

	await db.insert(schema.artists).values({
		id: artistId,
		userId,
		slug,
		displayName: 'Velvet Signal',
		bio: 'Touring noise pop',
		accentColor: '#05D9E8',
		typePairing: 'sans-serif',
		tipPresetsJson: '[3, 5, 10]',
		linksJson: '[]',
		payoutsEnabled: true,
		verified: false,
		generalWallApproveFirst: false,
		accountStatus: ArtistAccountStatus.Active,
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

	const signature = await makeSignature(sessionToken, authSecret);
	const cookie = `better-auth.session_token=${sessionToken}.${signature}`;

	return { userId, artistId, slug, email, password, cookie };
}

function makeCookiesMock() {
	const deleted: string[] = [];
	const setCalls: Array<{ name: string; value: string }> = [];
	return {
		deleted,
		setCalls,
		get: () => undefined,
		set: (name: string, value: string) => setCalls.push({ name, value }),
		delete: (name: string) => deleted.push(name)
	};
}

describe('Item 3: Artist Account Lifecycle, Verification & Handle Petitions', () => {
	it('archives draft, published, and cancelled issues purely via domain helper', () => {
		expect(isArtistClosed({ accountStatus: ArtistAccountStatus.Active })).toBe(false);
		expect(isArtistClosed({ accountStatus: ArtistAccountStatus.Closed })).toBe(true);

		const artistId = createArtistId('artist-1');
		const now = new Date('2026-11-17T12:00:00Z');
		const result = archiveIssuesOnClosure(
			[
				{
					id: createIssueId('i-draft'),
					artistId,
					slug: 'draft-1',
					city: 'NYC',
					venue: 'Market Hotel',
					date: '2026-11-18',
					timezone: 'America/New_York',
					coverNote: '',
					approveFirst: false,
					status: 'draft'
				},
				{
					id: createIssueId('i-pub'),
					artistId,
					slug: 'pub-1',
					city: 'Philly',
					venue: 'Union Transfer',
					date: '2026-11-19',
					timezone: 'America/New_York',
					coverNote: '',
					approveFirst: false,
					status: 'published',
					secretKey: 'sec',
					stampWindow: {
						start: new Date('2026-11-19T05:00:00Z'),
						end: new Date('2026-11-21T04:59:59Z')
					},
					publishedAt: new Date('2026-11-18T12:00:00Z')
				}
			],
			now
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toHaveLength(2);
		expect(result.value.every((issue) => issue.status === 'archived')).toBe(true);
	});

	it('validates account credential & petition schemas', () => {
		expect(
			changePasswordSchema.safeParse({
				currentPassword: 'old',
				newPassword: 'newpassword123',
				confirmNewPassword: 'mismatch',
				revokeOtherSessions: true
			}).success
		).toBe(false);

		expect(
			changeBandEmailSchema.safeParse({
				newEmail: 'updated@band.com',
				currentPassword: 'secret'
			}).success
		).toBe(true);

		expect(
			closeArtistAccountSchema.safeParse({
				confirmPassword: 'secret',
				confirmPhrase: 'close'
			}).success
		).toBe(false);

		expect(
			slugPetitionSchema.safeParse({
				requestedSlug: 'the-neon-velvet',
				petitionerName: 'The Neon Velvet UK',
				petitionerEmail: 'hello@neonvelvet.co.uk',
				evidenceUrl: 'https://neonvelvet.bandcamp.com',
				rationale: 'We have toured under this band name since 2019 and the handle is inactive.'
			}).success
		).toBe(true);
	});

	it('loads emailVerified status and supports resendVerification, changeEmail, and changePassword', async () => {
		await seedDatabase();
		const fixture = await createArtistFixture({ emailVerified: false });

		const loadReq = new Request('http://localhost:4173/dashboard/settings', {
			headers: { cookie: fixture.cookie }
		});
		const loaded = (await (settingsLoad as any)({
			request: loadReq,
			url: new URL(loadReq.url)
		})) as any;
		expect(loaded.emailVerified).toBe(false);

		// 1. Resend verification email
		const resendRes = (await settingsActions.resendVerification({
			request: new Request('http://localhost:4173/dashboard/settings?/resendVerification', {
				method: 'POST',
				headers: { cookie: fixture.cookie }
			})
		} as any)) as any;
		expect(resendRes.verificationEmailSent).toBe(true);
		expect(resendRes.sentToEmail).toBe(fixture.email);

		// 2. Reject changeEmail with wrong password
		const badEmailForm = new FormData();
		badEmailForm.set('newEmail', `next-${crypto.randomBytes(3).toString('hex')}@example.com`);
		badEmailForm.set('currentPassword', 'wrong-password');
		const badEmailRes = (await settingsActions.changeEmail({
			request: new Request('http://localhost:4173/dashboard/settings?/changeEmail', {
				method: 'POST',
				headers: { cookie: fixture.cookie },
				body: badEmailForm
			})
		} as any)) as any;
		expect(badEmailRes.status).toBe(403);

		// 3. Initiate changeEmail with correct password
		const nextEmail = `next-${crypto.randomBytes(3).toString('hex')}@example.com`;
		const okEmailForm = new FormData();
		okEmailForm.set('newEmail', nextEmail);
		okEmailForm.set('currentPassword', fixture.password);
		const okEmailRes = (await settingsActions.changeEmail({
			request: new Request('http://localhost:4173/dashboard/settings?/changeEmail', {
				method: 'POST',
				headers: { cookie: fixture.cookie },
				body: okEmailForm
			})
		} as any)) as any;
		expect(okEmailRes.emailChangeRequested).toBe(true);
		expect(okEmailRes.targetEmail).toBe(nextEmail);

		// 4. Change password & verify credential updated
		const newPassword = 'brand-new-band-password-99';
		const pwForm = new FormData();
		pwForm.set('currentPassword', fixture.password);
		pwForm.set('newPassword', newPassword);
		pwForm.set('confirmNewPassword', newPassword);
		pwForm.set('revokeOtherSessions', 'false');

		const pwRes = (await settingsActions.changePassword({
			request: new Request('http://localhost:4173/dashboard/settings?/changePassword', {
				method: 'POST',
				headers: { cookie: fixture.cookie },
				body: pwForm
			})
		} as any)) as any;
		expect(pwRes.passwordChanged).toBe(true);

		expect(await verifyUserCredentialPassword(fixture.userId, newPassword)).toBe(true);
	});

	it('closes artist account, archives issues, preserves fan stubs, blocks re-login, and supports slug petitions', async () => {
		await seedDatabase();
		const fixture = await createArtistFixture({ emailVerified: true });
		const fan = await db.query.users.findFirst({
			where: eq(schema.users.email, 'maya@example.com')
		});
		expect(fan).toBeDefined();
		if (!fan) return;

		const issueId = crypto.randomUUID();
		const issueSlug = `${fixture.slug}-boston-2026-11-17`;
		const now = new Date();
		await db.insert(schema.issues).values({
			id: issueId,
			artistId: fixture.artistId,
			slug: issueSlug,
			city: 'Boston',
			venue: 'The Sinclair',
			date: '2026-11-17',
			timezone: 'America/New_York',
			coverNote: 'Final tour stop',
			secretKey: crypto.randomBytes(16).toString('hex'),
			status: 'published',
			approveFirst: false,
			publishedAt: now,
			createdAt: now,
			updatedAt: now
		});

		await db.insert(schema.collections).values({
			id: crypto.randomUUID(),
			fanUserId: fan.id,
			issueId,
			kind: 'stamped',
			createdAt: now
		});

		// Require exact CLOSE confirmation phrase
		const badCloseForm = new FormData();
		badCloseForm.set('confirmPassword', fixture.password);
		badCloseForm.set('confirmPhrase', 'NOPE');
		const badCloseRes = (await settingsActions.closeAccount({
			request: new Request('http://localhost:4173/dashboard/settings?/closeAccount', {
				method: 'POST',
				headers: { cookie: fixture.cookie },
				body: badCloseForm
			}),
			cookies: makeCookiesMock()
		} as any)) as any;
		expect(badCloseRes.status).toBe(400);

		// Close account cleanly
		const closeForm = new FormData();
		closeForm.set('confirmPassword', fixture.password);
		closeForm.set('confirmPhrase', 'CLOSE');
		const cookiesMock = makeCookiesMock();

		try {
			await settingsActions.closeAccount({
				request: new Request('http://localhost:4173/dashboard/settings?/closeAccount', {
					method: 'POST',
					headers: { cookie: fixture.cookie },
					body: closeForm
				}),
				cookies: cookiesMock
			} as any);
			expect.unreachable('Should redirect to /login?closed=1');
		} catch (redirectErr: any) {
			expect(redirectErr.status).toBe(303);
			expect(redirectErr.location).toBe('/login?closed=1');
		}

		expect(cookiesMock.deleted).toContain('better-auth.session_token');

		const closedArtist = await db.query.artists.findFirst({
			where: eq(schema.artists.id, fixture.artistId)
		});
		expect(closedArtist?.accountStatus).toBe(ArtistAccountStatus.Closed);
		expect(closedArtist?.payoutsEnabled).toBe(false);
		expect(closedArtist?.closedAt).toBeDefined();

		const archivedIssue = await db.query.issues.findFirst({
			where: eq(schema.issues.id, issueId)
		});
		expect(archivedIssue?.status).toBe('archived');
		expect(archivedIssue?.archivedAt).toBeDefined();

		// Fan Stub remains preserved
		const preservedStub = await db.query.collections.findFirst({
			where: eq(schema.collections.issueId, issueId)
		});
		expect(preservedStub?.kind).toBe('stamped');
		expect(preservedStub?.fanUserId).toBe(fan.id);

		// Closed artist cannot log back in
		const loginForm = new FormData();
		loginForm.set('email', fixture.email);
		loginForm.set('password', fixture.password);
		const loginFailRes = (await loginActions.login({
			request: new Request('http://localhost:4173/login?/login', {
				method: 'POST',
				body: loginForm
			}),
			url: new URL('http://localhost:4173/login'),
			cookies: makeCookiesMock()
		} as any)) as any;
		expect(loginFailRes.status).toBe(403);
		expect(loginFailRes.data.error).toContain('closed');

		// /login?closed=1 exposes accountClosed banner flag
		const closedLoginData = (await (loginLoad as any)({
			request: new Request('http://localhost:4173/login?closed=1'),
			url: new URL('http://localhost:4173/login?closed=1')
		})) as any;
		expect(closedLoginData.accountClosed).toBe(true);

		// Closed handle remains reserved on signup and invites petition
		const signupCollisionForm = new FormData();
		signupCollisionForm.set('name', 'New Velvet Signal');
		signupCollisionForm.set('slug', fixture.slug);
		signupCollisionForm.set('email', `newband-${crypto.randomBytes(3).toString('hex')}@example.com`);
		signupCollisionForm.set('password', 'password1234');
		const collisionRes = (await loginActions.signup({
			request: new Request('http://localhost:4173/login?/signup', {
				method: 'POST',
				body: signupCollisionForm
			}),
			url: new URL('http://localhost:4173/login'),
			cookies: makeCookiesMock()
		} as any)) as any;
		expect(collisionRes.status).toBe(409);
		expect(collisionRes.data.collidedSlug).toBe(fixture.slug);
		expect(collisionRes.data.collidedArtistClosed).toBe(true);
		expect(collisionRes.data.slugSuggestions.length).toBeGreaterThan(0);

		// Another artist can petition to acquire the closed/reserved handle
		const petitionerEmail = `claimant-${crypto.randomBytes(3).toString('hex')}@example.com`;
		const petitionForm = new FormData();
		petitionForm.set('requestedSlug', fixture.slug);
		petitionForm.set('petitionerName', 'Original Velvet Signal');
		petitionForm.set('petitionerEmail', petitionerEmail);
		petitionForm.set('evidenceUrl', 'https://velvetsignal.bandcamp.com');
		petitionForm.set(
			'rationale',
			'We are the original touring band and the previous holder closed their account.'
		);
		const petitionRes = (await loginActions.petitionSlug({
			request: new Request('http://localhost:4173/login?/petitionSlug', {
				method: 'POST',
				body: petitionForm
			})
		} as any)) as any;
		expect(petitionRes.petitionSubmitted).toBe(true);
		expect(petitionRes.petitionedSlug).toBe(fixture.slug);
		expect(petitionRes.existingArtistClosed).toBe(true);

		const petitionRow = await db.query.slugPetitions.findFirst({
			where: eq(schema.slugPetitions.requestedSlug, fixture.slug)
		});
		expect(petitionRow?.status).toBe(SlugPetitionStatus.Pending);
		expect(petitionRow?.existingArtistClosed).toBe(true);

		// Public Back Page /a/[slug] shows closed state & blocks tipping/notes
		const backData = (await (backPageLoad as any)({
			params: { slug: fixture.slug },
			request: new Request(`http://localhost:4173/a/${fixture.slug}`)
		})) as any;
		expect(backData.isArtistClosed).toBe(true);
		expect(backData.groupedIssues).toEqual([]);

		const closedBackTip = (await backPageActions.tip({
			params: { slug: fixture.slug },
			request: new Request(`http://localhost:4173/a/${fixture.slug}?/tip`, { method: 'POST' }),
			url: new URL(`http://localhost:4173/a/${fixture.slug}`)
		} as any)) as any;
		expect(closedBackTip.status).toBe(403);
		expect(closedBackTip.data.error).toBe('This artist has left Quire.');

		// Public Issue Reader /i/[slug] stays readable in read-only mode & blocks tipping
		const issueData = (await (issueLoad as any)({
			params: { slug: issueSlug },
			cookies: makeCookiesMock(),
			request: new Request(`http://localhost:4173/i/${issueSlug}`)
		})) as any;
		expect(issueData.isArtistClosed).toBe(true);
		expect(issueData.isReadOnly).toBe(true);

		const closedIssueTip = (await issueActions.tip({
			params: { slug: issueSlug },
			request: new Request(`http://localhost:4173/i/${issueSlug}?/tip`, { method: 'POST' }),
			url: new URL(`http://localhost:4173/i/${issueSlug}`)
		} as any)) as any;
		expect(closedIssueTip.status).toBe(403);
		expect(closedIssueTip.data.error).toBe('This artist has left Quire.');
	});
});
