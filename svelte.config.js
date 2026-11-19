import adapter from '@sveltejs/adapter-netlify';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Netlify Functions (Node), one function for the whole app (PRODUCTION_PLAN 3.4).
		adapter: adapter({ edge: false, split: false }),
		// SvelteKit only adds the nonce (or hash) for its inline hydration script here.
		// hooks.server.ts keeps this script-src and builds every other directive at
		// runtime, since the R2 media origin is a deploy variable
		// (src/lib/server/http/security-headers.ts).
		csp: {
			mode: 'auto',
			directives: {
				'script-src': ['self']
			}
		},
		alias: {
			$domain: 'src/lib/domain',
			$schemas: 'src/lib/schemas'
		}
	}
};

export default config;
