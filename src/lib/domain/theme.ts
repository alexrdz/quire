/**
 * Pure domain helpers for artist theming, WCAG 2.1 contrast enforcement,
 * and permanent artist handle (/a/[slug]) normalization.
 *
 * ZERO external imports — pure domain core.
 */

export const BG_VOID_HEX = '#090710';
export const DEFAULT_ACCENT_HEX = '#05D9E8';
export const WCAG_AA_CONTRAST_RATIO = 4.5;

export const MAX_ARTIST_SLUG_LENGTH = 60;
export const MIN_ARTIST_SLUG_LENGTH = 2;

export const RESERVED_ARTIST_SLUGS = [
	'a',
	'api',
	'assets',
	'auth',
	'dashboard',
	'demo',
	'i',
	'login',
	'logout',
	'me',
	'register',
	'scan',
	'settings',
	'signup',
	'static',
	'uploads'
] as const;

const RESERVED_ARTIST_SLUG_SET = new Set<string>(RESERVED_ARTIST_SLUGS);

export interface RgbColor {
	r: number;
	g: number;
	b: number;
}

export type AccentContrastResult =
	| { ok: true; hex: string; ratio: number }
	| { ok: false; hex: string; ratio: number; suggestedHex: string };

const BG_VOID_RGB: RgbColor = { r: 9, g: 7, b: 16 };

/**
 * Parses a #RGB or #RRGGBB hex string into 0-255 RGB channels.
 */
export function parseHexColor(hexColor: string): RgbColor | null {
	const trimmed = hexColor.trim();
	const match = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(trimmed);
	if (!match) return null;

	const raw = match[1];
	const expanded =
		raw.length === 3
			? `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`
			: raw;

	return {
		r: Number.parseInt(expanded.slice(0, 2), 16),
		g: Number.parseInt(expanded.slice(2, 4), 16),
		b: Number.parseInt(expanded.slice(4, 6), 16)
	};
}

/**
 * Formats an RGB triplet as an uppercase #RRGGBB hex string.
 */
function formatRgbHex(rgb: RgbColor): string {
	const toHex = (value: number) =>
		Math.max(0, Math.min(255, Math.round(value)))
			.toString(16)
			.padStart(2, '0')
			.toUpperCase();

	return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Normalizes a #RGB or #RRGGBB hex color to uppercase #RRGGBB, or null if invalid.
 */
export function normalizeHexColor(hexColor: string): string | null {
	const parsed = parseHexColor(hexColor);
	return parsed ? formatRgbHex(parsed) : null;
}

/**
 * WCAG 2.1 sRGB channel linearization.
 */
function toLinearChannel(channel255: number): number {
	const srgb = channel255 / 255;
	return srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

/**
 * Computes WCAG 2.1 relative luminance for an RGB color (0.0 to 1.0).
 */
function luminanceFromRgb(rgb: RgbColor): number {
	return (
		0.2126 * toLinearChannel(rgb.r) +
		0.7152 * toLinearChannel(rgb.g) +
		0.0722 * toLinearChannel(rgb.b)
	);
}

/**
 * Computes WCAG 2.1 relative luminance for a hex color, or null if invalid.
 */
export function calculateRelativeLuminance(hexColor: string): number | null {
	const rgb = parseHexColor(hexColor);
	if (!rgb) return null;
	return luminanceFromRgb(rgb);
}

/**
 * Computes raw WCAG 2.1 contrast ratio between two RGB colors.
 */
function rawContrastRatio(rgbA: RgbColor, rgbB: RgbColor): number {
	const lumA = luminanceFromRgb(rgbA);
	const lumB = luminanceFromRgb(rgbB);
	const lighter = Math.max(lumA, lumB);
	const darker = Math.min(lumA, lumB);
	return (lighter + 0.05) / (darker + 0.05);
}

function roundRatio(ratio: number): number {
	return Math.round(ratio * 100) / 100;
}

/**
 * Computes the WCAG 2.1 contrast ratio (rounded to 2 decimals) between two hex colors.
 * Defaults the background to --bg-void (#090710).
 */
export function calculateContrastRatio(
	foregroundHex: string,
	backgroundHex: string = BG_VOID_HEX
): number | null {
	const fg = parseHexColor(foregroundHex);
	const bg = parseHexColor(backgroundHex);
	if (!fg || !bg) return null;
	return roundRatio(rawContrastRatio(fg, bg));
}

/**
 * Lightens a dark RGB color toward #FFFFFF using binary search to find the
 * closest tint that achieves >= WCAG AA (4.5:1) contrast against --bg-void.
 */
function findAccessibleLightenedHex(rgb: RgbColor): string {
	let low = 0;
	let high = 1;
	let bestRgb: RgbColor = { r: 255, g: 255, b: 255 };

	for (let i = 0; i < 24; i += 1) {
		const mid = (low + high) / 2;
		const candidate: RgbColor = {
			r: Math.round(rgb.r + (255 - rgb.r) * mid),
			g: Math.round(rgb.g + (255 - rgb.g) * mid),
			b: Math.round(rgb.b + (255 - rgb.b) * mid)
		};

		if (rawContrastRatio(candidate, BG_VOID_RGB) >= WCAG_AA_CONTRAST_RATIO) {
			bestRgb = candidate;
			high = mid;
		} else {
			low = mid;
		}
	}

	return formatRgbHex(bestRgb);
}

/**
 * Checks whether an artist's chosen --accent color meets WCAG 2.1 AA contrast
 * (>= 4.5:1) against --bg-void (#090710). If not, returns a lightened suggestion.
 */
export function checkAccentContrast(hexColor: string): AccentContrastResult {
	const rgb = parseHexColor(hexColor);
	if (!rgb) {
		return {
			ok: false,
			hex: hexColor.trim(),
			ratio: 0,
			suggestedHex: DEFAULT_ACCENT_HEX
		};
	}

	const normalizedHex = formatRgbHex(rgb);
	const raw = rawContrastRatio(rgb, BG_VOID_RGB);
	const ratio = roundRatio(raw);

	if (raw >= WCAG_AA_CONTRAST_RATIO) {
		return {
			ok: true,
			hex: normalizedHex,
			ratio
		};
	}

	return {
		ok: false,
		hex: normalizedHex,
		ratio,
		suggestedHex: findAccessibleLightenedHex(rgb)
	};
}

/**
 * Returns true if the slug matches a reserved application route segment.
 */
export function isReservedArtistSlug(slug: string): boolean {
	return RESERVED_ARTIST_SLUG_SET.has(slug.trim().toLowerCase());
}

/**
 * Normalizes an artist display name or user-edited slug into a clean,
 * URL-safe /a/[slug] handle (lowercase alphanumeric segments separated by single hyphens).
 */
export function normalizeArtistSlug(nameOrSlug: string): string {
	return nameOrSlug
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/['\u2019]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, MAX_ARTIST_SLUG_LENGTH)
		.replace(/-+$/g, '');
}

/**
 * Produces deterministic, clean alternative /a/[slug] handles when a band's
 * first-choice slug collides or is reserved (never appends random digits).
 */
export function suggestAlternativeSlugs(baseSlug: string): string[] {
	const normalized = normalizeArtistSlug(baseSlug);
	const stem = normalized.length >= MIN_ARTIST_SLUG_LENGTH ? normalized : 'band';

	const candidates: string[] = [];

	const appendSuffix = (suffix: string) => {
		const maxStemLen = MAX_ARTIST_SLUG_LENGTH - suffix.length;
		const trimmedStem = stem.slice(0, maxStemLen).replace(/-+$/g, '');
		if (trimmedStem.length === 0) return;
		candidates.push(`${trimmedStem}${suffix}`);
	};

	appendSuffix('-music');
	appendSuffix('-band');
	appendSuffix('-live');

	if (!stem.startsWith('the-') && stem.length + 4 <= MAX_ARTIST_SLUG_LENGTH) {
		candidates.push(`the-${stem}`);
	}

	appendSuffix('-official');
	appendSuffix('-2');

	const unique: string[] = [];
	const seen = new Set<string>([normalized]);

	for (const candidate of candidates) {
		if (
			candidate.length >= MIN_ARTIST_SLUG_LENGTH &&
			candidate.length <= MAX_ARTIST_SLUG_LENGTH &&
			!seen.has(candidate) &&
			!isReservedArtistSlug(candidate)
		) {
			seen.add(candidate);
			unique.push(candidate);
		}
	}

	return unique;
}
