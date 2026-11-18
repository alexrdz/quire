import crypto from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeSignature } from 'better-auth/crypto';
import { render } from 'svelte/server';
import { db, schema } from '$lib/server/db';
import { authSecret } from '$lib/server/auth';
import * as logoutRoute from '../../../src/routes/logout/+server';
import ArtistTopNav from '$lib/components/dashboard/ArtistTopNav.svelte';

const createdUserIds: string[] = [];

afterEach(async () => {
	while (createdUserIds.length > 0) {
		await db.delete(schema.users).where(eq(schema.users.id, createdUserIds.pop()!));
	}
});

async function createSession() {
	const userId = crypto.randomUUID();
	const token = `test_logout_${crypto.randomUUID()}`;
	const now = new Date();
	createdUserIds.push(userId);
	await db.insert(schema.users).values({
		id: userId,
		name: 'Logout Fan',
		email: `logout-${crypto.randomBytes(4).toString('hex')}@example.com`,
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
	const signed = `${token}.${await makeSignature(token, authSecret)}`;
	return { token, signed };
}

function cookiesWith(value: string) {
	const store = new Map<string, string>([['better-auth.session_token', value]]);
	return {
		store,
		get: (name: string) => store.get(name),
		delete: (name: string) => {
			store.delete(name);
		}
	};
}

async function postLogout(fields: Record<string, string>, cookies: ReturnType<typeof cookiesWith>, query = '') {
	const body = new URLSearchParams(fields);
	const request = new Request(`http://localhost:5173/logout${query}`, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body
	});
	try {
		await logoutRoute.POST({
			request,
			url: new URL(request.url),
			cookies
		} as unknown as Parameters<typeof logoutRoute.POST>[0]);
	} catch (thrown) {
		return thrown as { status: number; location: string };
	}
	throw new Error('Expected a redirect');
}

describe('/logout is POST-only (PRODUCTION_PLAN 2.2)', () => {
	it('exports no GET handler, so SvelteKit answers GET with 405', () => {
		expect('GET' in logoutRoute).toBe(false);
		expect(typeof logoutRoute.POST).toBe('function');
	});

	it('the POST form signs out and deletes the session', async () => {
		const { token, signed } = await createSession();
		const cookies = cookiesWith(signed);

		const result = await postLogout({}, cookies);

		expect(result).toMatchObject({ status: 303, location: '/' });
		expect(cookies.store.has('better-auth.session_token')).toBe(false);
		const remaining = await db.query.sessions.findFirst({ where: eq(schema.sessions.token, token) });
		expect(remaining).toBeUndefined();
	});

	it('follows a safe redirectTo field back to the Back Page', async () => {
		const { signed } = await createSession();
		const result = await postLogout({ redirectTo: '/a/the-neon-velvet' }, cookiesWith(signed));
		expect(result).toMatchObject({ status: 303, location: '/a/the-neon-velvet' });
	});

	it.each(['//evil.com', '/\\evil.com', '/%5Cevil.com', 'https://evil.com'])(
		'ignores the open-redirect payload %s',
		async (payload) => {
			const { signed } = await createSession();
			expect(await postLogout({ redirectTo: payload }, cookiesWith(signed))).toMatchObject({
				location: '/'
			});
			expect(
				await postLogout({}, cookiesWith(signed), `?redirect=${encodeURIComponent(payload)}`)
			).toMatchObject({ location: '/' });
		}
	);

	it('renders the dashboard sign-out control as a POST form with the same class', () => {
		const { body } = render(ArtistTopNav, {
			props: { artist: { displayName: 'Band', slug: 'band' } }
		});
		expect(body).toMatch(/<form[^>]*method="POST"[^>]*action="\/logout"/);
		expect(body).toMatch(/<button[^>]*type="submit"[^>]*class="btn-nav-ghost[^"]*"/);
		expect(body).not.toContain('href="/logout');
	});
});
