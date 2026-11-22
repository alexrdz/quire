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
			<div class="poster-head">
				<div class="poster-edition-badge font-mono">LIMITED EDITION LIVE ARCHIVE</div>
				<h1 class="cover-title">{issue.city}</h1>
				<p class="cover-venue">LIVE AT {issue.venue}</p>

				<Cluster align="center" gap="2xs" class="cover-labels">
					<TypeLabel position={0} tone="highlight">{issue.date}</TypeLabel>
					<TypeLabel position={1}>{issue.city}</TypeLabel>
					<TypeLabel position={2}>@ {issue.venue}</TypeLabel>
					{#if statusStamp}
						<Stamp label={statusStamp.label} tone={statusStamp.tone} position={2} />
					{/if}
				</Cluster>
			</div>

			{#if artist.coverArtUrl}
				<!-- The cover art is a limited-edition gig poster print with archival tape -->
				<div class="cover-print" aria-hidden="true">
					<Tape placement="top-left" position={0} />
					<Tape placement="top-right" position={1} />
					<div class="cover-print-image"></div>
				</div>
			{/if}

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

		<div class="cover-actions-strip">
			<button type="button" class="btn-open-zine" onclick={() => scrollToPage(contentPageId(0))}>
				<span class="btn-open-label">Swipe or Tap to Open Tonight's Zine</span>
				<span class="btn-open-arrow" aria-hidden="true">→</span>
			</button>
		</div>

		<footer class="page-footer">
			<span>Swipe or tap to read ({readerPageCount(contentCount)} pages)</span>
			<span class="font-mono">Issue #{issue.slug}</span>
		</footer>
	</div>
</section>

<style>
	:global(.cover-middle-stack) {
		margin-block: auto;
	}

	.poster-head {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
		margin-block-start: var(--space-xs);
		margin-block-end: var(--space-2xs);
	}

	.poster-edition-badge {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-display);
		text-transform: uppercase;
		color: var(--highlight);
		opacity: 0.9;
	}

	.cover-title {
		font-size: var(--text-hero);
		font-weight: var(--weight-black);
		line-height: var(--leading-solid);
		letter-spacing: var(--tracking-tight);
		text-transform: uppercase;
		color: #ffffff;
		margin: 0;
		text-shadow: 0 4px 20px rgba(0, 0, 0, 0.8);
	}

	.cover-venue {
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.75);
		margin: 0;
	}

	:global(.cover-labels) {
		margin-block-start: var(--space-3xs);
	}

	/* The taped print: full-width limited-edition vinyl gig artwork presentation at a subtle tilt (art, not text). */
	.cover-print {
		position: relative;
		inline-size: 100%;
		max-inline-size: 28rem;
		margin-inline: auto;
		margin-block: var(--space-xs);
		padding-block: var(--space-3xs);
		padding-inline: var(--space-3xs);
		background-color: var(--zine-scrap-dark);
		background-image: var(--zine-grain);
		background-size: 160px 160px;
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 4px;
		box-shadow:
			0 4px 16px rgba(0, 0, 0, 0.6),
			0 18px 36px -8px rgba(0, 0, 0, 0.85),
			inset 0 0 0 1px rgba(255, 255, 255, 0.06);
		transform: rotate(-1.5deg);
	}

	.cover-print-image {
		aspect-ratio: 16 / 9;
		inline-size: 100%;
		background-color: var(--ink-surface);
		background-image: var(--cover-art, none);
		background-size: cover;
		background-position: center;
		border-radius: 2px;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
	}

	.cover-print :global(.tape) {
		background: rgba(255, 255, 255, 0.22);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.35);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
	}

	.cover-print :global(.tape-top-left) {
		inset-block-start: -0.45rem;
		inset-inline-start: 1rem;
	}

	.cover-print :global(.tape-top-right) {
		inset-block-start: -0.45rem;
		inset-inline-end: 1rem;
	}

	:global(.cover-note-scrap) {
		max-inline-size: 34rem;
	}

	.cover-note-text {
		font-size: var(--text-body);
		line-height: var(--leading-body);
		color: var(--zine-scrap-light-ink);
	}

	.cover-tip {
		position: relative;
		margin-block-start: var(--space-s);
	}

	.cover-tip :global(.tape) {
		background: rgba(255, 255, 255, 0.22);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.35);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
	}

	.cover-tip :global(.venmo-tip-panel) {
		background-color: var(--zine-scrap-dark);
		background-image: var(--zine-grain);
		background-size: 160px 160px;
		border: 1px solid rgba(255, 42, 109, 0.45);
		border-radius: 6px;
		box-shadow: 0 12px 28px -8px rgba(0, 0, 0, 0.85);
		transform: none;
	}

	.cover-tip :global(.venmo-tip-title) {
		font-family: var(--font-type);
		font-weight: var(--weight-regular);
		letter-spacing: var(--tracking-normal);
	}

	/* Tip targets stay at least 44 px with zero rotation (ADR 0009). */
	.cover-tip :global(.venmo-tip-preset),
	.cover-tip :global(.venmo-tip-go),
	.cover-tip :global(.venmo-tip-input) {
		min-inline-size: 44px;
		min-block-size: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transform: none;
	}

	.cover-actions-strip {
		margin-block-start: var(--space-m);
		display: flex;
		justify-content: center;
	}

	:global(.closed-artist-notice) {
		background-color: var(--zine-scrap-dark);
		border-color: rgba(255, 42, 109, 0.45);
		color: #ffffff;
		font-size: var(--text-small);
	}

	.btn-open-zine {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		inline-size: 100%;
		max-inline-size: 28rem;
		min-block-size: 48px;
		padding-block: var(--space-xs);
		padding-inline: var(--space-m);
		border-radius: 8px;
		background: rgba(1, 255, 195, 0.12);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.45);
		box-shadow: 0 4px 16px rgba(1, 255, 195, 0.12);
		font-size: var(--text-ui);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-label);
		cursor: pointer;
		transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
	}

	.btn-open-zine:hover {
		background: rgba(1, 255, 195, 0.22);
		border-color: rgba(1, 255, 195, 0.8);
		transform: translateY(-1px);
	}

	.btn-open-zine:active {
		transform: translateY(0);
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
</style>
