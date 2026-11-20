import { expect } from '@playwright/test';

/**
 * Open-redirect payloads (PRODUCTION_PLAN 2.1; the same list as
 * tests/unit/schemas/redirect.test.ts, plus encoded and scheme variants that
 * only matter once they travel through a real URL).
 */
export const OPEN_REDIRECT_PAYLOADS = [
	'//evil.com',
	'/\\evil.com',
	'\\\\evil.com',
	'/%5Cevil.com',
	'/%5cevil.com',
	'/%255Cevil.com',
	'/%2Fevil.com',
	'%2F%2Fevil.com',
	'/%2F%2Fevil.com',
	'////evil.com',
	'/\t/evil.com',
	'/%09/evil.com',
	'https://evil.com',
	'http:evil.com',
	'HTTPS://EVIL.COM',
	'javascript:alert(1)',
	'JavaScript:alert(1)',
	'data:text/html,<script>alert(1)</script>',
	'evil.com',
	'/dashboard\\..\\evil',
	'/dash%0Aboard'
];

/** Asserts a redirect target stays on this origin (resolved the way a browser would). */
export function expectSameOrigin(location: string | undefined, baseURL: string, label: string): URL {
	expect(location, `${label}: has a Location`).toBeTruthy();
	const resolved = new URL(location!, baseURL);
	expect(resolved.origin, `${label}: ${location}`).toBe(new URL(baseURL).origin);
	// A path that a browser could re-read as a host (//host, /\host) is off-site too.
	expect(location!, `${label}: ${location}`).not.toMatch(/^\s*[/\\]{2}|^\s*\/\\/);
	expect(resolved.hostname, label).not.toContain('evil');
	return resolved;
}
