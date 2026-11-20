import { describe, expect, it, vi } from 'vitest';
import { render } from 'svelte/server';
import { contentPageShell, endpaperShell, wallShell } from '$lib/components/zine/reader';

vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));

const { default: SetlistPage } = await import('$lib/components/zine/SetlistPage.svelte');
const { default: PhotoPage } = await import('$lib/components/zine/PhotoPage.svelte');
const { default: AudioPage } = await import('$lib/components/zine/AudioPage.svelte');
const { default: VideoPage } = await import('$lib/components/zine/VideoPage.svelte');
const { default: TextPage } = await import('$lib/components/zine/TextPage.svelte');
const { default: WallPage } = await import('$lib/components/zine/WallPage.svelte');
const { default: Endpaper } = await import('$lib/components/zine/Endpaper.svelte');

const shell = (kind: string, index = 0, count = 3) =>
	contentPageShell(index, count, { kind, source: 'bespoke' }, 'Brooklyn');

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
	it('a content page sits in the shell: anchor, chips, page number and nav', () => {
		const { body } = render(SetlistPage, {
			props: { shell: shell('setlist'), content: { songs: ['Intro'] }, venue: 'The Room' }
		});
		expect(body).toContain('id="page-content-0"');
		expect(body).toMatch(/class="page zine-paper zine-page content-page-canvas\s*[^"]*"/);
		expect(body).toContain('Brooklyn');
		expect(body).toContain('SETLIST');
		expect(body).toMatch(/Page 2 of 6/);
		expect(body).toContain('Next Page →');
		expect(body).toContain('Intro');
		expect(body).toContain('style="--page-photo: none;"');
	});

	it('a photo page backs itself with its first photo and renders the pile', () => {
		const { body } = render(PhotoPage, {
			props: { shell: shell('photo'), content: { title: 'Pit', imageUrl: "/uploads/it's.webp" }, city: 'Brooklyn' }
		});
		expect(body).toContain('has-photo-bg');
		expect(body).toContain("url('/uploads/it%27s.webp')");
		expect(body).toMatch(/class="pile-stage[\s"]/);
		expectOnlyCustomProperties(body);
	});

	it('a photo page without photos has no backdrop and no pile', () => {
		const { body } = render(PhotoPage, { props: { shell: shell('photo'), content: {}, city: 'Brooklyn' } });
		expect(body).not.toContain('has-photo-bg');
		expect(body).not.toContain('pile-stage');
		expect(body).toContain('From Tonight');
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
				shell: contentPageShell(0, 1, { kind: 'text', source: 'template' }, 'Brooklyn'),
				content: {},
				source: 'template',
				artistName: 'The Neon Velvet'
			}
		});
		expect(body).toContain('Band Liner Note');
		expect(body).toContain('About The Neon Velvet');
		expect(body).toContain('Next: The Wall →');
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
		expect(guest).toMatch(/Page 6 of 6/);
	});
});
