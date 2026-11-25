/**
 * A photo page's photos: up to twelve, each with an optional caption. In the
 * Stories reader (ADR 0011) each photo is its own full-screen segment. Pure
 * domain logic only (no UI, no storage).
 */

export const MAX_PHOTOS_PER_PAGE = 12;
export const MAX_PHOTO_CAPTION_LENGTH = 140;

export interface PhotoEntry {
	url: string;
	caption?: string;
}

/**
 * Reads the photos of a stored photo page. Pages saved before multi-photo
 * support only have `imageUrl`, which is treated as a one-photo pile.
 * Malformed entries are dropped instead of failing the whole page.
 */
export function resolvePhotoEntries(content: unknown): PhotoEntry[] {
	if (typeof content !== 'object' || content === null) return [];
	const { photos, imageUrl } = content as { photos?: unknown; imageUrl?: unknown };

	if (Array.isArray(photos)) {
		const entries: PhotoEntry[] = [];
		for (const item of photos) {
			if (typeof item !== 'object' || item === null) continue;
			const { url, caption } = item as { url?: unknown; caption?: unknown };
			if (typeof url !== 'string' || url.trim() === '') continue;
			const trimmedCaption = typeof caption === 'string' ? caption.trim() : '';
			entries.push(
				trimmedCaption ? { url: url.trim(), caption: trimmedCaption } : { url: url.trim() }
			);
			if (entries.length === MAX_PHOTOS_PER_PAGE) break;
		}
		if (entries.length > 0) return entries;
	}

	if (typeof imageUrl === 'string' && imageUrl.trim() !== '') {
		return [{ url: imageUrl.trim() }];
	}
	return [];
}

/**
 * Deterministic tilt, in degrees, for position `index`: the sequence behind
 * `zineTilt` for the ADR 0009 pages that R-T02 to R-T04 have not restyled yet.
 */
export function pileTilt(index: number): number {
	const seed = Math.sin((index + 1) * 12.9898) * 43758.5453;
	const fraction = seed - Math.floor(seed);
	return Math.round((fraction * 12 - 6) * 10) / 10;
}
