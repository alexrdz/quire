import { defineConfig } from 'drizzle-kit';

const isTurso = Boolean(process.env.DATABASE_AUTH_TOKEN);

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: isTurso ? 'turso' : 'sqlite',
	dbCredentials: isTurso
		? {
				url: process.env.DATABASE_URL || 'file:sqlite.db',
				authToken: process.env.DATABASE_AUTH_TOKEN
			}
		: {
				url: process.env.DATABASE_URL || 'file:sqlite.db'
			}
});
