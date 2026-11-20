import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { demoBannerData, parseConfig, resetConfigForTests, runningOnNetlify, type Env } from '$lib/server/config';
import { featureUnavailableMessage, FEATURE_UNAVAILABLE } from '$lib/features';
import { DEMO_SIGNUP_LABEL } from '$lib/components/site/demo-banner';
import { featuresWith } from '../helpers/features';
import { load as rootLayoutLoad } from '../../../src/routes/+layout.server';
import InRootLayout from '../helpers/InRootLayout.svelte';

/**
 * PRODUCTION_PLAN 4.2 (P4L-T06): the Demo as a Netlify site.
 * - Uploads: the local static/uploads stand-in can't work on Netlify (read-only,
 *   per-invocation disk). A Demo there without R2 keys has uploads off with the
 *   honest message, never a 500. With R2 keys it uses R2. A local Demo (the e2e
 *   server) keeps local storage.
 * - The banner links to the real sign-up only when PUBLIC_PRODUCTION_URL is set.
 */

const DEMO: Env = {
	DEMO_MODE: 'true',
	BETTER_AUTH_SECRET: 'a'.repeat(40),
	COOKIE_SECRET: 'b'.repeat(40),
	DATABASE_URL: 'libsql://quire-demo.turso.io',
	DATABASE_AUTH_TOKEN: 'token',
	BETTER_AUTH_URL: 'https://demo.quire.live'
};
const R2: Env = { R2_ACCOUNT_ID: 'acct', R2_ACCESS_KEY_ID: 'key', R2_SECRET_ACCESS_KEY: 'secret' };

afterEach(() => {
	vi.unstubAllEnvs();
	resetConfigForTests();
});

describe('Demo uploads on Netlify', () => {
	it.each(['NETLIFY', 'CONTEXT', 'DEPLOY_URL', 'SITE_ID'])('%s set means running on Netlify', (name) => {
		expect(runningOnNetlify({ [name]: 'x' })).toBe(true);
	});

	it('no Netlify variables means a local process', () => {
		expect(runningOnNetlify({})).toBe(false);
	});

	it('the Demo on Netlify without R2 keys: uploads are off', () => {
		const config = parseConfig({ ...DEMO, NETLIFY: 'true' });
		expect(config.core.ok).toBe(true);
		expect(config.features.uploads).toBe(false);
		expect(config.localUploads).toBe('none');
	});

	it('inside a Netlify function, where SITE_ID is the only Netlify marker: uploads are off', () => {
		// At function runtime Netlify sets only URL, SITE_NAME and SITE_ID; NETLIFY is build-only.
		const config = parseConfig({ ...DEMO, URL: 'https://demo.quire.live', SITE_NAME: 'quire-demo', SITE_ID: 'site-id' });
		expect(config.features.uploads).toBe(false);
	});

	it('the Demo on Netlify with R2 keys: uploads are live on R2', () => {
		const config = parseConfig({ ...DEMO, ...R2, NETLIFY: 'true' });
		expect(config.features.uploads).toBe(true);
		expect(config.live.uploads).toBe(true);
	});

	it('a local Demo (the e2e server) keeps the local stand-in', () => {
		const config = parseConfig({ DEMO_MODE: 'true', QUIRE_E2E_LOCAL_PREVIEW: 'true', DATABASE_URL: 'file:x.db', BETTER_AUTH_URL: 'http://localhost:4174' });
		expect(config.features.uploads).toBe(true);
		expect(config.localUploads).toBe('local');
	});

	it('development and test keep local uploads; production never has them', () => {
		expect(parseConfig({ NODE_ENV: 'development' }).features.uploads).toBe(true);
		expect(parseConfig({ NODE_ENV: 'test' }).features.uploads).toBe(true);
		expect(parseConfig({ NODE_ENV: 'production' }).localUploads).toBe('none');
		expect(parseConfig({ NODE_ENV: 'production' }).features.uploads).toBe(false);
	});

	it('the message is honest about the Demo', () => {
		expect(featureUnavailableMessage('uploads', 'demo')).toBe(
			'Uploads are turned off in this Demo. You can still paste an image URL or embed.'
		);
		expect(featureUnavailableMessage('uploads', 'production')).toBe(FEATURE_UNAVAILABLE.uploads);
	});

	it('an upload on the Netlify Demo returns that message as an error result, never a throw', async () => {
		// The real getConfig(): Vitest's VITEST variable would force test mode.
		vi.stubEnv('VITEST', '');
		vi.stubEnv('NODE_ENV', 'production');
		for (const [name, value] of Object.entries(DEMO)) vi.stubEnv(name, value!);
		// What a Netlify function sees (NETLIFY is set only during builds).
		vi.stubEnv('SITE_ID', 'site-id');
		resetConfigForTests();

		const { uploadFormFile, uploadMedia } = await import('$lib/server/services/storage');
		const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'a.png', { type: 'image/png' });
		const expected = {
			ok: false,
			error: { code: 'UPLOADS_UNAVAILABLE', message: featureUnavailableMessage('uploads', 'demo') }
		};
		expect(await uploadFormFile(png, { kind: 'image' })).toEqual(expected);
		expect(await uploadMedia({ buffer: Buffer.from('x') })).toEqual(expected);
	});
});

describe('the Demo banner sign-up link (PUBLIC_PRODUCTION_URL)', () => {
	it('is the production origin sign-up page, or nothing', () => {
		expect(parseConfig({ ...DEMO, PUBLIC_PRODUCTION_URL: 'https://quire.live/some/path' }).productionUrl).toBe('https://quire.live');
		expect(parseConfig({ ...DEMO, PUBLIC_PRODUCTION_URL: 'not a url' }).productionUrl).toBeNull();
		expect(parseConfig(DEMO).productionUrl).toBeNull();
		expect(demoBannerData(undefined)).toEqual({});
	});

	async function layoutData(mode: 'demo' | 'production' | 'test') {
		return (await rootLayoutLoad({ locals: { features: featuresWith({ mode }) } } as never)) as {
			demoSignupUrl?: string;
		};
	}

	it('the root layout passes it in the Demo when set', async () => {
		vi.stubEnv('PUBLIC_PRODUCTION_URL', 'https://quire.live');
		resetConfigForTests();
		expect((await layoutData('demo')).demoSignupUrl).toBe('https://quire.live/login?mode=signup');
		// Never outside the Demo.
		expect((await layoutData('production')).demoSignupUrl).toBeUndefined();
		expect((await layoutData('test')).demoSignupUrl).toBeUndefined();
	});

	it('no link when it is unset', async () => {
		vi.stubEnv('PUBLIC_PRODUCTION_URL', '');
		resetConfigForTests();
		expect((await layoutData('demo')).demoSignupUrl).toBeUndefined();
	});

	it('the banner in the root layout shows the link only with a URL', () => {
		const features = featuresWith({ mode: 'demo' });
		const withLink = render(InRootLayout, {
			props: { features, text: 'Page', demoSignupUrl: 'https://quire.live/login?mode=signup' }
		}).body;
		expect(withLink).toContain('href="https://quire.live/login?mode=signup"');
		expect(withLink).toContain(DEMO_SIGNUP_LABEL);

		const without = render(InRootLayout, { props: { features, text: 'Page' } }).body;
		expect(without).toContain('data-testid="demo-banner"');
		expect(without).not.toContain(DEMO_SIGNUP_LABEL);
	});
});
