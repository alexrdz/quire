import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { contentPageShell, endpaperShell, wallShell } from '$lib/components/zine/reader';
import { createRawSnippet } from 'svelte';

vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));

const { default: SetlistPage, splitSetlist } = await import('$lib/components/zine/SetlistPage.svelte');
const { default: StoryPhoto } = await import('$lib/components/zine/story/StoryPhoto.svelte');
const { default: StoryCover } = await import('$lib/components/zine/story/StoryCover.svelte');
const { default: StoryReader } = await import('$lib/components/zine/story/StoryReader.svelte');
const { default: VenmoTipPanel } = await import('$lib/components/tips/VenmoTipPanel.svelte');
const { default: AudioPage } = await import('$lib/components/zine/AudioPage.svelte');
const { default: VideoPage } = await import('$lib/components/zine/VideoPage.svelte');
const { default: TextPage } = await import('$lib/components/zine/TextPage.svelte');
const { default: WallPage, timeAgo, initialsFor } = await import('$lib/components/zine/WallPage.svelte');
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
		expect(body).toMatch(/<section[^>]*class="story-setlist[\s"]/);
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
		expect(body).toMatch(/<time datetime="2026-10-12"[^>]*>Oct 12, 2026<\/time>/);
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

	it('the tip sheet panel has a short title, "with Venmo" below, and says what the custom button needs', () => {
		const props = { artistSlug: 'nv', artistName: 'The Neon Velvet', venmoUsername: 'neon-velvet', issueSlug: 'x', presets: [3, 5, 10], opensVenmo: true };
		const sheet = render(VenmoTipPanel, { props: { ...props, compact: true } }).body;
		expect(sheet).toMatch(/<h2 class="venmo-tip-title">Tip The Neon Velvet<\/h2>/);
		expect(sheet).toMatch(/With Venmo: opens Venmo to pay/);
		expect(sheet).toMatch(/data-testid="venmo-custom-disabled">\s*Enter an amount\s*</);
		// The Back Page keeps its panel copy.
		const backPage = render(VenmoTipPanel, { props }).body;
		expect(backPage).toMatch(/<h2 class="venmo-tip-title">Tip The Neon Velvet with Venmo<\/h2>/);
		expect(backPage).toMatch(/data-testid="venmo-custom-disabled">\s*Tip with Venmo\s*</);
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
		// The header's date is for people, in the Issue's own calendar day.
		expect(body).toContain('Brooklyn · Oct 12');
		expect(body).not.toContain('2026-10-12<');
		expect(body).toContain('href="/a/the-neon-velvet"');
		// The bottom bar is not on the Cover.
		expect(body).not.toContain('story-bar');
		expect(body).toContain('aria-live="polite"');
		expect(body).toContain('--on-accent: #090710');
		expectOnlyCustomProperties(body);
	});

	it('the audio page: cover art, title and a labelled player; the demo preview starts at 0:00 of 3:42', () => {
		const { body } = render(AudioPage, {
			props: { shell: shell('audio'), content: {}, coverArtUrl: '/art.webp', artistName: 'The Neon Velvet' }
		});
		expect(body).toContain('src="/art.webp"');
		expect(body).toContain('alt="Cover art for The Neon Velvet"');
		expect(body).toContain('Demo preview');
		expect(body).toContain('aria-label="Play Studio Session Bounce"');
		expect(body).toMatch(/<input[^>]*type="range"[^>]*aria-label="Seek in Studio Session Bounce"/);
		expect(body).toContain('aria-valuetext="0:00 of 3:42"');
		expect(body).not.toMatch(/tape|scrap|cassette|--zine-|rotate\(/i);
		expectOnlyCustomProperties(body);
	});

	it('an audio page without cover art shows the initials; a real track has an audio element and no demo label', () => {
		const { body } = render(AudioPage, {
			props: {
				shell: shell('audio'),
				content: { title: 'Night Drive', audioUrl: '/uploads/a.mp3', duration: '02:10' },
				artistName: 'The Neon Velvet'
			}
		});
		expect(body).toMatch(/story-audio-initials[^>]*>NV</);
		expect(body).toContain('<audio');
		expect(body).toContain('src="/uploads/a.mp3"');
		expect(body).not.toContain('Demo preview');
		expect(body).toContain('aria-valuetext="0:00 of 2:10"');
	});

	it('a YouTube page starts as a facade, with no iframe until tapped', () => {
		const { body } = render(VideoPage, {
			props: { shell: shell('video'), content: { videoUrl: 'https://youtu.be/dQw4w9WgXcQ' } }
		});
		expect(body).toContain('i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
		expect(body).toContain('aria-label="Play YouTube video"');
		expect(body).toContain('Watch on YouTube');
		expect(body).not.toContain('<iframe');
	});

	it('an uploaded clip fills the page, plays inline, loops, and has an Unmute button and a scrim caption', () => {
		const portrait = render(VideoPage, {
			props: { shell: shell('video'), content: { title: 'Soundcheck', videoUrl: '/uploads/clip.mp4', orientation: 'portrait' } }
		}).body;
		expect(portrait).toMatch(/<video[^>]*class="story-video-clip[^"]*"/);
		expect(portrait).toMatch(/<video[^>]*playsinline/);
		expect(portrait).toMatch(/<video[^>]*loop/);
		expect(portrait).toMatch(/<video[^>]*controls/);
		expect(portrait).not.toMatch(/story-video-clip[^"]*is-landscape/);
		expect(portrait).toContain('aria-label="Unmute video"');
		expect(portrait).toMatch(/class="story-video-caption[^"]*"[\s\S]*Soundcheck/);
		const landscape = render(VideoPage, {
			props: { shell: shell('video'), content: { videoUrl: '/uploads/clip.mp4', orientation: 'landscape' } }
		}).body;
		expect(landscape).toMatch(/story-video-clip[^"]*is-landscape/);
		for (const body of [portrait, landscape]) {
			expect(body).not.toMatch(/tape|scrap|bezel|video-screen|rotate\(/i);
			expectOnlyCustomProperties(body);
		}
	});

	it('a link-out video is a clean card with one button', () => {
		const { body } = render(VideoPage, {
			props: { shell: shell('video'), content: { title: 'Tour Doc', videoUrl: 'https://example.com/watch' } }
		});
		expect(body).toMatch(/class="story-link-card[^"]*"/);
		expect(body).toMatch(/<a[^>]*href="https:\/\/example.com\/watch"[^>]*class="story-link-button[^"]*"[^>]*>\s*Open video/);
	});

	it('a setlist lists every song in order, numbered, with an Encore divider before the encore', () => {
		const songs = ['Static Bloom', 'Velvet Wire', 'Night Bus', 'Subway Static (Encore)', 'Last Light'];
		const { body } = render(SetlistPage, { props: { shell: shell('setlist'), content: { songs }, venue: 'The Room' } });
		expect(body).toContain('The Room');
		expect(body).toContain("Tonight's Setlist");
		// Shown in order; the encore song without its suffix.
		const shown = ['Static Bloom', 'Velvet Wire', 'Night Bus', 'Subway Static', 'Last Light'];
		const at = shown.map((song) => body.indexOf(`>${song}<`));
		expect(at.every((i) => i > 0)).toBe(true);
		expect([...at].sort((a, b) => a - b)).toEqual(at);
		expect(body).not.toContain('(Encore)');
		expect(body.match(/class="setlist-num[^"]*"[^>]*>(\d\d)</g)?.map((m) => m.slice(-3, -1))).toEqual(['01', '02', '03', '04', '05']);
		expect(body.indexOf('>Encore</h3>')).toBeGreaterThan(body.indexOf('>Night Bus<'));
		expect(body.indexOf('>Encore</h3>')).toBeLessThan(body.indexOf('>Subway Static<'));
		expect(body).toMatch(/<ol class="setlist-list[^"]*" start="4"/);
		// No decoration that isn't information: no Live tag, no tape, sheet or tilt.
		expect(body).not.toMatch(/setlist-tag|>Live</);
		expect(body).not.toMatch(/tape|scrap|setlist-sheet|type-face|rotate\(|--sheet-tilt/i);
		expectOnlyCustomProperties(body);
	});

	it('splitSetlist: the encore starts at "(Encore)" or a bare "Encore", and nowhere else', () => {
		// A "(Encore)" suffix, any case, optional spaces: the divider goes before it, and the suffix is not shown.
		expect(splitSetlist(['A', 'B', 'C (Encore)', 'D'])).toEqual({ main: ['A', 'B'], encore: ['C', 'D'], hasEncore: true });
		expect(splitSetlist(['A', 'B(encore)', 'C ( ENCORE ) '])).toEqual({ main: ['A'], encore: ['B', 'C'], hasEncore: true });
		// A bare "Encore" is the divider itself, not a song.
		expect(splitSetlist(['A', 'B', 'Encore', 'C'])).toEqual({ main: ['A', 'B'], encore: ['C'], hasEncore: true });
		expect(splitSetlist(['A', '  ENCORE  ', 'C'])).toEqual({ main: ['A'], encore: ['C'], hasEncore: true });
		expect(splitSetlist(['A', 'Encore'])).toEqual({ main: ['A'], encore: [], hasEncore: true });
		// A second marker after the first is dropped.
		expect(splitSetlist(['A', 'Encore', 'B', 'Encore', 'C'])).toEqual({ main: ['A'], encore: ['B', 'C'], hasEncore: true });
		// "Encore" anywhere else in a title is an ordinary song.
		for (const songs of [['Encore Une Fois', 'B'], ['A', 'Encores and Endings'], ['A', 'The Encore Kid'], ['A', 'Encore: Live']]) {
			expect(splitSetlist(songs), songs.join(' | ')).toEqual({ main: songs, encore: [], hasEncore: false });
		}
		// The stored list is untouched.
		const stored = ['A', 'B (Encore)'];
		splitSetlist(stored);
		expect(stored).toEqual(['A', 'B (Encore)']);
	});

	it('a setlist without songs keeps its default list; its "Encore" becomes the divider', () => {
		const { body } = render(SetlistPage, { props: { shell: shell('setlist'), content: {}, venue: 'The Room' } });
		for (const song of ['Opener', 'New Track', 'Crowd Favorite']) expect(body).toContain(`>${song}<`);
		expect(body).toContain('>Encore</h3>');
		expect(body).not.toMatch(/setlist-song[^>]*>Encore</);
	});

	it('a text page is a readable article in a scrolling region, keeping its words as written', () => {
		const { body } = render(TextPage, {
			props: { shell: shell('text'), content: { title: 'Load Out', body: 'We packed the van at 2am.' }, source: 'bespoke', artistName: 'The Neon Velvet' }
		});
		expect(body).toMatch(/<div class="story-scroll[^"]*" tabindex="0" role="region"/);
		expect(body).toMatch(/<article class="story-article/);
		expect(body).toContain('Load Out');
		expect(body).toContain('We packed the van at 2am.');
		expect(body).not.toMatch(/tape|scrap|rotate\(/i);
		expectOnlyCustomProperties(body);
		const bespokeDefault = render(TextPage, {
			props: { shell: shell('text'), content: {}, source: 'bespoke', artistName: 'The Neon Velvet' }
		}).body;
		expect(bespokeDefault).toContain('From the Road');
		expect(bespokeDefault).toContain('Thank you for being here tonight with us in this room.');
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

	it('the Wall is a comment thread: avatar, name, Was there, time ago, the Artist reply, Flag in a more menu', () => {
		const base = {
			shell: wallShell(3),
			notes: [
				{
					id: 'n1',
					body: 'Loud!',
					wasThere: true,
					author: { name: 'Maya Lin' },
					createdAt: new Date(Date.now() - 5 * 60_000),
					replies: [{ body: 'Thanks' }]
				}
			],
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
		expect(fan).toMatch(/class="wall-avatar[^"]*"[^>]*>ML</);
		expect(fan).toMatch(/class="was-there[^"]*">Was there</);
		expect(fan).toMatch(/class="note-time[^"]*">5m</);
		expect(fan).toMatch(/class="artist-badge[^"]*">Artist</);
		expect(fan).toContain('Thanks');
		// Flag lives in the note's "more" menu, closed until tapped.
		expect(fan).toContain('aria-label="More for the note from Maya Lin"');
		expect(fan).not.toContain('?/flagNote');
		expect(fan).not.toMatch(/tape|stamp|scrap|marker-face|type-face|--tilt/);
		expectOnlyCustomProperties(fan);

		const guest = render(WallPage, { props: { ...base, signedIn: false } }).body;
		expect(guest).not.toContain('?/submitNote');
		expect(guest).not.toContain('More for the note');
		expect(guest).toContain('Sign in to post');

		const readOnly = render(WallPage, { props: { ...base, signedIn: true, isReadOnly: true } }).body;
		expect(readOnly).not.toContain('?/submitNote');
		expect(readOnly).toContain('read-only');

		// In the sheet: the same thread, its own field ids, no page section.
		const sheet = render(WallPage, { props: { ...base, signedIn: true, variant: 'sheet' } }).body;
		expect(sheet).not.toContain('id="page-wall"');
		expect(sheet).toContain('id="wall-sheet-note-body"');
		expect(sheet).toContain('Loud!');
	});

	it('timeAgo reads like a comment thread, and initials come from the name', () => {
		const now = new Date('2026-10-13T12:00:00Z');
		expect(timeAgo(new Date('2026-10-13T11:59:40Z'), now)).toBe('just now');
		expect(timeAgo(new Date('2026-10-13T11:15:00Z'), now)).toBe('45m');
		expect(timeAgo(new Date('2026-10-13T03:00:00Z'), now)).toBe('9h');
		expect(timeAgo('2026-10-10T12:00:00Z', now)).toBe('3d');
		expect(timeAgo(Date.parse('2026-09-01T12:00:00Z') / 1000, now)).toBe('Sep 1');
		expect(timeAgo(null, now)).toBe('');
		expect(timeAgo('not a date', now)).toBe('');
		expect(initialsFor('Maya Lin')).toBe('ML');
		expect(initialsFor('  devon ')).toBe('D');
		expect(initialsFor('')).toBe('F');
	});

	it('the Endpaper: "That\'s the zine.", Stamp after a scan, Save anywhere, a Stamped card, and a readable date', () => {
		const base = {
			shell: endpaperShell(3),
			issue: { id: 'i1', slug: 'neon-velvet-brooklyn', date: '2026-10-12', timezone: 'America/New_York', city: 'Brooklyn', venue: "Baby's" },
			artistName: 'The Neon Velvet',
			artistSlug: 'the-neon-velvet',
			signedIn: true,
			stamped: false,
			saved: false,
			onSignIn() {}
		};
		const verified = render(Endpaper, { props: { ...base, isScanVerified: true } }).body;
		expect(verified).toContain("That's the zine.");
		expect(verified).toContain('action="?/claimStamp"');
		expect(verified).toContain('action="?/saveIssue"');
		expect(verified).toContain('Oct 12, 2026');
		expect(verified).not.toMatch(/>[^<]*2026-10-12[^<]*</);

		const remote = render(Endpaper, { props: { ...base, isScanVerified: false } }).body;
		expect(remote).not.toContain('?/claimStamp');
		expect(remote).toContain('data-testid="stamp-unavailable"');
		expect(remote).toContain('action="?/saveIssue"');

		const stamped = render(Endpaper, { props: { ...base, isScanVerified: true, stamped: true } }).body;
		expect(stamped).toMatch(/class="stamped-title[^"]*">Stamped</);
		expect(stamped).toContain("Baby's · Oct 12, 2026");
		expect(stamped).not.toContain('?/claimStamp');
		expect(stamped).not.toMatch(/ink-stamp|OFFICIAL ATTENDANCE|tape|scrap/);

		expect(render(Endpaper, { props: { ...base, saved: true, isScanVerified: false } }).body).toContain('In your Stubs');
		const guest = render(Endpaper, { props: { ...base, signedIn: false, isScanVerified: true } }).body;
		expect(guest).not.toContain('?/claimStamp');
		expect(guest).toContain('Sign in to claim your Stamp');
		expect(guest).toContain('Sign in to save');
		expect(guest).toContain('id="page-endpaper"');
		expect(guest).toContain('href="/a/the-neon-velvet"');
		expect(guest).toContain('href="/me/stubs"');
		expectOnlyCustomProperties(guest);
	});
});
