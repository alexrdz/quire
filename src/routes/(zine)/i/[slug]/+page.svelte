<script lang="ts">
	import StoryReader from '$lib/components/zine/story/StoryReader.svelte';
	import StoryCover from '$lib/components/zine/story/StoryCover.svelte';
	import StoryPhoto from '$lib/components/zine/story/StoryPhoto.svelte';
	import SetlistPage from '$lib/components/zine/SetlistPage.svelte';
	import AudioPage from '$lib/components/zine/AudioPage.svelte';
	import VideoPage from '$lib/components/zine/VideoPage.svelte';
	import TextPage from '$lib/components/zine/TextPage.svelte';
	import WallPage from '$lib/components/zine/WallPage.svelte';
	import Endpaper from '$lib/components/zine/Endpaper.svelte';
	import AuthDrawer from '$lib/components/zine/AuthDrawer.svelte';
	import {
		contentPageId,
		contentPageShell,
		endpaperShell,
		parseContent,
		wallShell,
		type AuthAction,
		type PageSource
	} from '$lib/components/zine/reader';
	import { resolvePhotoEntries } from '$domain/photo-pile';
	import type { StoryPageInfo } from '$domain/story';

	let { data, form } = $props();

	/** Tip buttons show only when the Artist has a Venmo username (ADR 0008). */
	const showTips = $derived(Boolean(data.artist.venmoUsername) && !data.isArtistClosed);

	// Auth drawer state (ui-prototype bottom sheet)
	let authDrawerOpen = $state(false);
	let pendingAuthAction = $state<AuthAction>('');

	// Wall note draft, kept here so it survives Google sign-in (SPEC.md §5.5)
	let noteBody = $state('');

	// Restore pending draft from sessionStorage after returning from Google OAuth (SPEC.md §5.5)
	$effect(() => {
		if (typeof window !== 'undefined') {
			const savedDraft = sessionStorage.getItem(`quire_draft_${data.issue.id}`);
			if (savedDraft) {
				noteBody = savedDraft;
				if (data.viewer) {
					sessionStorage.removeItem(`quire_draft_${data.issue.id}`);
				}
			}
		}
	});

	// Combine bespoke pages + master template recurring pages in sequence (SPEC.md §5.2)
	let contentPages = $derived.by(() => {
		const bespoke = (data.issuePages || []).map((p: { id: string; kind: string; contentJson: string }) => ({
			...p,
			source: 'bespoke' as PageSource
		}));
		const template = (data.templatePages || []).map((p: { id: string; kind: string; contentJson: string }) => ({
			...p,
			source: 'template' as PageSource
		}));
		const combined = [...bespoke, ...template];
		if (combined.length > 0) return combined;
		return [
			{
				id: 'fallback-page',
				kind: 'text',
				source: 'bespoke' as PageSource,
				contentJson: JSON.stringify({
					title: `Tonight at ${data.issue.venue}`,
					body:
						data.issue.coverNote ||
						'Thank you for gathering with us tonight. Read the pages, leave your mark on the Wall, and claim your attendance stub.'
				})
			}
		];
	});

	const isPhoto = (kind: string) => kind === 'photo' || kind === 'image';

	// Each content page once, with its parsed content and, for a photo page, its photos.
	let readerPages = $derived(
		contentPages.map((page) => {
			const content = parseContent(page.contentJson);
			return { ...page, content, photos: isPhoto(page.kind) ? resolvePhotoEntries(content) : [] };
		})
	);

	// The Stories reader's pages (ADR 0011): the Cover, the content pages (one segment
	// each; a photo page's polaroid stack handles its photos, B1-T35), the Wall and the
	// Endpaper. The ids are also the URL hashes.
	let storyPages = $derived<StoryPageInfo[]>([
		{ id: 'page-cover', segments: 1 },
		...readerPages.map((_page, idx) => ({ id: contentPageId(idx), segments: 1 })),
		{ id: 'page-wall', segments: 1 },
		{ id: 'page-endpaper', segments: 1 }
	]);

	function openAuthFor(action: AuthAction) {
		pendingAuthAction = action;
		if (typeof window !== 'undefined' && action === 'note' && noteBody.trim().length > 0) {
			sessionStorage.setItem(`quire_draft_${data.issue.id}`, noteBody);
		}
		authDrawerOpen = true;
	}
</script>

<svelte:head>
	<title>{data.issue.city} @ {data.issue.venue} — {data.artist.displayName} | Quire</title>
</svelte:head>

<StoryReader
	pages={storyPages}
	artist={data.artist}
	issue={data.issue}
	noteCount={data.notes.length}
	{showTips}
	tipPresets={data.tipPresets}
	tipsOpenVenmo={data.features.tipsOpenVenmo}
>
	{#snippet page(index: number, part: number, current: boolean)}
		{#if index === 0}
			<StoryCover
				artist={data.artist}
				issue={data.issue}
				signedIn={Boolean(data.viewer)}
				isScanVerified={data.isScanVerified}
				isArtistClosed={data.isArtistClosed}
				{showTips}
				tipPresets={data.tipPresets}
				tipsOpenVenmo={data.features.tipsOpenVenmo}
				onSignIn={() => openAuthFor('')}
			/>
		{:else if index <= readerPages.length}
			<!-- Bespoke and Master Template pages (SPEC.md §5.2). -->
			{@const idx = index - 1}
			{@const entry = readerPages[idx]!}
			{@const content = entry.content}
			{@const shell = contentPageShell(idx, readerPages.length)}
			{#if isPhoto(entry.kind)}
				<StoryPhoto
					id={shell.id}
					photos={entry.photos}
					title={content.title}
					body={content.body}
					city={data.issue.city}
				/>
			{:else if entry.kind === 'setlist'}
				<SetlistPage {shell} {content} venue={data.issue.venue} />
			{:else if entry.kind === 'audio'}
				<AudioPage
					{shell}
					{content}
					{current}
					coverArtUrl={data.artist.coverArtUrl}
					artistName={data.artist.displayName}
				/>
			{:else if entry.kind === 'video'}
				<VideoPage {shell} {content} {current} />
			{:else}
				<TextPage {shell} {content} source={entry.source} artistName={data.artist.displayName} />
			{/if}
		{:else if index === readerPages.length + 1}
			<!-- The Wall (public guestbook, SPEC.md §5.5); R-T04 restyles it. -->
			<WallPage
				shell={wallShell(readerPages.length)}
				notes={data.notes}
				artistId={data.artist.id}
				artistName={data.artist.displayName}
				issueId={data.issue.id}
				signedIn={Boolean(data.viewer)}
				isReadOnly={data.isReadOnly}
				isArtistClosed={data.isArtistClosed}
				formError={form?.error}
				bind:noteBody
				onSignInToPost={() => openAuthFor('note')}
			/>
		{:else}
			<!-- The Endpaper (final page, SPEC.md §5.6 and §7); R-T04 restyles it. -->
			<Endpaper
				shell={endpaperShell(readerPages.length)}
				issue={data.issue}
				artistName={data.artist.displayName}
				artistSlug={data.artist.slug}
				signedIn={Boolean(data.viewer)}
				isScanVerified={data.isScanVerified}
				stamped={data.collectionStatus === 'stamped' || Boolean(form?.stamped)}
				saved={data.collectionStatus === 'saved' || Boolean(form?.saved)}
				onSignIn={openAuthFor}
			/>
		{/if}
	{/snippet}

	{#if authDrawerOpen}
		<AuthDrawer
			pendingAction={pendingAuthAction}
			fanSignIn={data.features.fanSignIn}
			mode={data.features.mode}
			fanSignInError={form?.fanSignInError}
			onClose={() => (authDrawerOpen = false)}
		/>
	{/if}
</StoryReader>
