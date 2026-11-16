import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import Page from '../../../src/routes/+page.svelte';

describe('Landing +page.svelte', () => {
	it('renders landing page via SSR without errors', () => {
		const res = render(Page);
		expect(res.html).toBeDefined();
		expect(res.html).toContain('Quire');
		expect(res.html).toContain('Your Venmo QR collects money');
		expect(res.html).toContain('This collects money and people');
		expect(res.html).toContain('The Neon Velvet');
	});
});
