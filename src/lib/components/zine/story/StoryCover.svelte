<script lang="ts">
	import TipPresetButtons from '$lib/components/tips/TipPresetButtons.svelte';
	import { getStoryNav } from './context';

	/**
	 * The Cover (ADR 0011): the cover art full-bleed behind a scrim, the Artist's
	 * name large, then venue, city and date, the Cover note, the tip amounts as
	 * pills (tip-first, decision 4), and "Open tonight's zine".
	 */
	interface Props {
		artist: { slug: string; displayName: string; coverArtUrl?: string | null; venmoUsername?: string | null };
		issue: { slug: string; date: string; city: string; venue: string; status: string; coverNote?: string | null };
		signedIn: boolean;
		isScanVerified: boolean;
		isArtistClosed: boolean;
		showTips: boolean;
		tipPresets: number[];
		/** `features.tipsOpenVenmo`: true only in production. */
		tipsOpenVenmo: boolean;
		onSignIn: () => void;
	}

	let { artist, issue, signedIn, isScanVerified, isArtistClosed, showTips, tipPresets, tipsOpenVenmo, onSignIn }: Props =
		$props();

	const nav = getStoryNav();
	const status = $derived(
		issue.status === 'cancelled'
			? 'Cancelled'
			: issue.status === 'draft'
				? 'Draft'
				: issue.status === 'archived'
					? 'Archived'
					: null
	);
</script>

<section id="page-cover" class="story-cover" aria-labelledby="story-cover-title">
	{#if artist.coverArtUrl}
		<img class="story-cover-art" src={artist.coverArtUrl} alt="" />
	{/if}

	<div class="story-cover-scroll">
	<div class="story-cover-body" data-scrim>
		{#if status || isScanVerified}
			<div class="story-badges">
				{#if status}
					<span class="story-badge">{status}</span>
				{/if}
				{#if isScanVerified}
					<span class="story-badge story-badge-highlight">Attended Stamp Eligible</span>
				{/if}
			</div>
		{/if}

		<h1 id="story-cover-title" class="story-cover-title" tabindex="-1">{artist.displayName}</h1>
		<p class="story-cover-meta">
			<span>{issue.venue}</span>
			<span aria-hidden="true">·</span>
			<span>{issue.city}</span>
			<span aria-hidden="true">·</span>
			<time datetime={issue.date}>{issue.date}</time>
		</p>

		{#if issue.coverNote}
			<p class="story-cover-note">{issue.coverNote}</p>
		{/if}

		{#if isArtistClosed}
			<p class="story-cover-closed">This artist has left Quire. This issue is preserved in read-only archive mode.</p>
		{/if}

		{#if showTips && artist.venmoUsername}
			<!-- Tip-first (decision 4): each pill is the real Venmo button, one tap from the Cover. -->
			<div class="story-cover-tips">
				<TipPresetButtons
					artistSlug={artist.slug}
					artistName={artist.displayName}
					venmoUsername={artist.venmoUsername}
					issueSlug={issue.slug}
					presets={tipPresets}
					opensVenmo={tipsOpenVenmo}
					buttonClass="story-tip-pill"
					class="story-cover-tip-pills"
					label="Tip {artist.displayName} with Venmo"
				/>
				<button type="button" class="story-tip-other" aria-haspopup="dialog" onclick={() => nav.openTip()}>
					Other amount
				</button>
			</div>
		{/if}

		<button type="button" class="story-open" onclick={() => nav.next()}>Open tonight's zine</button>

		<p class="story-cover-account">
			{#if signedIn}
				<a href="/me/stubs" class="story-text-link">My Stubs</a>
			{:else}
				<button type="button" class="story-text-link" onclick={onSignIn}>Fan sign in</button>
			{/if}
		</p>
	</div>
	</div>
</section>

<style>
	.story-cover {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: var(--bg-void);
		color: #ffffff;
	}

	/* The words scroll over the art when they are taller than the screen; the art stays put. */
	.story-cover-scroll {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding-block-start: var(--story-top-space);
	}

	.story-cover-art {
		position: absolute;
		inset: 0;
		inline-size: 100%;
		block-size: 100%;
		object-fit: cover;
	}

	/* The scrim: at least 62% black under every word, so white text passes AA over any art. */
	.story-cover-body {
		position: relative;
		margin-block-start: auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		padding-block: var(--space-s) max(var(--space-m), env(safe-area-inset-bottom));
		padding-inline: var(--space-s);
		background-color: rgba(0, 0, 0, 0.62);
	}

	.story-cover-body::before {
		content: '';
		position: absolute;
		inset-inline: 0;
		inset-block-end: 100%;
		block-size: 40dvh;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.62), transparent);
		pointer-events: none;
	}

	.story-badges {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3xs);
	}

	.story-badge {
		padding-block: var(--space-4xs);
		padding-inline: var(--space-2xs);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.16);
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		color: #ffffff;
	}

	.story-badge-highlight {
		background: var(--highlight);
		color: var(--bg-void);
	}

	.story-cover-title {
		margin: 0;
		font-family: var(--story-heading-font, inherit);
		font-size: var(--text-display);
		font-weight: var(--weight-heavy);
		line-height: 1.02;
		letter-spacing: var(--tracking-snug);
		color: #ffffff;
		overflow-wrap: anywhere;
	}

	.story-cover-title:focus {
		outline: none;
	}

	.story-cover-meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3xs);
		margin: 0;
		font-size: var(--text-ui);
		font-weight: var(--weight-semibold);
		color: #ffffff;
	}

	.story-cover-note {
		margin: 0;
		max-inline-size: 60ch;
		font-size: var(--text-body);
		line-height: var(--leading-body);
		color: #ffffff;
	}

	.story-cover-closed {
		margin: 0;
		padding-block: var(--space-2xs);
		padding-inline: var(--space-xs);
		border-radius: 12px;
		background: rgba(255, 42, 109, 0.22);
		font-size: var(--text-small);
		color: #ffffff;
	}

	.story-cover-tips {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		padding-block-start: var(--space-3xs);
	}

	/* The shared tip buttons, as --support pills. Dark text: about 5.7:1. */
	.story-cover-tips :global(.story-tip-pill) {
		min-block-size: var(--control-size);
		min-inline-size: var(--control-size);
		padding-block: 0;
		padding-inline: var(--space-s);
		border: 0;
		border-radius: 999px;
		background: var(--support);
		color: var(--bg-void);
		font-family: inherit;
		font-size: var(--text-body);
		font-weight: var(--weight-heavy);
		cursor: pointer;
	}

	.story-cover-tips :global(.venmo-tip-message) {
		margin: 0;
		font-size: var(--text-small);
		color: var(--highlight);
	}

	.story-tip-other {
		align-self: flex-start;
		min-block-size: var(--control-size);
		min-inline-size: var(--control-size);
		padding-inline: 0;
		border: 0;
		background: transparent;
		color: #ffffff;
		font-family: inherit;
		font-size: var(--text-ui);
		font-weight: var(--weight-semibold);
		text-decoration: underline;
		text-underline-offset: 0.2em;
		cursor: pointer;
	}

	.story-open {
		min-block-size: var(--control-size);
		margin-block-start: var(--space-2xs);
		padding-inline: var(--space-m);
		border: 0;
		border-radius: 12px;
		background: var(--accent);
		color: var(--on-accent, #090710);
		font-family: inherit;
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		cursor: pointer;
	}

	.story-cover-account {
		margin: 0;
		text-align: center;
	}

	.story-text-link {
		display: inline-flex;
		align-items: center;
		min-block-size: var(--control-size);
		padding-inline: var(--space-xs);
		border: 0;
		background: transparent;
		color: #ffffff;
		font-family: inherit;
		font-size: var(--text-ui);
		font-weight: var(--weight-semibold);
		text-decoration: underline;
		text-underline-offset: 0.2em;
		cursor: pointer;
	}

	.story-cover-tips :global(.story-tip-pill:focus-visible),
	.story-tip-other:focus-visible,
	.story-open:focus-visible,
	.story-text-link:focus-visible {
		outline: 2px solid #ffffff;
		outline-offset: 2px;
	}
</style>
