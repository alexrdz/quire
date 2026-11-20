<script lang="ts">
	import { Stack, Box, Cluster } from '$lib/components/layout';
	import VenmoTipPanel from '$lib/components/tips/VenmoTipPanel.svelte';
	import Scrap from './Scrap.svelte';
	import Stamp from './Stamp.svelte';
	import Tape from './Tape.svelte';
	import TypeLabel from './TypeLabel.svelte';
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

	const coverArtCss = $derived(artist.coverArtUrl ? `url('${artist.coverArtUrl.replace(/'/g, '%27')}')` : 'none');
	const statusStamp = $derived(
		issue.status === 'cancelled'
			? { label: 'Cancelled', tone: 'support' as const }
			: issue.status === 'draft'
				? { label: 'Draft', tone: 'accent' as const }
				: issue.status === 'archived'
					? { label: 'Archived', tone: 'plain' as const }
					: null
	);
</script>

<section id="page-cover" class="page cover zine-paper zine-page" style="--cover-art: {coverArtCss};">
	<div class="page-inner">
		<header class="cover-header">
			<a href="/a/{artist.slug}" class="btn-artist-link">
				← {artist.displayName}
			</a>
			<Cluster align="center" gap="xs">
				{#if isScanVerified}
					<Stamp label="Attended Stamp Eligible" tone="highlight" position={1} />
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
			<!-- The print and its typed labels share a row, so the tip panel stays near the top. -->
			<Cluster align="end" gap="sm" class="cover-top">
				{#if artist.coverArtUrl}
					<!-- The cover art is a print taped onto the page. Decorative: the title names the Issue. -->
					<div class="cover-print" aria-hidden="true">
						<Tape placement="top-left" position={0} />
						<Tape placement="top-right" position={1} />
						<div class="cover-print-image"></div>
					</div>
				{/if}

				<Stack gap="2xs" align="start" class="cover-labels">
					<TypeLabel position={0} tone="highlight">{issue.date}</TypeLabel>
					<TypeLabel position={1}>{issue.city}</TypeLabel>
					<TypeLabel position={2}>@ {issue.venue}</TypeLabel>
					{#if statusStamp}
						<Stamp label={statusStamp.label} tone={statusStamp.tone} position={2} />
					{/if}
				</Stack>
			</Cluster>

			<h1 class="cover-title">{issue.city}</h1>

			{#if issue.coverNote}
				<Scrap position={1} tone="light" class="cover-note-scrap">
					<p class="cover-note-text type-face">"{issue.coverNote}"</p>
				</Scrap>
			{/if}

			{#if isArtistClosed}
				<Box variant="subtle" padding="sm" radius="md" class="closed-artist-notice">
					This artist has left Quire. This issue is preserved in read-only archive mode.
				</Box>
			{/if}

			{#if showTips && artist.venmoUsername}
				<!-- Taped down, never tilted: the tip buttons stay square and easy to hit (ADR 0009). -->
				<div class="cover-tip">
					<Tape placement="top" position={2} />
					<VenmoTipPanel
						artistSlug={artist.slug}
						artistName={artist.displayName}
						venmoUsername={artist.venmoUsername}
						issueSlug={issue.slug}
						presets={tipPresets}
						opensVenmo={tipsOpenVenmo}
					/>
				</div>
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
	/* The taped print: a white-bordered photo at a small tilt (art, not text, so up to about 3 degrees). */
	.cover-print {
		position: relative;
		/* Small enough that the tip panel stays near the top, inset so the tape never reaches the header buttons. */
		inline-size: min(46%, 12rem);
		margin-block-start: var(--space-s);
		margin-inline-start: var(--space-2xs);
		padding-block: var(--space-3xs) var(--space-s);
		padding-inline: var(--space-3xs);
		background-color: var(--zine-scrap-light);
		background-image: var(--zine-mottle);
		background-size: 420px 420px;
		box-shadow:
			0 1px 2px rgba(0, 0, 0, 0.5),
			0 16px 30px -10px rgba(0, 0, 0, 0.8);
		transform: rotate(-2.6deg);
	}

	.cover-print-image {
		aspect-ratio: 4 / 3;
		background-color: var(--ink-surface);
		background-image: var(--cover-art, none);
		background-size: cover;
		background-position: center;
		/* A photocopied print: a little grain over the art. */
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.25);
	}

	:global(.cover-labels) {
		flex: 1 1 6.5rem;
		min-inline-size: 0;
	}

	:global(.cover-note-scrap) {
		max-inline-size: 34rem;
	}

	:global(.cover-middle-stack) {
		margin-block: auto;
	}

	.cover-note-text {
		font-size: var(--text-body);
		line-height: var(--leading-body);
		color: var(--zine-scrap-light-ink);
	}

	/* The reader's tip panel is a scrap of dark paper, not glass, and keeps its pink edge so it stays obvious. */
	.cover-tip {
		position: relative;
	}

	.cover-tip :global(.venmo-tip-panel) {
		background-color: var(--zine-scrap-dark);
		background-image: var(--zine-grain);
		background-size: 160px 160px;
		border: 2px solid rgba(255, 42, 109, 0.6);
		border-radius: 3px;
		box-shadow: 0 12px 26px -10px rgba(0, 0, 0, 0.8);
	}

	.cover-tip :global(.venmo-tip-title) {
		font-family: var(--font-type);
		font-weight: var(--weight-regular);
		letter-spacing: var(--tracking-normal);
	}

	/* Tip targets stay at least 44 px (ADR 0009). */
	.cover-tip :global(.venmo-tip-preset),
	.cover-tip :global(.venmo-tip-go),
	.cover-tip :global(.venmo-tip-input) {
		min-block-size: var(--control-size);
	}

	:global(.cover-actions-strip) {
		margin-block-start: var(--space-l);
	}

	/* Dark paper, not glass (ADR 0009). */
	:global(.closed-artist-notice) {
		background-color: var(--zine-scrap-dark);
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
