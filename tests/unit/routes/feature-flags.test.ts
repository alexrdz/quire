import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import LoginPage from '../../../src/routes/(site)/login/+page.svelte';
import ResetPage from '../../../src/routes/(site)/login/reset/+page.svelte';
import FeatureNotice from '$lib/components/site/FeatureNotice.svelte';
import PhotoPileEditor from '$lib/components/dashboard/PhotoPileEditor.svelte';
import { FEATURE_UNAVAILABLE } from '$lib/features';
import { ALL_FEATURES_ON, featuresWith } from '../helpers/features';

/** The opening tag of the first button with this class. */
const buttonTag = (html: string, cls: string) =>
	html.match(new RegExp(`<button[^>]*\\b${cls}\\b[^>]*>`))?.[0] ?? '';

const loginData = {
	redirectTo: '/dashboard',
	hasExplicitRedirect: false,
	resetSuccess: false,
	accountClosed: false
};

describe('tier-2 feature notices (ADR 0007)', () => {
	it('renders the standard message for each feature', () => {
		for (const feature of ['payments', 'email', 'fanSignIn', 'uploads'] as const) {
			const html = render(FeatureNotice, { props: { feature, mode: 'production' } }).html;
			expect(html).toContain(FEATURE_UNAVAILABLE[feature]);
			expect(html).toContain('role="status"');
		}
	});

	it('replaces the Google button when Fan sign-in is off', () => {
		const on = render(LoginPage, {
			props: { data: { ...loginData, features: ALL_FEATURES_ON, defaultRole: 'fan', initialMode: 'login' }, form: null }
		}).html;
		expect(on).toContain('Continue with Google');

		const off = render(LoginPage, {
			props: {
				data: { ...loginData, features: featuresWith({ fanSignIn: false }), defaultRole: 'fan', initialMode: 'login' },
				form: null
			}
		}).html;
		expect(off).not.toContain('Continue with Google');
		expect(off).toContain(FEATURE_UNAVAILABLE.fanSignIn);
	});

	it('blocks artist signup when email is off', () => {
		const off = render(LoginPage, {
			props: {
				data: { ...loginData, features: featuresWith({ email: false }), defaultRole: 'artist', initialMode: 'signup' },
				form: null
			}
		}).html;
		expect(off).toContain(FEATURE_UNAVAILABLE.email);
		expect(buttonTag(off, 'btn-band-submit')).toContain('disabled');

		// Signing in to an existing account does not need email.
		const login = render(LoginPage, {
			props: {
				data: { ...loginData, features: featuresWith({ email: false }), defaultRole: 'artist', initialMode: 'login' },
				form: null
			}
		}).html;
		expect(buttonTag(login, 'btn-band-submit')).not.toContain('disabled');
	});

	it('uses Demo copy for email in the Demo', () => {
		const html = render(LoginPage, {
			props: {
				data: {
					...loginData,
					features: featuresWith({ email: false, mode: 'demo' }),
					defaultRole: 'artist',
					initialMode: 'signup'
				},
				form: null
			}
		}).html;
		expect(html).toContain('turned off in the Demo');
	});

	it('blocks password reset requests when email is off', () => {
		const html = render(ResetPage, {
			props: { data: { features: featuresWith({ email: false }), mode: 'request', token: '', tokenError: null }, form: null }
		}).html;
		expect(html).toContain(FEATURE_UNAVAILABLE.email);
		expect(buttonTag(html, 'btn-reset-submit')).toContain('disabled');
	});

	it('disables photo uploads but keeps URL entry when uploads are off', () => {
		const html = render(PhotoPileEditor, {
			props: { pageId: 'p1', initial: [], uploadsEnabled: false, mode: 'production' }
		}).html;
		expect(html).toMatch(/type="file"[^>]*disabled/);
		expect(html).toContain(FEATURE_UNAVAILABLE.uploads);

		const on = render(PhotoPileEditor, { props: { pageId: 'p1', initial: [] } }).html;
		expect(on).not.toMatch(/type="file"[^>]*disabled/);
	});
});
