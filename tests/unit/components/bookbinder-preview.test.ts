import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';

// The route the preview renders in: the Bookbinder (an id), or anywhere else.
const route = vi.hoisted(() => ({ params: {} as Record<string, string> }));
vi.mock('$app/state', () => ({ page: route }));

/**
 * B1-T32 (ADR 0011): the Bookbinder preview shows the Stories reader in a 390 by 844
 * phone, scaled to fit the pane, and never lets a tip through.
 */

const { default: BookbinderPreview, PREVIEW_PHONE, TIP_ACTION_SELECTOR, TIP_ACTION_SELECTORS, isVenmoUrl, previewScale } = await import(
	'$lib/components/dashboard/BookbinderPreview.svelte'
);

describe('BookbinderPreview', () => {
	it('is a 390 by 844 phone', () => {
		expect(PREVIEW_PHONE).toEqual({ width: 390, height: 844 });
	});

	it('scales to the tighter of width and height, never up', () => {
		expect(previewScale(390, 844)).toBe(1);
		expect(previewScale(2000, 2000)).toBe(1);
		// Height-bound: a 1280 by 800 window leaves about 700 px for the phone.
		expect(previewScale(408, 700)).toBeCloseTo(700 / 844, 3);
		// Width-bound.
		expect(previewScale(300, 2000)).toBeCloseTo(300 / 390, 3);
		// Before it is measured, and never vanishing.
		expect(previewScale(0, 0)).toBe(1);
		expect(previewScale(10, 10)).toBe(0.25);
	});

	it('treats every preset, the custom amount and any Venmo link as a tip action', () => {
		// The selector is matched against the real tip buttons in bookbinder-preview.spec.ts;
		// here, that it names what they carry: data-amount-cents, and any venmo.com link.
		// bookbinder-preview.spec.ts repeats these two; keep them in step.
		expect(TIP_ACTION_SELECTORS).toEqual(['[data-amount-cents]', 'a[href*="venmo.com"]']);
		expect(TIP_ACTION_SELECTOR).toBe('[data-amount-cents], a[href*="venmo.com"]');
	});

	it('knows a Venmo URL, and only a Venmo URL', () => {
		for (const url of ['https://venmo.com/u/x', 'https://account.venmo.com/pay', '//venmo.com/x?amount=5', new URL('https://VENMO.com/x')]) {
			expect(isVenmoUrl(url as string), String(url)).toBe(true);
		}
		// "venmo.com/x" with no scheme is a path on the preview's own site, as window.open reads it.
		for (const url of ['/i/x', 'venmo.com/x', 'https://example.com/venmo.com', 'https://notvenmo.com/x', 'https://venmo.com.evil.test/x', '', null, undefined]) {
			expect(isVenmoUrl(url as string), String(url)).toBe(false);
		}
	});

	it("in the Bookbinder, frames the Artist's own preview route, which shows drafts too (B1-T33)", () => {
		route.params = { id: 'issue-123' };
		const { body } = render(BookbinderPreview, { props: { slug: 'neon-velvet-brooklyn-2026-10-12' } });
		expect(body).toMatch(/<iframe[^>]*src="\/dashboard\/bookbinder\/issue-123\/preview"/);
		route.params = {};
	});

	it('elsewhere, frames the public reader at /i/<slug>, labelled as a preview, with only custom properties inline', () => {
		route.params = {};
		const { body } = render(BookbinderPreview, { props: { slug: 'neon-velvet-brooklyn-2026-10-12' } });
		expect(body).toMatch(/<iframe[^>]*src="\/i\/neon-velvet-brooklyn-2026-10-12"/);
		expect(body).toContain('title="Live Issue Mobile Preview"');
		expect(body).toContain('Tips and the Wall are off here.');
		expect(body).toContain('role="status"');
		for (const [, style] of body.matchAll(/style="([^"]*)"/g)) {
			for (const declaration of style.split(';').map((d) => d.trim()).filter(Boolean)) {
				expect(declaration.startsWith('--'), declaration).toBe(true);
			}
		}
	});
});
