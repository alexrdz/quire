import { defineConfig } from 'drizzle-kit';

try {
	process.loadEnvFile?.('.env');
} catch {}

const databaseUrl = process.env.DATABASE_URL || 'file:local.db';
const authToken = process.env.DATABASE_AUTH_TOKEN;
const isTurso = Boolean(authToken && !databaseUrl.startsWith('file:'));

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: isTurso ? 'turso' : 'sqlite',
	dbCredentials: isTurso
		? {
				url: databaseUrl,
				authToken: authToken!
			}
		: {
				url: databaseUrl
			}
});
