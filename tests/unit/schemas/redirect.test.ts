import { describe, expect, it } from 'vitest';
import {
	artistLoginSchema,
	isSafeRedirectPath,
	resolveSafeRedirect,
	safeRedirectPathSchema
} from '$schemas/auth';

describe('safeRedirectPathSchema (PRODUCTION_PLAN 2.1)', () => {
	const rejected: Array<[string, string]> = [
		['protocol-relative', '//evil.com'],
		['slash-backslash', '/\\evil.com'],
		['encoded backslash', '/%5Cevil.com'],
		['encoded backslash, lower case', '/%5cevil.com'],
		['double-encoded backslash', '/%255Cevil.com'],
		['encoded slash after slash', '/%2Fevil.com'],
		['double backslash', '\\\\evil'],
		['backslash anywhere', '/dashboard\\..\\evil'],
		['absolute https URL', 'https://evil.com'],
		['javascript URL', 'javascript:alert(1)'],
		['no leading slash', 'evil.com'],
		['tab inside', '/\t/evil.com'],
		['newline inside', '/dash\nboard'],
		['NUL', '/dash\u0000board'],
		['DEL', '/dash\u007fboard'],
		['encoded tab', '/%09/evil.com'],
		['encoded newline', '/dash%0Aboard'],
		['encoded NUL', '/dash%00board'],
		['invalid percent encoding', '/%E0%A4%A'],
		['empty', '']
	];

	it.each(rejected)('rejects %s', (_label, payload) => {
		expect(isSafeRedirectPath(payload)).toBe(false);
		expect(safeRedirectPathSchema.safeParse(payload).success).toBe(false);
		expect(resolveSafeRedirect(payload, '/fallback')).toBe('/fallback');
	});

	const accepted = ['/', '/dashboard', '/a/the-neon-velvet', '/i/some-issue?tab=wall#notes', '/me/stubs'];

	it.each(accepted)('accepts %s', (path) => {
		expect(isSafeRedirectPath(path)).toBe(true);
		expect(resolveSafeRedirect(path, '/fallback')).toBe(path);
	});

	it('falls back for missing values and non-strings', () => {
		expect(resolveSafeRedirect(null, '/x')).toBe('/x');
		expect(resolveSafeRedirect(undefined, '/x')).toBe('/x');
		expect(resolveSafeRedirect(42, '/x')).toBe('/x');
		expect(resolveSafeRedirect('   ', '/x')).toBe('/x');
	});

	it('is the checker used by the login schema', () => {
		const base = { email: 'band@example.com', password: 'pw' };
		expect(artistLoginSchema.safeParse({ ...base, redirectTo: '/\\evil.com' }).success).toBe(false);
		expect(artistLoginSchema.safeParse({ ...base, redirectTo: '/dashboard' }).success).toBe(true);
	});
});
