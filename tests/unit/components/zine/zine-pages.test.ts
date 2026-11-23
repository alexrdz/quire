import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { contentPageShell, endpaperShell, wallShell } from '$lib/components/zine/reader';
import { createRawSnippet } from 'svelte';

vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));

const { default: SetlistPage } = await import('$lib/components/zine/SetlistPage.svelte');
const { default: StoryPhoto } = await import('$lib/components/zine/story/StoryPhoto.svelte');
const { default: StoryCover } = await import('$lib/components/zine/story/StoryCover.svelte');
const { default: StoryReader } = await import('$lib/components/zine/story/StoryReader.svelte');
const { default: AudioPage } = await import('$lib/components/zine/AudioPage.svelte');
const { default: VideoPage } = await import('$lib/components/zine/VideoPage.svelte');
const { default: TextPage } = await import('$lib/components/zine/TextPage.svelte');
const { default: WallPage } = await import('$lib/components/zine/WallPage.svelte');
const { default: Endpaper } = await import('$lib/components/zine/Endpaper.svelte');

const shell = (_kind: string, index = 0, count = 3) => contentPageShell(index, count);

/** Every style attribute in the markup: CLAUDE.md allows only runtime custom properties. */
function inlineStyles(body: string): string[] {
	return [...body.matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
}

function expectOnlyCustomProperties(body: string) {
	for (const style of inlineStyles(body)) {
		for (const declaration of style.split(';').map((d) => d.trim()).filter(Boolean)) {
			expect(declaration, `inline style "${style}"`).toMatch(/^--[a-z-]+\s*:/);
		}
	}
}

describe('Issue reader page components', () => {
	it('a content page sits in the reader frame: its id, and no chips, page number or nav of its own', () => {
		const { body } = render(SetlistPage, {
			props: { shell: shell('setlist'), content: { songs: ['Intro'] }, venue: 'The Room' }
		});
		expect(body).toContain('id="page-content-0"');
		expect(body).toMatch(/class="page zine-paper content-page-canvas[\s"]/);
		expect(body).toContain('Intro');
		expect(body).not.toMatch(/Page 2 of/);
		expect(body).not.toContain('Next Page');
		expect(body).not.toContain('zine-page ');
		expectOnlyCustomProperties(body);
	});

	it('a photo page shows every photo full-bleed, the current one visible, with its caption over a scrim', () => {
		const photos = [
			{ url: '/uploads/a.webp', caption: 'Front row' },
			{ url: '/uploads/b.webp' },
			{ url: '/uploads/c.webp', caption: 'Encore' }
		];
		const first = render(StoryPhoto, { props: { id: 'page-content-0', photos, part: 0, title: 'Pit', city: 'Brooklyn' } }).body;
		expect(first).toContain('id="page-content-0"');
		expect(first.match(/<img/g)).toHaveLength(3);
		expect(first).toMatch(/class="story-photo-img[^"]*is-current[^"]*"[^>]*src="\/uploads\/a\.webp"/);
		expect(first).toContain('1 / 3');
		expect(first).toContain('Front row');
		expect(first).toContain('data-scrim');
		expect(first).not.toContain('pile-stage');
		expectOnlyCustomProperties(first);

		const third = render(StoryPhoto, { props: { id: 'page-content-0', photos, part: 2, title: 'Pit', city: 'Brooklyn' } }).body;
		expect(third).toMatch(/class="story-photo-img[^"]*is-current[^"]*"[^>]*src="\/uploads\/c\.webp"/);
		expect(third).toContain('3 / 3');
		expect(third).toContain('Encore');
		expect(third).toMatch(/class="story-photo-caption[^"]*">Encore<\/p>/);
		expect(third).not.toMatch(/class="story-photo-caption[^"]*">Front row/);
	});

	it('a photo page without photos still has its heading', () => {
		const { body } = render(StoryPhoto, { props: { id: 'page-content-0', photos: [], part: 0, city: 'Brooklyn' } });
		expect(body).not.toContain('<img');
		expect(body).toContain('From Tonight');
	});

	it('the Cover leads with the Artist, tip pills and "Open tonight\'s zine", with no paper, tape or tilt', () => {
		const props = {
			artist: {
				slug: 'the-neon-velvet',
				displayName: 'The Neon Velvet',
				coverArtUrl: '/uploads/cover.webp',
				venmoUsername: 'neon-velvet'
			},
			issue: {
				slug: 'neon-velvet-brooklyn',
				date: '2026-10-12',
				city: 'Brooklyn',
				venue: "Baby's All Right",
				status: 'published',
				coverNote: 'Thank you'
			},
			signedIn: false,
			isScanVerified: false,
			isArtistClosed: false,
			showTips: true,
			tipPresets: [3, 5, 10],
			tipsOpenVenmo: true,
			onSignIn() {}
		};
		const { body } = render(StoryCover, { props });
		expect(body).toMatch(/<h1[^>]*class="story-cover-title[^"]*"[^>]*>The Neon Velvet<\/h1>/);
		expect(body).toContain("Baby's All Right");
		expect(body).toContain('Thank you');
		// Tip-first: each pill is the real Venmo link, with the same classes as the tip panel's presets.
		const pills = [...body.matchAll(/<a[^>]*class="venmo-tip-preset story-tip-pill"[^>]*href="([^"]+)"/g)];
		expect(pills.map((m) => new URL(m[1]!.replace(/&amp;/g, '&')).searchParams.get('amount'))).toEqual(['3.00', '5.00', '10.00']);
		expect(body).toContain('Other amount');
		expect(body).toContain('Open tonight');
		expect(body).not.toMatch(/tape|zine-paper|scrap|type-label|--tilt/);
		expectOnlyCustomProperties(body);

		const noTips = render(StoryCover, { props: { ...props, showTips: false } }).body;
		expect(noTips).not.toContain('story-tip-pill');
		expect(noTips).not.toContain('venmo.com');
		const noUsername = render(StoryCover, { props: { ...props, artist: { ...props.artist, venmoUsername: null } } }).body;
		expect(noUsername).not.toContain('story-tip-pill');
		expect(render(StoryCover, { props: { ...props, isScanVerified: true } }).body).toContain('Attended Stamp Eligible');
	});

	it('the reader renders every page, only the first current, with a bar per segment and the Wall count', () => {
		const page = createRawSnippet((index: () => number, part: () => number) => ({
			render: () => `<h2>page ${index()} part ${part()}</h2>`
		}));
		const { body } = render(StoryReader, {
			props: {
				pages: [
					{ id: 'page-cover', segments: 1 },
					{ id: 'page-content-0', segments: 3 },
					{ id: 'page-wall', segments: 1 },
					{ id: 'page-endpaper', segments: 1 }
				],
				artist: { slug: 'the-neon-velvet', displayName: 'The Neon Velvet', accentColor: '#05D9E8', venmoUsername: 'neon' },
				issue: { slug: 'x', city: 'Brooklyn', date: '2026-10-12' },
				noteCount: 4,
				showTips: true,
				tipPresets: [3, 5, 10],
				tipsOpenVenmo: false,
				page
			}
		});
		expect(body.match(/class="story-progress-bar/g)).toHaveLength(6);
		expect(body.match(/data-place="current"/g)).toHaveLength(1);
		expect(body).toMatch(/data-place="current" data-page-id="page-cover"/);
		expect(body.match(/data-place="after"/g)).toHaveLength(3);
		expect(body).toContain('Brooklyn · 2026-10-12');
		expect(body).toContain('href="/a/the-neon-velvet"');
		// The bottom bar is not on the Cover.
		expect(body).not.toContain('story-bar');
		expect(body).toContain('aria-live="polite"');
		expect(body).toContain('--on-accent: #090710');
		expectOnlyCustomProperties(body);
	});

	it('the mock audio player shows progress with a class, not an inline style', () => {
		const idle = render(AudioPage, { props: { shell: shell('audio'), content: {}, playing: false, onToggle() {} } });
		const playing = render(AudioPage, { props: { shell: shell('audio'), content: {}, playing: true, onToggle() {} } });
		expect(idle.body).toContain('Play track');
		expect(playing.body).toContain('Pause track');
		expect(playing.body).toMatch(/class="audio-progress-fill is-playing/);
		expectOnlyCustomProperties(idle.body);
		expectOnlyCustomProperties(playing.body);
	});

	it('a YouTube page starts as a facade, with no iframe until tapped', () => {
		const { body } = render(VideoPage, {
			props: { shell: shell('video'), content: { videoUrl: 'https://youtu.be/dQw4w9WgXcQ' } }
		});
		expect(body).toContain('i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
		expect(body).toContain('Play Video');
		expect(body).not.toContain('<iframe');
	});

	it('a template text page is about the Artist by default', () => {
		const { body } = render(TextPage, {
			props: {
				shell: contentPageShell(0, 1),
				content: {},
				source: 'template',
				artistName: 'The Neon Velvet'
			}
		});
		expect(body).toContain('About The Neon Velvet');
	});

	it('the Wall offers the post form to a signed-in Fan and sign-in to everyone else', () => {
		const base = {
			shell: wallShell(3),
			notes: [{ id: 'n1', body: 'Loud!', wasThere: true, author: { name: 'Maya' }, replies: [{ body: 'Thanks' }] }],
			artistId: 'a1',
			artistName: 'The Neon Velvet',
			issueId: 'i1',
			isReadOnly: false,
			isArtistClosed: false,
			noteBody: '',
			onSignInToPost() {}
		};
		const fan = render(WallPage, { props: { ...base, signedIn: true } }).body;
		expect(fan).toContain('id="page-wall"');
		expect(fan).toContain('action="?/submitNote"');
		expect(fan).toContain('action="?/flagNote"');
		expect(fan).toContain('Was There');
		expect(fan).toContain('Thanks');

		const guest = render(WallPage, { props: { ...base, signedIn: false } }).body;
		expect(guest).not.toContain('?/submitNote');
		expect(guest).not.toContain('?/flagNote');
		expect(guest).toContain('Sign in with Google to Post');

		const readOnly = render(WallPage, { props: { ...base, signedIn: true, isReadOnly: true } }).body;
		expect(readOnly).not.toContain('?/submitNote');
		expect(readOnly).toContain('read-only');
	});

	it('the Endpaper claims a stamp after a scan, saves otherwise, and shows the result', () => {
		const base = {
			shell: endpaperShell(3),
			issue: { id: 'i1', slug: 'neon-velvet-brooklyn', date: '2026-10-12', city: 'Brooklyn', venue: "Baby's" },
			artistName: 'The Neon Velvet',
			artistSlug: 'the-neon-velvet',
			signedIn: true,
			stamped: false,
			saved: false,
			onSignIn() {}
		};
		expect(render(Endpaper, { props: { ...base, isScanVerified: true } }).body).toContain('action="?/claimStamp"');
		expect(render(Endpaper, { props: { ...base, isScanVerified: false } }).body).toContain('action="?/saveIssue"');
		expect(render(Endpaper, { props: { ...base, isScanVerified: true, stamped: true } }).body).toContain(
			'OFFICIAL ATTENDANCE STAMPED'
		);
		expect(render(Endpaper, { props: { ...base, isScanVerified: false, saved: true } }).body).toContain(
			'Saved to Bookmarks'
		);
		const guest = render(Endpaper, { props: { ...base, signedIn: false, isScanVerified: true } }).body;
		expect(guest).not.toContain('?/claimStamp');
		expect(guest).toContain('Sign in with Google to Claim Stamp');
		expect(guest).toContain('id="page-endpaper"');
	});
});
