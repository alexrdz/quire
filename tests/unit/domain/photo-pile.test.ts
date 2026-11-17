import { describe, it, expect } from 'vitest';
import {
	MAX_PHOTOS_PER_PAGE,
	createPile,
	pileTilt,
	resolvePhotoEntries,
	transitionPile,
	type PileEvent,
	type PileState
} from '$domain/photo-pile';

function run(state: PileState, ...events: PileEvent[]): PileState {
	return events.reduce((current, event) => {
		const next = transitionPile(current, event);
		if (!next.ok) throw new Error(next.error.message);
		return next.value;
	}, state);
}

describe('resolvePhotoEntries', () => {
	it('reads the photos array in order and trims values', () => {
		expect(
			resolvePhotoEntries({
				photos: [
					{ url: ' /uploads/a.jpg ', caption: ' Soundcheck ' },
					{ url: '/uploads/b.jpg', caption: '   ' },
					{ url: '/uploads/c.jpg' }
				]
			})
		).toEqual([
			{ url: '/uploads/a.jpg', caption: 'Soundcheck' },
			{ url: '/uploads/b.jpg' },
			{ url: '/uploads/c.jpg' }
		]);
	});

	it('treats a legacy imageUrl page as a one-photo pile', () => {
		expect(resolvePhotoEntries({ imageUrl: '/uploads/old.jpg' })).toEqual([
			{ url: '/uploads/old.jpg' }
		]);
	});

	it('prefers photos over imageUrl', () => {
		expect(
			resolvePhotoEntries({ imageUrl: '/uploads/a.jpg', photos: [{ url: '/uploads/b.jpg' }] })
		).toEqual([{ url: '/uploads/b.jpg' }]);
	});

	it('drops malformed entries and falls back to imageUrl when none survive', () => {
		expect(
			resolvePhotoEntries({ photos: [null, 4, { url: 7 }, { url: '' }], imageUrl: '/uploads/x.jpg' })
		).toEqual([{ url: '/uploads/x.jpg' }]);
	});

	it('returns an empty list for unusable content', () => {
		expect(resolvePhotoEntries(null)).toEqual([]);
		expect(resolvePhotoEntries('nope')).toEqual([]);
		expect(resolvePhotoEntries({})).toEqual([]);
	});

	it('caps the pile at the maximum', () => {
		const photos = Array.from({ length: 20 }, (_, i) => ({ url: `/uploads/${i}.jpg` }));
		expect(resolvePhotoEntries({ photos })).toHaveLength(MAX_PHOTOS_PER_PAGE);
	});
});

describe('pileTilt', () => {
	it('is deterministic and stays within six degrees', () => {
		for (let i = 0; i < 50; i++) {
			expect(pileTilt(i)).toBe(pileTilt(i));
			expect(Math.abs(pileTilt(i))).toBeLessThanOrEqual(6);
		}
	});

	it('does not give every photo the same tilt', () => {
		const tilts = new Set(Array.from({ length: 8 }, (_, i) => pileTilt(i)));
		expect(tilts.size).toBeGreaterThan(4);
	});
});

describe('pile position FSM', () => {
	it('starts stacked on the first photo, front side up', () => {
		expect(createPile(3)).toEqual({ phase: 'stacked', total: 3, top: 0, side: 'front' });
	});

	it('starts cleared for an empty pile', () => {
		expect(createPile(0)).toEqual({ phase: 'cleared', total: 0 });
	});

	it('tosses through the pile and clears after the last photo', () => {
		expect(run(createPile(3), 'toss')).toMatchObject({ phase: 'stacked', top: 1 });
		expect(run(createPile(3), 'toss', 'toss')).toMatchObject({ phase: 'stacked', top: 2 });
		expect(run(createPile(3), 'toss', 'toss', 'toss')).toEqual({ phase: 'cleared', total: 3 });
	});

	it('shows the front of the next photo after tossing a flipped one', () => {
		expect(run(createPile(3), 'flip', 'toss')).toMatchObject({ top: 1, side: 'front' });
	});

	it('flips back and forth', () => {
		expect(run(createPile(2), 'flip')).toMatchObject({ side: 'back' });
		expect(run(createPile(2), 'flip', 'flip')).toMatchObject({ side: 'front' });
	});

	it('restores the previous photo, including from a cleared pile', () => {
		expect(run(createPile(3), 'toss', 'restore')).toMatchObject({ top: 0 });
		expect(run(createPile(2), 'toss', 'toss', 'restore')).toMatchObject({
			phase: 'stacked',
			top: 1
		});
	});

	it('restacks a cleared pile from the first photo', () => {
		expect(run(createPile(2), 'toss', 'toss', 'restack')).toMatchObject({ top: 0, side: 'front' });
	});

	it('rejects impossible transitions', () => {
		expect(transitionPile(createPile(3), 'restore').ok).toBe(false);
		expect(transitionPile(createPile(3), 'restack').ok).toBe(false);
		const cleared = run(createPile(1), 'toss');
		expect(transitionPile(cleared, 'toss').ok).toBe(false);
		expect(transitionPile(cleared, 'flip').ok).toBe(false);
		expect(transitionPile(createPile(0), 'restore').ok).toBe(false);
	});
});
