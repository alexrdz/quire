import { describe, it, expect } from 'vitest';
import {
	BG_VOID_HEX,
	DEFAULT_ACCENT_HEX,
	WCAG_AA_CONTRAST_RATIO,
	calculateRelativeLuminance,
	calculateContrastRatio,
	checkAccentContrast,
	normalizeArtistSlug,
	suggestAlternativeSlugs,
	isReservedArtistSlug
} from '$domain/theme';

describe('Theme Domain Helpers', () => {
	describe('WCAG 2.1 Relative Luminance & Contrast Ratio', () => {
		it('computes expected relative luminance for black, white, and --bg-void', () => {
			expect(calculateRelativeLuminance('#000000')).toBe(0);
			expect(calculateRelativeLuminance('#FFFFFF')).toBeCloseTo(1, 6);

			const voidLum = calculateRelativeLuminance(BG_VOID_HEX);
			expect(voidLum).not.toBeNull();
			expect(voidLum!).toBeGreaterThan(0);
			expect(voidLum!).toBeLessThan(0.01);
		});

		it('computes 21:1 contrast between pure white and pure black', () => {
			expect(calculateContrastRatio('#FFFFFF', '#000000')).toBe(21);
		});

		it('returns null for malformed hex strings', () => {
			expect(calculateRelativeLuminance('not-hex')).toBeNull();
			expect(calculateContrastRatio('#12345', BG_VOID_HEX)).toBeNull();
		});
	});

	describe('checkAccentContrast', () => {
		it('passes platform high-contrast accents against --bg-void (#090710)', () => {
			const defaultAccent = checkAccentContrast(DEFAULT_ACCENT_HEX);
			expect(defaultAccent.ok).toBe(true);
			expect(defaultAccent.hex).toBe('#05D9E8');
			expect(defaultAccent.ratio).toBeGreaterThanOrEqual(WCAG_AA_CONTRAST_RATIO);

			const highlight = checkAccentContrast('#01FFC3');
			expect(highlight.ok).toBe(true);
			expect(highlight.ratio).toBeGreaterThan(10);

			const support = checkAccentContrast('#FF2A6D');
			expect(support.ok).toBe(true);
			expect(support.ratio).toBeGreaterThanOrEqual(WCAG_AA_CONTRAST_RATIO);
		});

		it('normalizes lowercase and 3-digit shorthand hex inputs', () => {
			const result = checkAccentContrast('  #0fc ');
			expect(result.ok).toBe(true);
			expect(result.hex).toBe('#00FFCC');
		});

		it('flags low-contrast dark colors and suggests an accessible lightened hex >= 4.5:1', () => {
			for (const darkColor of ['#090710', '#1A0B2E', '#3B0764', '#003366', '#66001A']) {
				const result = checkAccentContrast(darkColor);
				expect(result.ok).toBe(false);
				if (result.ok) continue;

				expect(result.ratio).toBeLessThan(WCAG_AA_CONTRAST_RATIO);
				expect(result.suggestedHex).toMatch(/^#[0-9A-F]{6}$/);

				const recheck = checkAccentContrast(result.suggestedHex);
				expect(recheck.ok).toBe(true);
				expect(recheck.ratio).toBeGreaterThanOrEqual(WCAG_AA_CONTRAST_RATIO);
			}
		});

		it('falls back to DEFAULT_ACCENT_HEX when given an invalid hex string', () => {
			const result = checkAccentContrast('purple');
			expect(result.ok).toBe(false);
			if (result.ok) return;
			expect(result.ratio).toBe(0);
			expect(result.suggestedHex).toBe(DEFAULT_ACCENT_HEX);
		});
	});

	describe('normalizeArtistSlug', () => {
		it('converts band names into clean lowercase hyphenated handles', () => {
			expect(normalizeArtistSlug('The Neon Velvet')).toBe('the-neon-velvet');
			expect(normalizeArtistSlug('  Static   Bloom  ')).toBe('static-bloom');
			expect(normalizeArtistSlug("Johnny Brenda's Trio")).toBe('johnny-brendas-trio');
		});

		it('strips Unicode diacritics and punctuation without appending random digits', () => {
			expect(normalizeArtistSlug('Café Tacvba!')).toBe('cafe-tacvba');
			expect(normalizeArtistSlug('---Señor Fuzz---')).toBe('senor-fuzz');
			expect(normalizeArtistSlug('24/7 Buskers')).toBe('24-7-buskers');
		});

		it('truncates slugs to 60 characters without trailing hyphens', () => {
			const longName =
				'The extraordinarily long psychedelic garage rock collective from Philadelphia';
			const slug = normalizeArtistSlug(longName);
			expect(slug.length).toBeLessThanOrEqual(60);
			expect(slug.endsWith('-')).toBe(false);
			expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
		});

		it('returns empty string for empty or punctuation-only inputs', () => {
			expect(normalizeArtistSlug('')).toBe('');
			expect(normalizeArtistSlug('   !!!   ')).toBe('');
		});
	});

	describe('suggestAlternativeSlugs', () => {
		it('suggests clean, non-random, valid alternative slugs', () => {
			const suggestions = suggestAlternativeSlugs('Static Bloom');
			expect(suggestions.length).toBeGreaterThanOrEqual(4);
			expect(suggestions).toContain('static-bloom-music');
			expect(suggestions).toContain('static-bloom-band');
			expect(suggestions).toContain('static-bloom-live');
			expect(suggestions).toContain('the-static-bloom');

			for (const slug of suggestions) {
				expect(slug).not.toBe('static-bloom');
				expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
				expect(slug.length).toBeGreaterThanOrEqual(2);
				expect(slug.length).toBeLessThanOrEqual(60);
				expect(isReservedArtistSlug(slug)).toBe(false);
			}
		});

		it('avoids doubling "the-" when base slug already starts with "the-"', () => {
			const suggestions = suggestAlternativeSlugs('the-neon-velvet');
			expect(suggestions.some((s) => s.startsWith('the-the-'))).toBe(false);
		});

		it('respects 60-character max length even for very long base slugs', () => {
			const longSlug = 'a'.repeat(58);
			const suggestions = suggestAlternativeSlugs(longSlug);
			expect(suggestions.length).toBeGreaterThan(0);
			for (const slug of suggestions) {
				expect(slug.length).toBeLessThanOrEqual(60);
				expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
			}
		});

		it('produces valid non-reserved suggestions when base slug is reserved or empty', () => {
			for (const input of ['login', 'dashboard', 'api', '']) {
				const suggestions = suggestAlternativeSlugs(input);
				expect(suggestions.length).toBeGreaterThan(0);
				for (const slug of suggestions) {
					expect(isReservedArtistSlug(slug)).toBe(false);
				}
			}
		});
	});
});
