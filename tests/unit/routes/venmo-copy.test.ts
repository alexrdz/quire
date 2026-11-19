import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import HomePage from '../../../src/routes/(site)/+page.svelte';
import FaqPage from '../../../src/routes/(site)/faq/+page.svelte';
import TermsPage from '../../../src/routes/(site)/legal/terms/+page.svelte';
import PrivacyPage from '../../../src/routes/(site)/legal/privacy/+page.svelte';
import ZineSimulator from '$lib/components/landing/ZineSimulator.svelte';

/** Public copy after the Venmo pivot (ADR 0008, PRODUCTION_PLAN V.5). */
const text = (html: string) =>
	html
		.replace(/<[^>]+>/g, ' ')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&amp;/g, '&')
		.replace(/\s+/g, ' ');

const pages = {
	home: () => text(render(HomePage).body),
	faq: () => text(render(FaqPage).body),
	terms: () => text(render(TermsPage).body),
	privacy: () => text(render(PrivacyPage).body),
	simulator: () => text(render(ZineSimulator).body)
};

const STALE = [/stripe/i, /apple pay/i, /google pay/i, /5% platform/i, /platform fee/i, /payout/i, /chargeback/i, /thank you for (your payment|sending)/i];

describe('public copy after the Venmo pivot', () => {
	it.each(Object.keys(pages) as (keyof typeof pages)[])('%s has no Stripe, card, fee or payout copy', (name) => {
		const body = pages[name]();
		for (const pattern of STALE) {
			expect(body, `${name} matches ${pattern}`).not.toMatch(pattern);
		}
	});

	it('home works with Venmo: tips land in the artist\'s Venmo, no cut, Quire brings the people', () => {
		const body = pages.home();
		expect(body).toContain('Your Venmo QR collects tips.');
		expect(body).toContain('Quire brings the people too.');
		expect(body).toMatch(/Tips Straight to Your Venmo/);
		expect(body).toMatch(/Quire takes no cut/);
		expect(body).toMatch(/Quire never touches the money/);
		expect(body).toContain('More Than a Venmo Sign');
		expect(body).toContain('Just a Venmo QR / Link in Bio');
		// Venmo itself is never knocked as a payment method, and Quire never claims to track payments.
		expect(body).not.toMatch(/clinical bank app/i);
		expect(body).not.toMatch(/Dumped Venmo/i);
		expect(body).not.toMatch(/instant payouts?/i);
		expect(body).not.toMatch(/(confirms?|tracks?) (your )?payments?/i);
	});

	it('FAQ covers where the money goes, no cut, Venmo terms and refunds in Venmo', () => {
		const body = pages.faq();
		expect(body).toMatch(/straight to the artist's Venmo/i);
		expect(body).toMatch(/never handles the money and takes no cut/i);
		expect(body).toMatch(/Venmo's terms/i);
		expect(body).toMatch(/refunds and any problems with a payment are between you and the artist in Venmo/i);
		expect(body).toMatch(/check Venmo for what came in/i);
	});

	it('terms say Quire does not process payments, takes no cut, and refunds are in Venmo', () => {
		const body = pages.terms();
		expect(body).toMatch(/Quire does not process payments/);
		expect(body).toMatch(/takes no cut/);
		expect(body).toMatch(/governed by Venmo's terms/);
		expect(body).toMatch(/between the fan and the artist in Venmo/);
		expect(body).toMatch(/A tap is not a payment/);
	});

	it('privacy records only the tap, no fan identity, and warns Venmo payments may be public', () => {
		const body = pages.privacy();
		expect(body).toMatch(/record only that it was tapped/);
		expect(body).toMatch(/do not record who tapped/);
		expect(body).toMatch(/Venmo payment and its note may be public/);
		expect(body).toMatch(/never the venue, city or date/);
	});
});
