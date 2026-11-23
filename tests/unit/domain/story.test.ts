import { describe, expect, it } from 'vitest';
import {
	SWIPE_MIN_PX,
	TAP_MAX_MS,
	TAP_SLOP_PX,
	buildSegments,
	clampSegment,
	classifyGesture,
	firstSegmentOfPage,
	keyDirection,
	pageAnnouncement,
	parseStoryHash,
	progressStates,
	segmentHash,
	stepSegment,
	tapZone,
	type StoryGesture,
	type StoryPageInfo
} from '$domain/story';

/** Cover, a three-photo page, a setlist, the Wall and the Endpaper. */
const PAGES: StoryPageInfo[] = [
	{ id: 'page-cover', segments: 1 },
	{ id: 'page-content-0', segments: 3 },
	{ id: 'page-content-1', segments: 1 },
	{ id: 'page-wall', segments: 1 },
	{ id: 'page-endpaper', segments: 1 }
];
const SEGMENTS = buildSegments(PAGES);

describe('segments', () => {
	it('gives every page one segment, and every photo of a photo page its own', () => {
		expect(SEGMENTS).toEqual([
			{ page: 0, part: 0 },
			{ page: 1, part: 0 },
			{ page: 1, part: 1 },
			{ page: 1, part: 2 },
			{ page: 2, part: 0 },
			{ page: 3, part: 0 },
			{ page: 4, part: 0 }
		]);
	});

	it('treats a page with no, fractional or invalid segments as one', () => {
		expect(buildSegments([{ id: 'a', segments: 0 }, { id: 'b', segments: 2.7 }, { id: 'c', segments: NaN }])).toEqual([
			{ page: 0, part: 0 },
			{ page: 1, part: 0 },
			{ page: 1, part: 1 },
			{ page: 2, part: 0 }
		]);
	});

	it('finds the first segment of a page', () => {
		expect(firstSegmentOfPage(SEGMENTS, 1)).toBe(1);
		expect(firstSegmentOfPage(SEGMENTS, 2)).toBe(4);
		expect(firstSegmentOfPage(SEGMENTS, 99)).toBe(0);
	});

	it('marks the bars done, current and to do', () => {
		expect(progressStates(4, 2)).toEqual(['done', 'done', 'current', 'todo']);
		expect(progressStates(3, -5)).toEqual(['current', 'todo', 'todo']);
		expect(progressStates(3, 99)).toEqual(['done', 'done', 'current']);
		expect(progressStates(0, 0)).toEqual([]);
	});
});

describe('clamping and stepping', () => {
	it('keeps an index inside the segments', () => {
		expect(clampSegment(-1, 7)).toBe(0);
		expect(clampSegment(3, 7)).toBe(3);
		expect(clampSegment(3.9, 7)).toBe(3);
		expect(clampSegment(7, 7)).toBe(6);
		expect(clampSegment(NaN, 7)).toBe(0);
		expect(clampSegment(Infinity, 7)).toBe(0);
		expect(clampSegment(2, 0)).toBe(0);
	});

	it('steps one segment at a time and stops at both ends, never wrapping', () => {
		expect(stepSegment(0, 7, 'forward')).toBe(1);
		expect(stepSegment(1, 7, 'back')).toBe(0);
		expect(stepSegment(0, 7, 'back')).toBe(0);
		expect(stepSegment(6, 7, 'forward')).toBe(6);
		expect(stepSegment(40, 7, 'back')).toBe(5);
	});
});

describe('the URL hash', () => {
	it('names the page, and the photo after the first', () => {
		expect(segmentHash(PAGES, SEGMENTS[0])).toBe('#page-cover');
		expect(segmentHash(PAGES, SEGMENTS[1])).toBe('#page-content-0');
		expect(segmentHash(PAGES, SEGMENTS[3])).toBe('#page-content-0-photo-3');
		expect(segmentHash(PAGES, undefined)).toBe('');
	});

	it('round-trips every segment', () => {
		SEGMENTS.forEach((segment, index) => {
			expect(parseStoryHash(segmentHash(PAGES, segment), PAGES, SEGMENTS)).toBe(index);
		});
	});

	it('reads the hashes sign-in returns to, and old page anchors', () => {
		expect(parseStoryHash('#page-wall', PAGES, SEGMENTS)).toBe(5);
		expect(parseStoryHash('#page-endpaper', PAGES, SEGMENTS)).toBe(6);
		expect(parseStoryHash('page-content-1', PAGES, SEGMENTS)).toBe(4);
	});

	it('lands a photo number past the end on the last photo, and photo 0 on the first', () => {
		expect(parseStoryHash('#page-content-0-photo-9', PAGES, SEGMENTS)).toBe(3);
		expect(parseStoryHash('#page-content-0-photo-0', PAGES, SEGMENTS)).toBe(1);
		expect(parseStoryHash('#page-content-1-photo-2', PAGES, SEGMENTS)).toBe(4);
	});

	it('names no segment for an empty, unknown or malformed hash', () => {
		for (const hash of ['', '#', '#tip', '#page-content-9', '#page-content-9-photo-2', '#%E0%A4%A', '#page-cover-photo-x']) {
			expect(parseStoryHash(hash, PAGES, SEGMENTS), hash).toBeNull();
		}
	});
});

describe('taps and swipes', () => {
	const tap = (x: number, extra: Partial<StoryGesture> = {}): StoryGesture => ({
		startX: x,
		startY: 400,
		endX: x,
		endY: 400,
		durationMs: 120,
		left: 0,
		width: 390,
		startedOnControl: false,
		...extra
	});

	it('goes back in the left third and forward in the right two-thirds', () => {
		expect(tapZone(0, 0, 390)).toBe('back');
		expect(tapZone(129, 0, 390)).toBe('back');
		expect(tapZone(130, 0, 390)).toBe('forward');
		expect(tapZone(389, 0, 390)).toBe('forward');
		// On desktop the page is a column away from the left edge.
		expect(tapZone(500, 400, 480)).toBe('back');
		expect(tapZone(700, 400, 480)).toBe('forward');
		expect(tapZone(10, 0, 0)).toBe('forward');
	});

	it('pages on a tap by zone', () => {
		expect(classifyGesture(tap(50))).toBe('back');
		expect(classifyGesture(tap(300))).toBe('forward');
		expect(classifyGesture(tap(300, { endX: 300 + TAP_SLOP_PX - 1 }))).toBe('forward');
	});

	it('never pages from a control, a selection or a long press', () => {
		expect(classifyGesture(tap(300, { startedOnControl: true }))).toBeNull();
		expect(classifyGesture(tap(300, { startedOnControl: true, endX: 300 - SWIPE_MIN_PX * 3 }))).toBeNull();
		expect(classifyGesture(tap(300, { hasSelection: true }))).toBeNull();
		expect(classifyGesture(tap(300, { durationMs: TAP_MAX_MS + 1 }))).toBeNull();
	});

	it('pages on a horizontal swipe: left goes forward, right goes back', () => {
		expect(classifyGesture(tap(300, { endX: 300 - SWIPE_MIN_PX }))).toBe('forward');
		expect(classifyGesture(tap(100, { endX: 100 + SWIPE_MIN_PX, durationMs: 900 }))).toBe('back');
	});

	it('does nothing for a short drag, a vertical scroll or a diagonal drag', () => {
		expect(classifyGesture(tap(300, { endX: 300 - TAP_SLOP_PX - 5 }))).toBeNull();
		expect(classifyGesture(tap(300, { endY: 200 }))).toBeNull();
		expect(classifyGesture(tap(300, { endX: 240, endY: 340 }))).toBeNull();
	});
});

describe('keys', () => {
	it('pages on the arrow keys only', () => {
		expect(keyDirection({ key: 'ArrowRight' })).toBe('forward');
		expect(keyDirection({ key: 'ArrowLeft' })).toBe('back');
		for (const key of ['ArrowUp', 'ArrowDown', ' ', 'Enter', 'a']) expect(keyDirection({ key }), key).toBeNull();
	});

	it('leaves the arrows alone with a modifier or while typing', () => {
		for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'inEditable'] as const) {
			expect(keyDirection({ key: 'ArrowRight', [modifier]: true }), modifier).toBeNull();
		}
	});
});

describe('announcements', () => {
	it('says the page, and the photo on a page with several', () => {
		expect(pageAnnouncement(PAGES, SEGMENTS, 0)).toBe('Page 1 of 5');
		expect(pageAnnouncement(PAGES, SEGMENTS, 2)).toBe('Page 2 of 5, photo 2 of 3');
		expect(pageAnnouncement(PAGES, SEGMENTS, 6)).toBe('Page 5 of 5');
		expect(pageAnnouncement(PAGES, SEGMENTS, 99)).toBe('Page 5 of 5');
		expect(pageAnnouncement([], [], 0)).toBe('');
	});
});
