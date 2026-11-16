import { describe, it, expect } from 'vitest';
import { signScanToken, verifyScanToken } from '$lib/server/services/stamping';

describe('Stamping & HMAC Token Service', () => {
	it('signs and verifies a valid scan token', () => {
		const scannedAt = new Date('2026-10-12T21:00:00Z');
		const token = signScanToken('the-neon-velvet-brooklyn', scannedAt);

		expect(token).toContain('the-neon-velvet-brooklyn');

		const verification = verifyScanToken(token);
		expect(verification.ok).toBe(true);
		if (!verification.ok) return;

		expect(verification.value.issueSlug).toBe('the-neon-velvet-brooklyn');
		expect(verification.value.scannedAt.getTime()).toBe(scannedAt.getTime());
		expect(verification.value.tokenHash).toHaveLength(64);
	});

	it('detects and rejects a forged or tampered token', () => {
		const token = signScanToken('the-neon-velvet-brooklyn');
		// Tamper with the slug
		const tampered = token.replace('the-neon-velvet-brooklyn', 'other-artist-brooklyn');

		const verification = verifyScanToken(tampered);
		expect(verification.ok).toBe(false);
		if (!verification.ok) {
			expect(verification.error.code).toBe('INVALID_SIGNATURE');
		}
	});

	it('rejects malformed tokens', () => {
		expect(verifyScanToken('invalid-token').ok).toBe(false);
		expect(verifyScanToken('part1.part2').ok).toBe(false);
	});
});
