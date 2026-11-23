import { getContext, setContext } from 'svelte';

/**
 * What a page inside the Stories reader can ask of it (ADR 0011): move on,
 * jump to a page by its id, or open a sheet. Set by StoryReader.
 */
export interface StoryNav {
	next(): void;
	back(): void;
	/** Jumps to the first segment of the page with this id. */
	goToPage(id: string): void;
	openTip(): void;
	openWall(): void;
}

const KEY = Symbol('story-nav');

export function setStoryNav(nav: StoryNav): void {
	setContext(KEY, nav);
}

/** The reader's navigation, or a no-op outside a reader (unit renders, the Bookbinder). */
export function getStoryNav(): StoryNav {
	return (
		getContext<StoryNav | undefined>(KEY) ?? {
			next() {},
			back() {},
			goToPage() {},
			openTip() {},
			openWall() {}
		}
	);
}

/** Initials for an avatar without art: the first letters of the first two words. */
export function initialsOf(name: string): string {
	const letters = name
		.trim()
		.split(/\s+/)
		.filter((word) => /^[\p{L}\p{N}]/u.test(word))
		.filter((word, i, words) => !(words.length > 2 && i === 0 && /^the$/i.test(word)))
		.slice(0, 2)
		.map((word) => word[0]!.toUpperCase());
	return letters.join('') || 'Q';
}

/** The Artist's type pairing for headings and the Cover title only; the UI is always the system font. */
export function headingFontFor(pairing: string | null | undefined): string {
	if (pairing === 'serif') return 'var(--font-serif)';
	if (pairing === 'mono') return 'var(--font-mono)';
	return 'var(--story-font)';
}

/**
 * Black or white, whichever reads better on `hex` (WCAG relative luminance),
 * for text on the Artist's accent colour.
 */
export function textOn(hex: string | null | undefined): '#ffffff' | '#090710' {
	const match = /^#?([0-9a-f]{6})$/i.exec(hex?.trim() ?? '');
	if (!match) return '#090710';
	const value = parseInt(match[1]!, 16);
	const channel = (shift: number) => {
		const c = ((value >> shift) & 0xff) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
	// Contrast with white is 1.05 / (L + 0.05); with the void colour about (L + 0.05) / 0.053.
	return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.053 ? '#ffffff' : '#090710';
}
