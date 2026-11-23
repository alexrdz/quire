/**
 * Stories reader (ADR 0011): the pure rules behind paging through an Issue one
 * full-screen page at a time. No DOM, no Svelte: the reader feeds these numbers
 * and acts on the answers.
 *
 * - A page has one or more segments (each photo of a photo page is its own).
 *   The progress bar shows one bar per segment, and paging moves by segment.
 * - A tap on the right two-thirds goes forward, on the left third back. A
 *   horizontal swipe does the same. A tap that starts on a control, a drag, a
 *   vertical scroll or a long press does nothing.
 * - The place is kept in the URL hash as the page's id, plus `-photo-<n>` for
 *   the second and later photos of a page.
 */

export interface StoryPageInfo {
	/** The page's element id, which is also its hash: `page-cover`, `page-content-2`, `page-wall`. */
	id: string;
	/** How many segments the page has; at least 1. */
	segments: number;
}

export interface StorySegment {
	/** Index into the pages. */
	page: number;
	/** Index of the segment within its page (the photo), 0 for most pages. */
	part: number;
}

export type StoryDirection = 'forward' | 'back';

/** A page has at least one segment, and a whole number of them. */
function segmentCount(page: StoryPageInfo): number {
	return Number.isFinite(page.segments) ? Math.max(1, Math.floor(page.segments)) : 1;
}

/** Every segment, in reading order. */
export function buildSegments(pages: readonly StoryPageInfo[]): StorySegment[] {
	const segments: StorySegment[] = [];
	pages.forEach((page, index) => {
		for (let part = 0; part < segmentCount(page); part++) segments.push({ page: index, part });
	});
	return segments;
}

/** A segment index kept inside `0 .. total - 1` (0 for no segments, or for anything not a number). */
export function clampSegment(index: number, total: number): number {
	if (!Number.isFinite(total) || total <= 0) return 0;
	if (!Number.isFinite(index)) return 0;
	return Math.min(total - 1, Math.max(0, Math.trunc(index)));
}

/** The segment one step from `current`; it stays put at either end (no wrapping, no auto-advance). */
export function stepSegment(current: number, total: number, direction: StoryDirection): number {
	return clampSegment(clampSegment(current, total) + (direction === 'forward' ? 1 : -1), total);
}

/** The first segment of page `page`. */
export function firstSegmentOfPage(segments: readonly StorySegment[], page: number): number {
	const index = segments.findIndex((segment) => segment.page === page);
	return index === -1 ? 0 : index;
}

/** Each progress bar's state: done before the current segment, current, and to-do after it. */
export function progressStates(total: number, current: number): Array<'done' | 'current' | 'todo'> {
	const at = clampSegment(current, total);
	return Array.from({ length: Math.max(0, total) }, (_, i) => (i < at ? 'done' : i === at ? 'current' : 'todo'));
}

/* ------------------------------------------------------------------------- */
/* The URL hash                                                               */
/* ------------------------------------------------------------------------- */

const PHOTO_SUFFIX = /^(.+)-photo-(\d{1,3})$/;

/** `#page-content-2`, or `#page-content-2-photo-3` for the third photo of that page. */
export function segmentHash(pages: readonly StoryPageInfo[], segment: StorySegment | undefined): string {
	const page = segment ? pages[segment.page] : undefined;
	if (!page || !segment) return '';
	return segment.part > 0 ? `#${page.id}-photo-${segment.part + 1}` : `#${page.id}`;
}

/**
 * The segment a hash names, or null when it names none. A photo number past
 * the page's photos lands on its last photo; an unknown id is null, so the
 * reader opens the Cover.
 */
export function parseStoryHash(
	hash: string,
	pages: readonly StoryPageInfo[],
	segments: readonly StorySegment[]
): number | null {
	let id: string;
	try {
		id = decodeURIComponent(hash.replace(/^#/, '')).trim();
	} catch {
		return null;
	}
	if (!id) return null;

	let part = 0;
	let pageIndex = pages.findIndex((page) => page.id === id);
	if (pageIndex === -1) {
		const match = PHOTO_SUFFIX.exec(id);
		if (!match) return null;
		pageIndex = pages.findIndex((page) => page.id === match[1]);
		if (pageIndex === -1) return null;
		part = Math.min(segmentCount(pages[pageIndex]!), Math.max(1, Number(match[2]))) - 1;
	}
	const index = segments.findIndex((segment) => segment.page === pageIndex && segment.part === part);
	return index === -1 ? null : index;
}

/* ------------------------------------------------------------------------- */
/* Taps, swipes and keys                                                      */
/* ------------------------------------------------------------------------- */

/** A pointer that moves less than this, in px, is a tap. */
export const TAP_SLOP_PX = 10;
/** A horizontal drag at least this long, in px, is a swipe. */
export const SWIPE_MIN_PX = 48;
/** A press held longer than this, in ms, is not a tap (it is reading, or a long press). */
export const TAP_MAX_MS = 600;

/** Which way a tap at `x` goes: the left third of the page goes back, the rest forward. */
export function tapZone(x: number, left: number, width: number): StoryDirection {
	return width > 0 && x - left < width / 3 ? 'back' : 'forward';
}

export interface StoryGesture {
	startX: number;
	startY: number;
	endX: number;
	endY: number;
	/** How long the pointer was down, in ms. */
	durationMs: number;
	/** The page's left edge and width, in the same coordinates. */
	left: number;
	width: number;
	/** The pointer went down on a button, link, input, media control, the bars or a sheet. */
	startedOnControl: boolean;
	/** The Fan has text selected: they were reading, not paging. */
	hasSelection?: boolean;
}

/**
 * What a finished pointer gesture does: forward, back, or nothing.
 * Controls own their own taps. A clear horizontal swipe pages (left to go
 * forward). A tap pages by zone. Anything else (a vertical scroll, a diagonal
 * drag, a long press, a selection) does nothing.
 */
export function classifyGesture(gesture: StoryGesture): StoryDirection | null {
	if (gesture.startedOnControl) return null;
	const dx = gesture.endX - gesture.startX;
	const dy = gesture.endY - gesture.startY;
	const distance = Math.hypot(dx, dy);

	if (distance >= TAP_SLOP_PX) {
		if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
			return dx < 0 ? 'forward' : 'back';
		}
		return null;
	}
	if (gesture.hasSelection || gesture.durationMs > TAP_MAX_MS) return null;
	return tapZone(gesture.endX, gesture.left, gesture.width);
}

export interface StoryKey {
	key: string;
	altKey?: boolean;
	ctrlKey?: boolean;
	metaKey?: boolean;
	shiftKey?: boolean;
	/** Focus is in a text field, a select, an editable element or a media control. */
	inEditable?: boolean;
}

/** The arrow keys page, unless a modifier is held or the Fan is typing or using a control that takes arrows. */
export function keyDirection(event: StoryKey): StoryDirection | null {
	if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.inEditable) return null;
	if (event.key === 'ArrowRight') return 'forward';
	if (event.key === 'ArrowLeft') return 'back';
	return null;
}

/* ------------------------------------------------------------------------- */
/* What a screen reader hears                                                 */
/* ------------------------------------------------------------------------- */

/** "Page 3 of 7", and ", photo 2 of 4" on a page with several photos. */
export function pageAnnouncement(
	pages: readonly StoryPageInfo[],
	segments: readonly StorySegment[],
	current: number
): string {
	const segment = segments[clampSegment(current, segments.length)];
	if (!segment) return '';
	const page = pages[segment.page]!;
	const base = `Page ${segment.page + 1} of ${pages.length}`;
	const photos = segmentCount(page);
	return photos > 1 ? `${base}, photo ${segment.part + 1} of ${photos}` : base;
}
