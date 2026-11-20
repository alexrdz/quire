import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	ssr: {
		external: ['@opentelemetry/api']
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}', 'tests/unit/**/*.{test,spec}.{js,ts}'],
		// The test database is created by the drizzle migrations (PRODUCTION_PLAN 3.5).
		globalSetup: ['tests/setup/migrate-test-db.ts'],
		fileParallelism: false
	}
});
