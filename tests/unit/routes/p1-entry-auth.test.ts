import crypto from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { eq, like } from 'drizzle-orm';
import { render } from 'svelte/server';
import { db, schema } from '$lib/server/db';
import { auth } from '$lib/server/auth';
import LandingPage from '../../../src/routes/(site)/+page.svelte';
import LoginPage from '../../../src/routes/(site)/login/+page.svelte';
import ResetPage from '../../../src/routes/(site)/login/reset/+page.svelte';
import {
	actions as loginActions,
	load as loginLoad
} from '../../../src/routes/(site)/login/+page.server';
import {
	actions as resetActions,
	load as resetLoad
} from '../../../src/routes/(site)/login/reset/+page.server';

const createdUserIds: string[] = [];
const createdVerificationIds: string[] = [];

function createMockCookies() {
	const store = new Map<string, string>();
	return {
		store,
		get: (name: string) => store.get(name),
		getAll: () => Array.from(store.entries()).map(([name, value]) => ({ name, value })),
		set: (name: string, value: string) => {
			store.set(name, value);
		},
		delete: (name: string) => {
			store.delete(name);
		},
		serialize: (name: string, value: string) => `${name}=${value}`
	};
}

function buildPostRequest(url: string, fields: Record<string, string>): Request {
	const formData = new FormData();
	for (const [k, v] of Object.entries(fields)) {
		formData.set(k, v);
	}
	return new Request(url, {
		method: 'POST',
		body: formData
	});
}

function extractRedirect(thrown: unknown): { status: number; location: string } | null {
	if (
		typeof thrown === 'object' &&
		thrown !== null &&
		'status' in thrown &&
		'location' in thrown
	) {
		const rec = thrown as { status: number; location: string };
		return { status: rec.status, location: rec.location };
	}
	return null;
}

afterEach(async () => {
	while (createdUserIds.length > 0) {
		const userId = createdUserIds.pop();
		if (!userId) continue;
		await db.delete(schema.artists).where(eq(schema.artists.userId, userId));
		await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
		await db.delete(schema.accounts).where(eq(schema.accounts.userId, userId));
		await db.delete(schema.users).where(eq(schema.users.id, userId));
	}
	while (createdVerificationIds.length > 0) {
		const id = createdVerificationIds.pop();
		if (!id) continue;
		await db.delete(schema.verifications).where(eq(schema.verifications.id, id));
	}
});

describe('P1 Landing Page', () => {
	it('routes sign-up CTAs to /login?mode=signup and removes /demo links', () => {
		const res = render(LandingPage);
		expect(res.html).not.toContain('href="/demo"');
		expect(res.html).toContain('href="/login?mode=signup"');
		expect(res.html).toContain('Claim Band Zine');
		expect(res.html).toContain('Claim Your Tour Zine');
		expect(res.html).toContain('Create Your Free Zine');
		expect(res.html).toContain('Artist Sign In');
		expect(res.html).toContain('href="/i/neon-velvet-brooklyn-2026-10-12"');
		expect(res.html).toContain('href="/a/the-neon-velvet"');
	});
});

describe('P1 /login page & server actions', () => {
	it('detects mode=signup and reset=success in load', async () => {
		const signupRes = (await loginLoad({
			request: new Request('http://localhost:5173/login?mode=signup'),
			url: new URL('http://localhost:5173/login?mode=signup')
		} as unknown as Parameters<typeof loginLoad>[0])) as Record<string, unknown>;

		expect(signupRes.initialMode).toBe('signup');
		expect(signupRes.resetSuccess).toBe(false);

		const resetRes = (await loginLoad({
			request: new Request('http://localhost:5173/login?reset=success'),
			url: new URL('http://localhost:5173/login?reset=success')
		} as unknown as Parameters<typeof loginLoad>[0])) as Record<string, unknown>;

		expect(resetRes.initialMode).toBe('login');
		expect(resetRes.resetSuccess).toBe(true);
	});

	it('renders live slug field in signup mode and Forgot password link + reset banner in login mode', () => {
		const signupHtml = render(LoginPage, {
			props: {
				data: {
					redirectTo: '/dashboard',
					hasExplicitRedirect: false,
					defaultRole: 'artist',
					initialMode: 'signup',
					resetSuccess: false,
					accountClosed: false
				},
				form: null
			}
		}).html;

		expect(signupHtml).toContain('Create Band Account');
		expect(signupHtml).toContain('name="slug"');
		expect(signupHtml).toContain('/a/');

		const loginHtml = render(LoginPage, {
			props: {
				data: {
					redirectTo: '/dashboard',
					hasExplicitRedirect: false,
					defaultRole: 'artist',
					initialMode: 'login',
					resetSuccess: true,
					accountClosed: false
				},
				form: null
			}
		}).html;

		expect(loginHtml).toContain('href="/login/reset"');
		expect(loginHtml).toContain('Forgot password?');
		expect(loginHtml).toContain('Password updated');
	});

	it('creates artist with clean slug (no random 3-digit suffix) and redirects to /dashboard?onboarding=1', async () => {
		const uniqueSuffix = crypto.randomUUID().slice(0, 8);
		const slug = `velvet-echo-${uniqueSuffix}`;
		const email = `velvet-echo-${uniqueSuffix}@example.com`;
		const cookies = createMockCookies();

		let redirectInfo: { status: number; location: string } | null = null;
		try {
			await loginActions.signup({
				request: buildPostRequest('http://localhost:5173/login?/signup', {
					name: 'Velvet Echo',
					slug,
					email,
					password: 'band-password-123'
				}),
				url: new URL('http://localhost:5173/login?/signup'),
				cookies
			} as unknown as Parameters<typeof loginActions.signup>[0]);
		} catch (thrown) {
			redirectInfo = extractRedirect(thrown);
		}

		expect(redirectInfo).toEqual({ status: 303, location: '/dashboard?onboarding=1' });
		expect(cookies.store.get('better-auth.session_token')).toBeTruthy();

		const artist = await db.query.artists.findFirst({
			where: eq(schema.artists.slug, slug)
		});
		expect(artist).toBeDefined();
		expect(artist?.slug).toBe(slug);
		expect(artist?.displayName).toBe('Velvet Echo');

		if (artist) {
			createdUserIds.push(artist.userId);
			const pages = await db.query.templatePages.findMany({
				where: eq(schema.templatePages.artistId, artist.id)
			});
			expect(pages.length).toBe(1);
		}
	});

	it('returns 409 with clean slugSuggestions on slug collision without creating a dangling user', async () => {
		const uniqueSuffix = crypto.randomUUID().slice(0, 8);
		const email = `collision-test-${uniqueSuffix}@example.com`;
		const cookies = createMockCookies();

		// Seeded artist 'the-neon-velvet' already exists
		const result = (await loginActions.signup({
			request: buildPostRequest('http://localhost:5173/login?/signup', {
				name: 'The Neon Velvet',
				slug: 'the-neon-velvet',
				email,
				password: 'band-password-123'
			}),
			url: new URL('http://localhost:5173/login?/signup'),
			cookies
		} as unknown as Parameters<typeof loginActions.signup>[0])) as {
			status: number;
			data: {
				error: string;
				slugSuggestions?: string[];
				values?: { name: string; email: string; slug: string };
			};
		};

		expect(result.status).toBe(409);
		expect(result.data.error).toContain('/a/the-neon-velvet');
		expect(result.data.slugSuggestions?.length).toBeGreaterThan(0);
		expect(result.data.values).toEqual({
			name: 'The Neon Velvet',
			email,
			slug: 'the-neon-velvet'
		});

		const danglingUser = await db.query.users.findFirst({
			where: eq(schema.users.email, email)
		});
		expect(danglingUser).toBeUndefined();
	});
});

describe('P1 /login/reset password reset flow', () => {
	it('handles request and confirm states in load and SSR', async () => {
		const reqLoad = (await resetLoad({
			url: new URL('http://localhost:5173/login/reset')
		} as unknown as Parameters<typeof resetLoad>[0])) as Record<string, unknown>;
		expect(reqLoad.mode).toBe('request');
		expect(reqLoad.tokenError).toBeNull();

		const errLoad = (await resetLoad({
			url: new URL('http://localhost:5173/login/reset?error=INVALID_TOKEN')
		} as unknown as Parameters<typeof resetLoad>[0])) as Record<string, unknown>;
		expect(errLoad.mode).toBe('request');
		expect(errLoad.tokenError).toContain('invalid or has expired');

		const confirmLoad = (await resetLoad({
			url: new URL('http://localhost:5173/login/reset?token=sample-token')
		} as unknown as Parameters<typeof resetLoad>[0])) as Record<string, unknown>;
		expect(confirmLoad.mode).toBe('confirm');
		expect(confirmLoad.token).toBe('sample-token');

		const confirmHtml = render(ResetPage, {
			props: {
				data: { mode: 'confirm', token: 'sample-token', tokenError: null },
				form: null
			}
		}).html;
		expect(confirmHtml).toContain('Choose a New Password');
		expect(confirmHtml).toContain('name="newPassword"');
	});

	it('returns identical non-enumerating success message for existing and unknown emails', async () => {
		const unknownRes = (await resetActions.request({
			request: buildPostRequest('http://localhost:5173/login/reset?/request', {
				email: `nonexistent-${crypto.randomUUID()}@example.com`
			})
		} as unknown as Parameters<typeof resetActions.request>[0])) as {
			sent: boolean;
			message: string;
		};

		expect(unknownRes.sent).toBe(true);
		expect(unknownRes.message).toBe(
			'If an account exists for that email, a reset link has been sent.'
		);
	});

	it('resets password via Better Auth token and redirects to /login?reset=success', async () => {
		const unique = crypto.randomUUID().slice(0, 8);
		const email = `reset-band-${unique}@example.com`;
		const signUpRes = await auth.api.signUpEmail({
			body: {
				email,
				password: 'old-password-123',
				name: 'Reset Band',
				accountType: 'artist'
			}
		});
		expect(signUpRes?.user?.id).toBeTruthy();
		if (signUpRes?.user?.id) {
			createdUserIds.push(signUpRes.user.id);
		}

		// Request password reset so Better Auth writes the reset-password verification record
		const reqResult = (await resetActions.request({
			request: buildPostRequest('http://localhost:5173/login/reset?/request', {
				email
			})
		} as unknown as Parameters<typeof resetActions.request>[0])) as {
			sent: boolean;
			message: string;
		};
		expect(reqResult.sent).toBe(true);

		const verifications = await db
			.select()
			.from(schema.verifications)
			.where(like(schema.verifications.identifier, 'reset-password:%'));
		const matching = verifications.find((v) => v.value === signUpRes.user.id);
		expect(matching).toBeDefined();
		if (matching) {
			createdVerificationIds.push(matching.id);
		}

		const rawToken = matching!.identifier.replace('reset-password:', '');

		let redirectInfo: { status: number; location: string } | null = null;
		try {
			await resetActions.confirm({
				request: buildPostRequest('http://localhost:5173/login/reset?/confirm', {
					token: rawToken,
					newPassword: 'new-password-456',
					confirmPassword: 'new-password-456'
				})
			} as unknown as Parameters<typeof resetActions.confirm>[0]);
		} catch (thrown) {
			redirectInfo = extractRedirect(thrown);
		}

		expect(redirectInfo).toEqual({ status: 303, location: '/login?reset=success' });

		// Verify new password authenticates cleanly
		const loginRes = await auth.api.signInEmail({
			body: {
				email,
				password: 'new-password-456'
			}
		});
		expect(loginRes?.user?.id).toBe(signUpRes.user.id);
	});
});
