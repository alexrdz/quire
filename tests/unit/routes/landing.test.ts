import { describe, it, expect } from 'vitest';
import { render } from 'svelte/server';
import Page from '../../../src/routes/(site)/+page.svelte';

describe('Landing +page.svelte', () => {
	it('renders landing page via SSR without errors', () => {
		const res = render(Page);
		expect(res.html).toBeDefined();
		expect(res.html).toContain('Quire');
		expect(res.html).toContain('A Venmo sign gets you tips.');
		expect(res.html).toContain('This gets you tips and people.');
		expect(res.html).toContain('The Neon Velvet');
	});
});
