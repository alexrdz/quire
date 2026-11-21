import { describe, it, expect } from 'vitest';
import {
	contentPageShell,
	endpaperShell,
	parseContent,
	readerPageCount,
	resolveVideoEmbed,
	wallShell
} from '$lib/components/zine/reader';

describe('parseContent', () => {
	it('reads stored JSON and falls back to an empty object', () => {
		expect(parseContent('{"title":"Hi","songs":["A"]}')).toEqual({ title: 'Hi', songs: ['A'] });
		expect(parseContent('{"title":"Live Clip","orientation":"portrait"}')).toEqual({
			title: 'Live Clip',
			orientation: 'portrait'
		});
		expect(parseContent('')).toEqual({});
		expect(parseContent('not json')).toEqual({});
	});
});

describe('reader page shells', () => {
	it('counts the Cover, the content pages, the Wall and the Endpaper', () => {
		expect(readerPageCount(4)).toBe(7);
	});

	it('numbers a content page from 2 and labels its chips by source', () => {
		const bespoke = contentPageShell(0, 4, { kind: 'setlist', source: 'bespoke' }, 'Brooklyn');
		expect(bespoke).toMatchObject({ id: 'page-content-0', pageNumber: 2, pageCount: 7 });
		expect(bespoke.chips).toEqual([{ label: 'Brooklyn', tone: 'accent' }, { label: 'SETLIST' }]);

		const template = contentPageShell(3, 4, { kind: 'text', source: 'template' }, 'Brooklyn');
		expect(template.chips).toEqual([{ label: 'Band Liner Note', tone: 'highlight' }, { label: 'TEXT' }]);
	});

	it('links the first page back to the Cover and the last page on to the Wall', () => {
		expect(contentPageShell(0, 3, { kind: 'text', source: 'bespoke' }, 'X').nav).toEqual([
			{ target: 'page-cover', label: '← Prev' },
			{ target: 'page-content-1', label: 'Next Page →', primary: true }
		]);
		expect(contentPageShell(2, 3, { kind: 'text', source: 'bespoke' }, 'X').nav).toEqual([
			{ target: 'page-content-1', label: '← Prev' },
			{ target: 'page-wall', label: 'Next: The Wall →', primary: true }
		]);
		// A one-page Issue: Cover on one side, Wall on the other.
		expect(contentPageShell(0, 1, { kind: 'text', source: 'bespoke' }, 'X').nav.map((n) => n.target)).toEqual([
			'page-cover',
			'page-wall'
		]);
	});

	it('places the Wall and the Endpaper last', () => {
		expect(wallShell(4)).toMatchObject({ id: 'page-wall', pageNumber: 6, pageCount: 7 });
		expect(wallShell(4).nav.map((n) => n.target)).toEqual(['page-content-3', 'page-endpaper']);
		expect(endpaperShell(4)).toMatchObject({ id: 'page-endpaper', pageNumber: 7, pageCount: 7 });
		expect(endpaperShell(4).nav.map((n) => n.target)).toEqual(['page-wall', 'page-cover']);
		expect(endpaperShell(4).nav.some((n) => n.primary)).toBe(false);
	});
});

describe('resolveVideoEmbed', () => {
	it('turns YouTube links into a no-cookie embed with a poster', () => {
		for (const url of [
			'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
			'https://youtu.be/dQw4w9WgXcQ',
			'https://m.youtube.com/shorts/dQw4w9WgXcQ',
			'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
		]) {
			expect(resolveVideoEmbed(url), url).toMatchObject({
				kind: 'youtube',
				id: 'dQw4w9WgXcQ',
				embedSrc: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1',
				posterSrc: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
				watchUrl: url
			});
		}
	});

	it('falls back to a plain link for a YouTube URL without a usable id', () => {
		expect(resolveVideoEmbed('https://www.youtube.com/channel/abc')).toEqual({
			kind: 'external-link',
			watchUrl: 'https://www.youtube.com/channel/abc'
		});
	});

	it('turns Vimeo links into the player', () => {
		expect(resolveVideoEmbed('https://vimeo.com/76979871')).toMatchObject({
			kind: 'vimeo',
			embedSrc: 'https://player.vimeo.com/video/76979871?autoplay=1'
		});
		expect(resolveVideoEmbed('https://player.vimeo.com/video/76979871')).toMatchObject({ kind: 'vimeo', id: '76979871' });
	});

	it('embeds Bandcamp players and links other Bandcamp pages', () => {
		const player = 'https://bandcamp.com/EmbeddedPlayer/album=1/size=large';
		expect(resolveVideoEmbed(player)).toEqual({ kind: 'bandcamp-embed', embedSrc: player, watchUrl: player });
		expect(resolveVideoEmbed('https://band.bandcamp.com/album/x')).toEqual({
			kind: 'bandcamp-link',
			watchUrl: 'https://band.bandcamp.com/album/x'
		});
	});

	it('plays video files and links everything else', () => {
		expect(resolveVideoEmbed('/uploads/clip.MP4')).toEqual({ kind: 'video-file', src: '/uploads/clip.MP4' });
		expect(resolveVideoEmbed('https://cdn.example.com/a.webm')).toEqual({
			kind: 'video-file',
			src: 'https://cdn.example.com/a.webm'
		});
		expect(resolveVideoEmbed('/uploads/doc.pdf')).toEqual({ kind: 'external-link', watchUrl: '/uploads/doc.pdf' });
		expect(resolveVideoEmbed('https://example.com/watch')).toEqual({
			kind: 'external-link',
			watchUrl: 'https://example.com/watch'
		});
	});

	it('refuses empty, unparseable and non-http URLs', () => {
		expect(resolveVideoEmbed(undefined)).toEqual({ kind: 'none' });
		expect(resolveVideoEmbed('   ')).toEqual({ kind: 'none' });
		expect(resolveVideoEmbed('not a url')).toEqual({ kind: 'none' });
		expect(resolveVideoEmbed('javascript:alert(1)')).toEqual({ kind: 'none' });
		expect(resolveVideoEmbed('data:text/html,hi')).toEqual({ kind: 'none' });
	});
});
