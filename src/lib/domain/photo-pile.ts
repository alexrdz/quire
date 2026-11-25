import { type Result, type DomainError, ok, err } from './types';

/**
 * Photo Pile: a photo page holding several photos that readers toss through
 * like a stack of instant prints. Pure domain logic only (no UI, no storage).
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
 * Deterministic resting tilt, in degrees, for the photo at `index`.
 * Derived from the index so nothing has to be stored and every reader
 * sees the same pile.
 */
export function pileTilt(index: number): number {
	const seed = Math.sin((index + 1) * 12.9898) * 43758.5453;
	const fraction = seed - Math.floor(seed);
	return Math.round((fraction * 12 - 6) * 10) / 10;
}

/* ---------------------------------------------------------------------------
   Pile position FSM: stacked(top, front|back) <-> cleared
   --------------------------------------------------------------------------- */

export type PileState =
	| { phase: 'stacked'; total: number; top: number; side: 'front' | 'back' }
	| { phase: 'cleared'; total: number };

export type PileEvent = 'toss' | 'restore' | 'flip' | 'restack';

/**
 * A one-photo pile is a single card: it can flip, but tossing it would only
 * leave an empty "cleared" stage, so toss (and with it restore and restack)
 * needs at least two photos.
 */
export function pileCanToss(total: number): boolean {
	return total > 1;
}

export function createPile(total: number): PileState {
	const safeTotal = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
	return safeTotal === 0
		? { phase: 'cleared', total: 0 }
		: { phase: 'stacked', total: safeTotal, top: 0, side: 'front' };
}

function invalid(state: PileState, event: PileEvent): Result<PileState, DomainError> {
	return err({
		code: 'INVALID_PILE_TRANSITION',
		message: `Cannot '${event}' while the pile is '${state.phase}'.`
	});
}

export function transitionPile(state: PileState, event: PileEvent): Result<PileState, DomainError> {
	switch (state.phase) {
		case 'stacked': {
			if (event === 'toss') {
				if (!pileCanToss(state.total)) return invalid(state, event);
				const next = state.top + 1;
				return ok(
					next >= state.total
						? { phase: 'cleared', total: state.total }
						: { phase: 'stacked', total: state.total, top: next, side: 'front' }
				);
			}
			if (event === 'restore') {
				if (state.top === 0) return invalid(state, event);
				return ok({ phase: 'stacked', total: state.total, top: state.top - 1, side: 'front' });
			}
			if (event === 'flip') {
				return ok({ ...state, side: state.side === 'front' ? 'back' : 'front' });
			}
			return invalid(state, event);
		}
		case 'cleared': {
			if (event === 'restore' && state.total > 0) {
				return ok({ phase: 'stacked', total: state.total, top: state.total - 1, side: 'front' });
			}
			if (event === 'restack' && state.total > 0) {
				return ok({ phase: 'stacked', total: state.total, top: 0, side: 'front' });
			}
			return invalid(state, event);
		}
	}
}
