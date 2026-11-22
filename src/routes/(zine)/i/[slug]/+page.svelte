<script lang="ts">
	import ZineCover from '$lib/components/zine/ZineCover.svelte';
	import SetlistPage from '$lib/components/zine/SetlistPage.svelte';
	import PhotoPage from '$lib/components/zine/PhotoPage.svelte';
	import AudioPage from '$lib/components/zine/AudioPage.svelte';
	import VideoPage from '$lib/components/zine/VideoPage.svelte';
	import TextPage from '$lib/components/zine/TextPage.svelte';
	import WallPage from '$lib/components/zine/WallPage.svelte';
	import Endpaper from '$lib/components/zine/Endpaper.svelte';
	import AuthDrawer from '$lib/components/zine/AuthDrawer.svelte';
	import {
		contentPageShell,
		endpaperShell,
		getAllReaderPageIds,
		parseContent,
		stepPage,
		wallShell,
		type AuthAction,
		type PageSource
	} from '$lib/components/zine/reader';

	let { data, form } = $props();

	/** Tip buttons show only when the Artist has a Venmo username (ADR 0008). */
	const showTips = $derived(Boolean(data.artist.venmoUsername) && !data.isArtistClosed);

	// Auth drawer state (ui-prototype bottom sheet)
	let authDrawerOpen = $state(false);
	let pendingAuthAction = $state<AuthAction>('');

	// Mock audio player: only one page plays at a time.
	let playingAudioId = $state<string | null>(null);

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

	function openAuthFor(action: AuthAction) {
		pendingAuthAction = action;
		if (typeof window !== 'undefined' && action === 'note' && noteBody.trim().length > 0) {
			sessionStorage.setItem(`quire_draft_${data.issue.id}`, noteBody);
		}
		authDrawerOpen = true;
	}

	function toggleAudio(id: string) {
		playingAudioId = playingAudioId === id ? null : id;
	}

	function getActivePageId(): string {
		if (typeof document === 'undefined') return 'page-cover';
		const allIds = getAllReaderPageIds(contentPages.length);
		let closestId = allIds[0] ?? 'page-cover';
		let minDistance = Infinity;
		for (const id of allIds) {
			const el = document.getElementById(id);
			if (el) {
				const rect = el.getBoundingClientRect();
				const dist = Math.abs(rect.left);
				if (dist < minDistance) {
					minDistance = dist;
					closestId = id;
				}
			}
		}
		return closestId;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (authDrawerOpen) return;
		const target = e.target as HTMLElement | null;
		if (
			target &&
			(target.tagName === 'INPUT' ||
				target.tagName === 'TEXTAREA' ||
				target.isContentEditable ||
				target.closest('input, textarea, [contenteditable="true"]'))
		) {
			return;
		}

		if (e.key === 'ArrowRight') {
			e.preventDefault();
			stepPage(getActivePageId(), contentPages.length, 'next');
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			stepPage(getActivePageId(), contentPages.length, 'prev');
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>{data.issue.city} @ {data.issue.venue} — {data.artist.displayName} | Quire</title>
</svelte:head>

<div
	class="book-container {showTips ? 'has-floating-tip' : ''}"
	style="--accent: {data.artist.accentColor || '#05D9E8'};"
>
	<!-- PAGE 1: The Cover -->
	<ZineCover
		artist={data.artist}
		issue={data.issue}
		contentCount={contentPages.length}
		signedIn={Boolean(data.viewer)}
		isScanVerified={data.isScanVerified}
		isArtistClosed={data.isArtistClosed}
		{showTips}
		tipPresets={data.tipPresets}
		tipsOpenVenmo={data.features.tipsOpenVenmo}
		onSignIn={() => openAuthFor('')}
	/>

	<!-- BESPOKE & MASTER TEMPLATE PAGES (SPEC.md §5.2) -->
	<!-- Keyed, so per-page state (an activated video) follows its page, as before. -->
	{#each contentPages as page, idx (`${page.source}:${page.id}`)}
		{@const content = parseContent(page.contentJson)}
		{@const shell = contentPageShell(idx, contentPages.length, page, data.issue.city)}
		{#if page.kind === 'setlist'}
			<SetlistPage {shell} {content} venue={data.issue.venue} />
		{:else if page.kind === 'photo' || page.kind === 'image'}
			<PhotoPage {shell} {content} city={data.issue.city} />
		{:else if page.kind === 'audio'}
			<AudioPage
				{shell}
				{content}
				playing={playingAudioId === page.id}
				onToggle={() => toggleAudio(page.id)}
			/>
		{:else if page.kind === 'video'}
			<VideoPage {shell} {content} />
		{:else}
			<TextPage {shell} {content} source={page.source} artistName={data.artist.displayName} />
		{/if}
	{/each}

	<!-- THE WALL (PUBLIC GUESTBOOK, SPEC.md §5.5) -->
	<WallPage
		shell={wallShell(contentPages.length)}
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

	<!-- ENDPAPER (FINAL PAGE, SPEC.md §5.6 & §7) -->
	<Endpaper
		shell={endpaperShell(contentPages.length)}
		issue={data.issue}
		artistName={data.artist.displayName}
		artistSlug={data.artist.slug}
		signedIn={Boolean(data.viewer)}
		isScanVerified={data.isScanVerified}
		stamped={data.collectionStatus === 'stamped' || Boolean(form?.stamped)}
		saved={data.collectionStatus === 'saved' || Boolean(form?.saved)}
		onSignIn={openAuthFor}
	/>
</div>

<!-- Persistent floating tip trigger: jumps to the Venmo tip buttons on the Cover (ADR 0008).
     Every inner page's footer leaves room for it, so it never covers Prev or Next (Z-T08). -->
{#if showTips && !authDrawerOpen}
	<a href="#tip" class="btn-floating-tip" aria-label="Tip {data.artist.displayName} with Venmo">
		<span>Tip</span>
	</a>
{/if}

{#if authDrawerOpen}
	<AuthDrawer
		pendingAction={pendingAuthAction}
		fanSignIn={data.features.fanSignIn}
		mode={data.features.mode}
		fanSignInError={form?.fanSignInError}
		onClose={() => (authDrawerOpen = false)}
	/>
{/if}

<style>
	/* Size and offset are shared with the footer's room for it (components.css, Z-T08). */
	.btn-floating-tip {
		position: fixed;
		text-decoration: none;
		inset-block-end: var(--reader-tip-offset);
		inset-inline-end: var(--reader-tip-offset);
		min-block-size: max(44px, var(--reader-tip-size));
		min-inline-size: max(44px, var(--reader-tip-size));
		z-index: 60;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2xs);
		padding-block: var(--space-xs);
		padding-inline: var(--space-m);
		border-radius: 12px;
		background: var(--support);
		color: #ffffff;
		border: 1px solid rgba(255, 255, 255, 0.4);
		font-size: var(--text-ui);
		font-weight: var(--weight-heavy);
		cursor: pointer;
		box-shadow: 0 4px 20px rgba(255, 42, 109, 0.45), 0 0 12px rgba(255, 42, 109, 0.25);
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.btn-floating-tip:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 28px rgba(255, 42, 109, 0.7), 0 0 16px rgba(255, 42, 109, 0.4);
	}

	.btn-floating-tip:active {
		transform: translateY(0);
	}

</style>
