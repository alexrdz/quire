import crypto from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { makeSignature, verifyPassword } from 'better-auth/crypto';
import { and, eq } from 'drizzle-orm';
import { db, schema } from './db';
import { sendPasswordResetEmail, sendVerificationEmail } from './email';

try {
	process.loadEnvFile?.('.env');
} catch {}

export const authSecret =
	process.env.BETTER_AUTH_SECRET ||
	'quire_development_secret_at_least_32_characters_long';

const baseAuthUrl =
	process.env.BETTER_AUTH_URL || process.env.PUBLIC_APP_URL || 'http://localhost:5173';

export const auth = betterAuth({
	baseURL: baseAuthUrl,
	secret: authSecret,
	database: drizzleAdapter(db, {
		provider: 'sqlite',
		usePlural: true,
		schema: {
			users: schema.users,
			sessions: schema.sessions,
			accounts: schema.accounts,
			verifications: schema.verifications
		}
	}),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false,
		async sendResetPassword({ user, url }) {
			const receipt = await sendPasswordResetEmail({
				to: user.email,
				artistName: user.name || 'Artist',
				resetUrl: url
			});
			if (!receipt.ok) {
				throw new Error(receipt.error.message);
			}
		}
	},
	emailVerification: {
		sendOnSignUp: true,
		autoSignInAfterVerification: true,
		async sendVerificationEmail({ user, url }) {
			const receipt = await sendVerificationEmail({
				to: user.email,
				artistName: user.name || 'Artist',
				verificationUrl: url
			});
			if (!receipt.ok) {
				throw new Error(receipt.error.message);
			}
		}
	},
	socialProviders: {
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID || 'mock_google_client_id',
			clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'mock_google_client_secret',
			enabled: true
		}
	},
	user: {
		additionalFields: {
			accountType: {
				type: 'string',
				required: false,
				defaultValue: 'fan',
				input: true
			}
		}
	},
	experimental: {
		instrumentation: {
			enabled: false
		}
	}
});

export async function createSessionForUser(cookies: Cookies, userId: string): Promise<string> {
	const sessionToken = `session_${crypto.randomUUID()}`;
	const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
	const now = new Date();

	await db.insert(schema.sessions).values({
		id: crypto.randomUUID(),
		userId,
		token: sessionToken,
		expiresAt,
		createdAt: now,
		updatedAt: now
	});

	const signature = await makeSignature(sessionToken, authSecret);
	const signedCookie = `${sessionToken}.${signature}`;

	cookies.set('better-auth.session_token', signedCookie, {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 7
	});

	return sessionToken;
}

export async function clearSessionCookie(cookies: Cookies): Promise<void> {
	const existing = cookies.get('better-auth.session_token');
	if (existing) {
		const rawToken = existing.split('.')[0];
		if (rawToken) {
			try {
				await db.delete(schema.sessions).where(eq(schema.sessions.token, rawToken));
			} catch {}
		}
	}
	cookies.delete('better-auth.session_token', { path: '/' });
}

/**
 * Verifies a user's current credential password (required by SPEC 6.4 before
 * modifying payout account details on a shared artist login).
 */
export async function verifyUserCredentialPassword(
	userId: string,
	password: string
): Promise<boolean> {
	if (!userId || !password) {
		return false;
	}

	const credentialAccount = await db.query.accounts.findFirst({
		where: and(
			eq(schema.accounts.userId, userId),
			eq(schema.accounts.providerId, 'credential')
		)
	});

	if (!credentialAccount?.password) {
		return false;
	}

	return verifyPassword({
		hash: credentialAccount.password,
		password
	});
}

export type Auth = typeof auth;
