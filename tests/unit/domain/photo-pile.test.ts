import { describe, it, expect } from 'vitest';
import { MAX_PHOTOS_PER_PAGE, resolvePhotoEntries } from '$domain/photo-pile';

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
