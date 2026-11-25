/**
 * Shared, UI-free pieces of the Issue reader (/i/[slug]): the stored page
 * content, each inner page's id and number, and the video embed rules. The
 * Stories reader (ADR 0011, `story/`) does the paging.
 */

export type PageSource = 'bespoke' | 'template';
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

/** What an inner page needs from the reader: its id (also its URL hash) and its place in the Issue. */
export interface PageShell {
	id: string;
	pageNumber: number;
	pageCount: number;
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
export function contentPageShell(index: number, contentCount: number): PageShell {
	return { id: contentPageId(index), pageNumber: index + 2, pageCount: readerPageCount(contentCount) };
}

export function wallShell(contentCount: number): PageShell {
	return { id: 'page-wall', pageNumber: contentCount + 2, pageCount: readerPageCount(contentCount) };
}

export function endpaperShell(contentCount: number): PageShell {
	return { id: 'page-endpaper', pageNumber: contentCount + 3, pageCount: readerPageCount(contentCount) };
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
