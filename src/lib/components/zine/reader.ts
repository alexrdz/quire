import { pileTilt } from '$domain/photo-pile';

/**
 * Shared, UI-free pieces of the Issue reader (/i/[slug]): the stored page
 * content, the shell every inner page sits in (chips, "Page n of m", footer
 * nav) and the video embed rules. The page components render these.
 */

export type PageSource = 'bespoke' | 'template';
export type ChipTone = 'highlight' | 'accent' | 'support';
/** What a Fan was doing when asked to sign in ('' from the Cover button). */
export type AuthAction = 'note' | 'stamp' | 'save' | '';

/** A page's stored contentJson, read leniently: every field is optional. */
export interface PageContent {
	title?: string;
	body?: string;
	songs?: string[];
	imageUrl?: string;
	photos?: unknown;
	audioUrl?: string;
	videoUrl?: string;
	embedUrl?: string;
	duration?: string;
	orientation?: 'portrait' | 'landscape';
}

export function parseContent(jsonStr: string): PageContent {
	try {
		return JSON.parse(jsonStr || '{}');
	} catch {
		return {};
	}
}

export interface ShellChip {
	label: string;
	tone?: ChipTone;
}

export interface ShellNav {
	target: string;
	label: string;
	primary?: boolean;
}

/** What ZinePageShell needs for an inner page: its anchor, chips, page number and footer nav. */
export interface PageShell {
	id: string;
	chips: ShellChip[];
	pageNumber: number;
	pageCount: number;
	nav: ShellNav[];
}

/** A note on the Wall, as the Issue load returns it. */
export interface WallNote {
	id: string;
	body: string;
	wasThere: boolean;
	author?: { name?: string | null } | null;
	replies?: Array<{ body: string }> | null;
}

/** Cover, the content pages, the Wall and the Endpaper. */
export function readerPageCount(contentCount: number): number {
	return contentCount + 3;
}

export function contentPageId(index: number): string {
	return `page-content-${index}`;
}

/** The shell of content page `index` (0-based) out of `contentCount`. */
export function contentPageShell(
	index: number,
	contentCount: number,
	page: { kind: string; source: PageSource },
	city: string
): PageShell {
	const isLast = index + 1 >= contentCount;
	return {
		id: contentPageId(index),
		chips: [
			page.source === 'bespoke' ? { label: city, tone: 'accent' } : { label: 'Band Liner Note', tone: 'highlight' },
			{ label: page.kind.toUpperCase() }
		],
		pageNumber: index + 2,
		pageCount: readerPageCount(contentCount),
		nav: [
			{ target: index === 0 ? 'page-cover' : contentPageId(index - 1), label: '← Prev' },
			{
				target: isLast ? 'page-wall' : contentPageId(index + 1),
				label: isLast ? 'Next: The Wall →' : 'Next Page →',
				primary: true
			}
		]
	};
}

export function wallShell(contentCount: number): PageShell {
	return {
		id: 'page-wall',
		chips: [{ label: 'COMMUNITY', tone: 'accent' }, { label: 'THE WALL' }],
		pageNumber: contentCount + 2,
		pageCount: readerPageCount(contentCount),
		nav: [
			{ target: contentPageId(contentCount - 1), label: '← Prev Page' },
			{ target: 'page-endpaper', label: 'Next: Endpaper →', primary: true }
		]
	};
}

export function endpaperShell(contentCount: number): PageShell {
	return {
		id: 'page-endpaper',
		chips: [{ label: 'ENDPAPER', tone: 'highlight' }, { label: 'ADMIT ONE' }],
		pageNumber: contentCount + 3,
		pageCount: readerPageCount(contentCount),
		nav: [
			{ target: 'page-wall', label: '← Back to Wall' },
			{ target: 'page-cover', label: '↺ Back to Cover' }
		]
	};
}

/** Scrolls the reader's snap container to the page with this id (instantly under reduced motion). */
export function scrollToPage(id: string): void {
	const el = document.getElementById(id);
	const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
	el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest', inline: 'start' });
}

/** Array of all page IDs in order from Cover to Endpaper. */
export function getAllReaderPageIds(contentCount: number): string[] {
	return [
		'page-cover',
		...Array.from({ length: contentCount }, (_, i) => contentPageId(i)),
		'page-wall',
		'page-endpaper'
	];
}

/** Navigates to the adjacent page given current page ID. */
export function stepPage(currentId: string, contentCount: number, direction: 'prev' | 'next'): void {
	const all = getAllReaderPageIds(contentCount);
	const idx = all.indexOf(currentId);
	if (idx === -1) return;
	const targetIdx = direction === 'next' ? Math.min(all.length - 1, idx + 1) : Math.max(0, idx - 1);
	if (targetIdx !== idx) {
		scrollToPage(all[targetIdx]!);
	}
}

/* ---------------------------------------------------------------------------
   Cut-and-paste tilts (ADR 0009)
   --------------------------------------------------------------------------- */

/** ADR 0009: text never tilts beyond about 2 degrees, so it stays easy to read. */
export const MAX_TEXT_TILT = 2;

/**
 * The resting tilt, in degrees, of the scrap at `position` on a page: the
 * same deterministic sequence as the photo pile, scaled into ±`max`. Every
 * reader sees the same page and nothing is stored.
 */
export function zineTilt(position: number, max: number = MAX_TEXT_TILT): number {
	const limit = Math.max(0, max);
	const tilt = Math.round((pileTilt(position) / 6) * limit * 10) / 10;
	// pileTilt is rounded to 0.1, so scaling can land a hair past the limit.
	return Math.max(-limit, Math.min(limit, tilt)) || 0;
}

/* ---------------------------------------------------------------------------
   Video pages: which embed a stored URL becomes
   --------------------------------------------------------------------------- */

export type VideoEmbedInfo =
	| { kind: 'youtube'; id: string; embedSrc: string; posterSrc: string; watchUrl: string }
	| { kind: 'vimeo'; id: string; embedSrc: string; watchUrl: string }
	| { kind: 'bandcamp-embed'; embedSrc: string; watchUrl: string }
	| { kind: 'bandcamp-link'; watchUrl: string }
	| { kind: 'video-file'; src: string }
	| { kind: 'external-link'; watchUrl: string }
	| { kind: 'none' };

export function resolveVideoEmbed(rawUrl?: string): VideoEmbedInfo {
	const urlStr = rawUrl?.trim();
	if (!urlStr) return { kind: 'none' };

	if (urlStr.startsWith('/uploads/')) {
		if (/\.(mp4|webm|ogg|mov)$/i.test(urlStr)) {
			return { kind: 'video-file', src: urlStr };
		}
		return { kind: 'external-link', watchUrl: urlStr };
	}

	let parsed: URL;
	try {
		parsed = new URL(urlStr);
	} catch {
		return { kind: 'none' };
	}

	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		return { kind: 'none' };
	}

	const host = parsed.hostname.toLowerCase();

	if (
		host === 'youtu.be' ||
		host === 'youtube.com' ||
		host === 'www.youtube.com' ||
		host === 'm.youtube.com' ||
		host === 'youtube-nocookie.com' ||
		host === 'www.youtube-nocookie.com'
	) {
		let ytId = '';
		if (host === 'youtu.be') {
			ytId = parsed.pathname.slice(1).split('/')[0] || '';
		} else if (parsed.pathname.startsWith('/watch')) {
			ytId = parsed.searchParams.get('v') || '';
		} else {
			const match = parsed.pathname.match(/^\/(?:embed|shorts|live|v)\/([a-zA-Z0-9_-]{6,20})/);
			ytId = match?.[1] || '';
		}
		if (/^[a-zA-Z0-9_-]{6,20}$/.test(ytId)) {
			return {
				kind: 'youtube',
				id: ytId,
				embedSrc: `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1`,
				posterSrc: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
				watchUrl: urlStr
			};
		}
	}

	if (host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com') {
		const match = parsed.pathname.match(/^\/(?:video\/)?(\d{5,15})/);
		const vimeoId = match?.[1] || '';
		if (vimeoId) {
			return {
				kind: 'vimeo',
				id: vimeoId,
				embedSrc: `https://player.vimeo.com/video/${vimeoId}?autoplay=1`,
				watchUrl: urlStr
			};
		}
	}

	if (host === 'bandcamp.com' || host.endsWith('.bandcamp.com')) {
		if (parsed.pathname.startsWith('/EmbeddedPlayer')) {
			return { kind: 'bandcamp-embed', embedSrc: urlStr, watchUrl: urlStr };
		}
		return { kind: 'bandcamp-link', watchUrl: urlStr };
	}

	if (/\.(mp4|webm|ogg|mov)$/i.test(parsed.pathname)) {
		return { kind: 'video-file', src: urlStr };
	}

	return { kind: 'external-link', watchUrl: urlStr };
}
