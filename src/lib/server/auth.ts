import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db, schema } from './db';

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'sqlite',
		schema: {
			users: schema.users,
			sessions: schema.sessions,
			accounts: schema.accounts,
			verifications: schema.verifications
		}
	}),
	emailAndPassword: {
		enabled: true
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
	secret: process.env.BETTER_AUTH_SECRET || 'quire_development_secret_at_least_32_characters_long'
});

export type Auth = typeof auth;
