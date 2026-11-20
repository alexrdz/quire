<script lang="ts">
	import { Stack, Box, Cluster } from '$lib/components/layout';
	import VenmoTipPanel from '$lib/components/tips/VenmoTipPanel.svelte';
	import MetaChip from './MetaChip.svelte';
	import { contentPageId, readerPageCount, scrollToPage } from './reader';

	interface Props {
		artist: { slug: string; displayName: string; coverArtUrl?: string | null; venmoUsername?: string | null };
		issue: {
			slug: string;
			date: string;
			city: string;
			venue: string;
			status: string;
			coverNote?: string | null;
		};
		contentCount: number;
		signedIn: boolean;
		isScanVerified: boolean;
		isArtistClosed: boolean;
		/** Venmo tip buttons (ADR 0008); off when the Artist has no Venmo username or has left. */
		showTips: boolean;
		tipPresets: number[];
		tipsOpenVenmo: boolean;
		onSignIn: () => void;
	}

	let {
		artist,
		issue,
		contentCount,
		signedIn,
		isScanVerified,
		isArtistClosed,
		showTips,
		tipPresets,
		tipsOpenVenmo,
		onSignIn
	}: Props = $props();
</script>

<section
	id="page-cover"
	class="page cover"
	style="--cover-art: {artist.coverArtUrl
		? `linear-gradient(to bottom, rgba(9, 7, 16, 0.45), rgba(9, 7, 16, 0.96)), url('${artist.coverArtUrl}')`
		: 'none'};"
>
	<div class="page-inner">
		<header class="cover-header">
			<a href="/a/{artist.slug}" class="btn-artist-link">
				← {artist.displayName}
			</a>
			<Cluster align="center" gap="xs">
				{#if isScanVerified}
					<MetaChip tone="highlight">● Attended Stamp Eligible</MetaChip>
				{/if}
				{#if signedIn}
					<a href="/me/stubs" class="btn-nav-ghost">My Stubs</a>
				{:else}
					<button type="button" class="btn-nav-primary" onclick={onSignIn}>
						Fan Sign In
					</button>
				{/if}
			</Cluster>
		</header>

		<Stack gap="md" class="cover-middle-stack">
			<Cluster align="center" gap="xs">
				<MetaChip tone="highlight">{issue.date}</MetaChip>
				<MetaChip>{issue.city}</MetaChip>
				<span class="text-muted meta-venue">@ {issue.venue}</span>
				{#if issue.status === 'cancelled'}
					<MetaChip tone="support">Cancelled</MetaChip>
				{:else if issue.status === 'draft'}
					<MetaChip tone="accent">Draft</MetaChip>
				{:else if issue.status === 'archived'}
					<MetaChip>Archived</MetaChip>
				{/if}
			</Cluster>

			<h1 class="cover-title">{issue.city}</h1>

			{#if issue.coverNote}
				<p class="cover-note-text">"{issue.coverNote}"</p>
			{/if}

			{#if isArtistClosed}
				<Box variant="subtle" padding="sm" radius="md" class="closed-artist-notice">
					This artist has left Quire. This issue is preserved in read-only archive mode.
				</Box>
			{/if}

			{#if showTips && artist.venmoUsername}
				<VenmoTipPanel
					artistSlug={artist.slug}
					artistName={artist.displayName}
					venmoUsername={artist.venmoUsername}
					issueSlug={issue.slug}
					presets={tipPresets}
					opensVenmo={tipsOpenVenmo}
				/>
			{/if}
		</Stack>

		<Cluster justify="between" align="center" gap="sm" class="cover-actions-strip">
			<button type="button" class="btn-open-zine" onclick={() => scrollToPage(contentPageId(0))}>
				Open Tonight's Zine →
			</button>
		</Cluster>

		<footer class="page-footer">
			<span>Swipe or tap to read ({readerPageCount(contentCount)} pages)</span>
			<span class="font-mono">Issue #{issue.slug}</span>
		</footer>
	</div>
</section>

<style>
	.cover {
		background-image: var(--cover-art, none);
		background-size: cover;
		background-position: center;
	}

	:global(.cover-middle-stack) {
		margin-block: auto;
	}

	.meta-venue {
		font-size: var(--text-small);
	}

	.cover-note-text {
		font-size: var(--text-body);
		max-inline-size: 42ch;
		line-height: var(--leading-body);
		color: #e4e4e7;
	}

	:global(.cover-actions-strip) {
		margin-block-start: var(--space-l);
	}

	:global(.closed-artist-notice) {
		border-color: rgba(255, 42, 109, 0.45);
		color: #ffffff;
		font-size: var(--text-small);
	}

	.btn-open-zine {
		padding-block: var(--space-xs);
		padding-inline: var(--space-s);
		font-size: var(--text-small);
	}

	/* Sleek Rectangular Buttons (Zero 9999px Pills) */
	.btn-artist-link {
		display: inline-flex;
		align-items: center;
		gap: var(--space-compact);
		padding-block: var(--space-compact);
		padding-inline: var(--space-xs);
		border-radius: 6px;
		background: rgba(1, 255, 195, 0.12);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.35);
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		text-decoration: none;
		transition: background-color 0.15s ease;
	}

	.btn-artist-link:hover {
		background: rgba(1, 255, 195, 0.22);
		color: var(--highlight);
	}

	.btn-nav-ghost {
		display: inline-flex;
		align-items: center;
		padding-block: var(--space-compact);
		padding-inline: var(--space-xs);
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.04);
		color: #a1a1aa;
		border: 1px solid rgba(255, 255, 255, 0.08);
		font-size: var(--text-meta);
		font-weight: var(--weight-semibold);
		text-decoration: none;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.btn-nav-ghost:hover {
		background: rgba(255, 255, 255, 0.09);
		color: #ffffff;
	}

	.btn-nav-primary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: var(--space-compact);
		padding-inline: var(--space-xs);
		border-radius: 6px;
		background: rgba(1, 255, 195, 0.14);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.4);
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.btn-nav-primary:hover {
		background: rgba(1, 255, 195, 0.24);
	}

	.btn-open-zine {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-block: var(--space-xs);
		padding-inline: var(--space-m);
		border-radius: 8px;
		background: rgba(1, 255, 195, 0.14);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.4);
		font-size: var(--text-ui);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.btn-open-zine:hover {
		background: rgba(1, 255, 195, 0.24);
		border-color: rgba(1, 255, 195, 0.7);
	}
</style>
