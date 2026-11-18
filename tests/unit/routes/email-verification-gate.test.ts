import crypto from 'node:crypto';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { hashPassword, makeSignature } from 'better-auth/crypto';
import type { Config } from '$lib/server/config';

/**
 * Decision 31 / PRODUCTION_PLAN 2.4: an unconfirmed artist can sign in and build,
 * but cannot publish, upload or start Stripe Connect onboarding. All server-side.
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
const { EMAIL_CONFIRMATION_REQUIRED, formHasFileUpload } = await import(
	'$lib/server/email/verification'
);
const { RATE_LIMITS } = await import('$lib/server/services/rate-limit');
const { actions: quickActions } = await import(
	'../../../src/routes/(site)/dashboard/issues/quick/+page.server'
);
const { actions: bookbinderActions } = await import(
	'../../../src/routes/(site)/dashboard/bookbinder/[id]/+page.server'
);
const { actions: templateActions } = await import(
	'../../../src/routes/(site)/dashboard/template/+page.server'
);
const { actions: settingsActions } = await import(
	'../../../src/routes/(site)/dashboard/settings/+page.server'
);
const { load: confirmPayoutLoad } = await import(
	'../../../src/routes/(site)/dashboard/settings/confirm-payout/+page.server'
);
const { actions: dashboardActions } = await import('../../../src/routes/(site)/dashboard/+page.server');
const { load: dashboardLayoutLoad } = await import(
	'../../../src/routes/(site)/dashboard/+layout.server'
);

const { seedDatabase } = await import('$lib/server/seed');

const PASSWORD = 'gate-band-password-123';

// Creates the schema on a fresh database.
beforeAll(async () => {
	await seedDatabase();
});
const createdUserIds: string[] = [];

afterEach(async () => {
	state.override = null;
	vi.restoreAllMocks();
	while (createdUserIds.length > 0) {
		await db.delete(schema.users).where(eq(schema.users.id, createdUserIds.pop()!));
	}
});

beforeEach(() => {
	// Keep the console stand-in email quiet.
	vi.spyOn(console, 'info').mockImplementation(() => undefined);
	vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

async function createArtist(emailVerified: boolean) {
	const userId = crypto.randomUUID();
	const artistId = crypto.randomUUID();
	const suffix = crypto.randomBytes(4).toString('hex');
	const token = `test_gate_${crypto.randomUUID()}`;
	const now = new Date();
	createdUserIds.push(userId);

	await db.insert(schema.users).values({
		id: userId,
		name: `Gate Band ${suffix}`,
		email: `gate-${suffix}@example.com`,
		emailVerified,
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
		slug: `gate-band-${suffix}`,
		displayName: `Gate Band ${suffix}`,
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
	const cookie = `better-auth.session_token=${token}.${await makeSignature(token, authSecret)}`;
	return { userId, artistId, slug: `gate-band-${suffix}`, email: `gate-${suffix}@example.com`, cookie };
}

async function createDraftIssue(artistId: string) {
	const id = crypto.randomUUID();
	const now = new Date();
	await db.insert(schema.issues).values({
		id,
		artistId,
		slug: `gate-issue-${crypto.randomBytes(4).toString('hex')}`,
		city: 'Austin',
		venue: 'Mohawk',
		date: '2031-03-14',
		timezone: 'America/Chicago',
		secretKey: crypto.randomBytes(16).toString('hex'),
		status: 'draft',
		createdAt: now,
		updatedAt: now
	});
	return id;
}

function post(url: string, cookie: string, fields: Record<string, string | File>) {
	const form = new FormData();
	for (const [key, value] of Object.entries(fields)) form.set(key, value);
	return new Request(url, { method: 'POST', headers: { cookie }, body: form });
}

const png = () =>
	new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'gig.png', { type: 'image/png' });

type ActionResult = { status?: number; data?: Record<string, unknown> } & Record<string, unknown>;

async function run(action: (event: never) => unknown, event: Record<string, unknown>) {
	try {
		return (await action(event as never)) as ActionResult;
	} catch (thrown) {
		return { thrown } as ActionResult;
	}
}

const quickFields = {
	city: 'Austin',
	venue: 'Mohawk',
	date: '2031-03-14',
	timezone: 'America/Chicago'
};

describe('formHasFileUpload', () => {
	it('sees non-empty files only', () => {
		const form = new FormData();
		form.set('photoUrl', 'https://example.com/a.png');
		form.set('photoFile', new File([], 'empty.png'));
		expect(formHasFileUpload(form)).toBe(false);
		form.set('photoFile', png());
		expect(formHasFileUpload(form)).toBe(true);
	});
});

describe('unconfirmed artists', () => {
	it('cannot publish a Quick Issue', async () => {
		const artist = await createArtist(false);
		const url = new URL('http://localhost:5173/dashboard/issues/quick');
		const res = await run(quickActions.default, {
			request: post(url.toString(), artist.cookie, { ...quickFields, saveMode: 'published' }),
			url
		});
		expect(res.status).toBe(403);
		expect(res.data?.error).toBe(EMAIL_CONFIRMATION_REQUIRED.publish);
		const issues = await db.query.issues.findMany({ where: eq(schema.issues.artistId, artist.artistId) });
		expect(issues).toHaveLength(0);
	});

	it('cannot upload with a Quick Issue draft, but can save a draft without files', async () => {
		const artist = await createArtist(false);
		const url = new URL('http://localhost:5173/dashboard/issues/quick');
		const upload = await run(quickActions.default, {
			request: post(url.toString(), artist.cookie, { ...quickFields, saveMode: 'draft', photoFile: png() }),
			url
		});
		expect(upload.status).toBe(403);
		expect(upload.data?.error).toBe(EMAIL_CONFIRMATION_REQUIRED.upload);

		const draft = await run(quickActions.default, {
			request: post(url.toString(), artist.cookie, { ...quickFields, saveMode: 'draft' }),
			url
		});
		expect((draft.thrown as { status: number }).status).toBe(303);
	});

	it('cannot publish from the Bookbinder or upload a photo there', async () => {
		const artist = await createArtist(false);
		const issueId = await createDraftIssue(artist.artistId);
		const base = `http://localhost:5173/dashboard/bookbinder/${issueId}`;

		const publish = await run(bookbinderActions.save, {
			request: post(`${base}?/save`, artist.cookie, { status: 'published' }),
			params: { id: issueId }
		});
		expect(publish.status).toBe(403);
		expect(publish.data?.error).toBe(EMAIL_CONFIRMATION_REQUIRED.publish);
		const stored = await db.query.issues.findFirst({ where: eq(schema.issues.id, issueId) });
		expect(stored?.status).toBe('draft');

		const upload = await run(bookbinderActions.addPage, {
			request: post(`${base}?/addPage`, artist.cookie, { kind: 'photo', photoFile: png() }),
			params: { id: issueId }
		});
		expect(upload.status).toBe(403);
		expect(upload.data?.error).toBe(EMAIL_CONFIRMATION_REQUIRED.upload);

		const textPage = await run(bookbinderActions.addPage, {
			request: post(`${base}?/addPage`, artist.cookie, { kind: 'text', title: 'Hello' }),
			params: { id: issueId }
		});
		expect(textPage).toMatchObject({ success: true });
	});

	it('cannot upload Master Template cover art', async () => {
		const artist = await createArtist(false);
		const res = await run(templateActions.saveTemplate, {
			request: post('http://localhost:5173/dashboard/template?/saveTemplate', artist.cookie, {
				coverArtFile: png()
			})
		});
		expect(res.status).toBe(403);
		expect(res.data?.error).toBe(EMAIL_CONFIRMATION_REQUIRED.upload);
	});

	it('cannot start Stripe Connect onboarding', async () => {
		const artist = await createArtist(false);
		const url = new URL('http://localhost:5173/dashboard/settings?/requestPayoutChange');
		const res = await run(settingsActions.requestPayoutChange, {
			request: post(url.toString(), artist.cookie, { action: 'connect', confirmPassword: PASSWORD }),
			url
		});
		expect(res.status).toBe(403);
		expect(res.data?.payoutError).toBe(EMAIL_CONFIRMATION_REQUIRED.payouts);
		const tokens = await db.query.payoutChangeTokens.findMany({
			where: eq(schema.payoutChangeTokens.artistId, artist.artistId)
		});
		expect(tokens).toHaveLength(0);
	});

	it('cannot use a confirm-payout link for onboarding, and the link is not used up', async () => {
		const artist = await createArtist(false);
		const rawToken = crypto.randomBytes(32).toString('hex');
		const tokenId = crypto.randomUUID();
		await db.insert(schema.payoutChangeTokens).values({
			id: tokenId,
			artistId: artist.artistId,
			userId: artist.userId,
			tokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'),
			action: 'connect',
			status: 'pending',
			expiresAt: new Date(Date.now() + 60 * 60 * 1000),
			createdAt: new Date()
		});
		const url = new URL(`http://localhost:5173/dashboard/settings/confirm-payout?token=${rawToken}`);
		const res = (await confirmPayoutLoad({
			request: new Request(url, { headers: { cookie: artist.cookie } }),
			url
		} as never)) as { status: string; errorCode: string; errorMessage: string };
		expect(res).toMatchObject({
			status: 'error',
			errorCode: 'EMAIL_NOT_CONFIRMED',
			errorMessage: EMAIL_CONFIRMATION_REQUIRED.payouts
		});
		const token = await db.query.payoutChangeTokens.findFirst({
			where: eq(schema.payoutChangeTokens.id, tokenId)
		});
		expect(token?.status).toBe('pending');
	});
});

describe('confirmed artists', () => {
	it('can publish a Quick Issue (verified uploads are covered in p4-zine-builder)', async () => {
		const artist = await createArtist(true);
		const url = new URL('http://localhost:5173/dashboard/issues/quick');
		const res = await run(quickActions.default, {
			request: post(url.toString(), artist.cookie, { ...quickFields, saveMode: 'published' }),
			url
		});
		expect(res).toMatchObject({ success: true });
	});

	it('can publish from the Bookbinder', async () => {
		const artist = await createArtist(true);
		const issueId = await createDraftIssue(artist.artistId);
		const res = await run(bookbinderActions.save, {
			request: post(`http://localhost:5173/dashboard/bookbinder/${issueId}?/save`, artist.cookie, {
				status: 'published'
			}),
			params: { id: issueId }
		});
		expect(res).toMatchObject({ success: true });
		const stored = await db.query.issues.findFirst({ where: eq(schema.issues.id, issueId) });
		expect(stored?.status).toBe('published');
	});

	it('can start Stripe Connect onboarding (confirmation email goes out)', async () => {
		const artist = await createArtist(true);
		const url = new URL('http://localhost:5173/dashboard/settings?/requestPayoutChange');
		const res = await run(settingsActions.requestPayoutChange, {
			request: post(url.toString(), artist.cookie, { action: 'connect', confirmPassword: PASSWORD }),
			url
		});
		expect(res).toMatchObject({ payoutConfirmationSent: true });
	});
});

describe('confirm-your-email bar', () => {
	it('the dashboard layout reports the status for unconfirmed artists', async () => {
		const status = (await dashboardLayoutLoad({
			locals: { user: { id: 'u', email: 'band@example.com', emailVerified: false } }
		} as never)) as { emailConfirmation: Record<string, unknown> };
		expect(status.emailConfirmation).toMatchObject({
			email: 'band@example.com',
			confirmed: false,
			canResend: true,
			unavailableMessage: null
		});
	});

	it('disables resend with an honest message when email is off (tier 2)', async () => {
		state.override = (base) => ({
			...base,
			features: { ...base.features, email: false },
			live: { ...base.live, email: false }
		});
		const status = (await dashboardLayoutLoad({
			locals: { user: { id: 'u', email: 'band@example.com', emailVerified: false } }
		} as never)) as { emailConfirmation: Record<string, unknown> };
		expect(status.emailConfirmation).toMatchObject({
			canResend: false,
			unavailableMessage: "We can't send email right now."
		});

		const artist = await createArtist(false);
		const res = await run(dashboardActions.resendVerification, {
			request: post('http://localhost:5173/dashboard?/resendVerification', artist.cookie, {})
		});
		expect(res.status).toBe(503);
	});

	it('the resend action is rate-limited per artist', async () => {
		const artist = await createArtist(false);
		const resend = () =>
			run(dashboardActions.resendVerification, {
				request: post('http://localhost:5173/dashboard?/resendVerification', artist.cookie, {})
			});

		for (let i = 0; i < RATE_LIMITS.verificationResendUser.max; i++) {
			expect(await resend()).toMatchObject({ verificationEmailSent: true });
		}
		const over = await resend();
		expect(over.status).toBe(429);
		expect(over.data?.accountError).toBe(RATE_LIMITS.verificationResendUser.message);
	});
});
