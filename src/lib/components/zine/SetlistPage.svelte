<script lang="ts" module>
	/** A setlist as the page shows it: the main set, then the encore (empty when there is none). */
	export interface SetlistDisplay {
		main: string[];
		encore: string[];
		/** Whether the setlist marks an encore, so the divider shows (even with no songs after it). */
		hasEncore: boolean;
	}

	/** "Encore" on its own: the divider itself, not a song. */
	const ENCORE_MARKER = /^\s*encore\s*$/i;
	/** A title ending in "(Encore)", with optional spaces: an encore song, shown without the suffix. */
	const ENCORE_SUFFIX = /\s*\(\s*encore\s*\)\s*$/i;

	/**
	 * Splits a setlist for display (the stored songs are untouched). The encore starts at
	 * the first song that is exactly "Encore" (which becomes the divider and is not listed)
	 * or whose title ends in "(Encore)" (listed without the suffix). From there on, every
	 * song is in the encore, a further "Encore" marker is dropped and "(Encore)" suffixes are
	 * removed. "Encore" anywhere else in a title ("Encore Une Fois") is an ordinary song.
	 */
	export function splitSetlist(songs: readonly string[]): SetlistDisplay {
		const start = songs.findIndex((song) => ENCORE_MARKER.test(song) || ENCORE_SUFFIX.test(song));
		if (start === -1) return { main: [...songs], encore: [], hasEncore: false };
		const encore = songs
			.slice(start)
			.filter((song) => !ENCORE_MARKER.test(song))
			.map((song) => song.replace(ENCORE_SUFFIX, '').trim());
		return { main: songs.slice(0, start), encore, hasEncore: true };
	}
</script>

<script lang="ts">
	import type { PageContent, PageShell } from './reader';

	/**
	 * A setlist page in the Stories reader (ADR 0011): a clean typographic list on the
	 * dark page. The heading is in the Artist's type pairing; songs are numbered (muted,
	 * tabular numbers, white titles), with an "Encore" divider before the encore (see
 * splitSetlist). A long
	 * list scrolls inside the page; scrolling never pages the reader, and a tap still does.
	 */
	interface Props {
		shell: PageShell;
		content: PageContent;
		venue: string;
	}

	let { shell, content, venue }: Props = $props();

	const songs = $derived(content.songs || ['Opener', 'New Track', 'Crowd Favorite', 'Encore']);
	const display = $derived(splitSetlist(songs));
	const mainSet = $derived(display.main);
	const encore = $derived(display.encore);
	const hasEncore = $derived(display.hasEncore);
	const titleId = $derived(`${shell.id}-title`);
</script>

{#snippet rows(list: string[], start: number)}
	{#each list as song, i (i)}
		<li class="setlist-row">
			<span class="setlist-num" aria-hidden="true">{String(start + i).padStart(2, '0')}</span>
			<span class="setlist-song">{song}</span>
		</li>
	{/each}
{/snippet}

<section id={shell.id} class="story-setlist" aria-labelledby={titleId}>
	<!-- The list scrolls here when it is longer than the page; a keyboard can scroll it too. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div class="story-scroll" tabindex="0" role="region" aria-labelledby={titleId}>
		<div class="story-setlist-column">
			<span class="story-setlist-venue">{venue}</span>
			<h2 id={titleId} class="story-setlist-title" tabindex="-1">{content.title || "Tonight's Setlist"}</h2>

			{#if mainSet.length > 0}
				<ol class="setlist-list">
					{@render rows(mainSet, 1)}
				</ol>
			{/if}

			{#if hasEncore}
				<h3 class="setlist-encore">Encore</h3>
				<ol class="setlist-list" start={mainSet.length + 1}>
					{@render rows(encore, mainSet.length + 1)}
				</ol>
			{/if}
		</div>
	</div>
</section>

<style>
	.story-setlist {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background-color: var(--bg-void);
		color: #ffffff;
	}

	/* Between the header and the bottom bar; scrolls inside the page when long. */
	.story-scroll {
		position: absolute;
		inset-inline: 0;
		inset-block: var(--story-top-space) var(--story-bottom-space);
		overflow-y: auto;
		overscroll-behavior: contain;
		padding-block: var(--space-s);
		padding-inline: var(--space-m);
	}

	.story-scroll:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.story-setlist-column {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		max-inline-size: 65ch;
		margin-inline: auto;
	}

	.story-setlist-venue {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.78);
	}

	.story-setlist-title {
		margin: 0;
		margin-block-end: var(--space-xs);
		font-family: var(--story-heading-font, inherit);
		font-size: var(--text-heading);
		font-weight: var(--weight-bold);
		line-height: var(--leading-heading);
		overflow-wrap: anywhere;
	}

	.story-setlist-title:focus {
		outline: none;
	}

	.setlist-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.setlist-row {
		display: flex;
		align-items: baseline;
		gap: var(--space-s);
		padding-block: var(--space-xs);
		border-block-end: 1px solid rgba(255, 255, 255, 0.1);
	}

	.setlist-num {
		flex-shrink: 0;
		min-inline-size: 2ch;
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		font-variant-numeric: tabular-nums;
		color: rgba(255, 255, 255, 0.62);
	}

	.setlist-song {
		flex: 1;
		min-inline-size: 0;
		font-size: var(--text-body);
		font-weight: var(--weight-semibold);
		line-height: var(--leading-snug);
		color: #ffffff;
		overflow-wrap: anywhere;
	}

	/* The encore divider: a label over a rule in the accent colour. */
	.setlist-encore {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		margin: 0;
		padding-block-start: var(--space-s);
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: #ffffff;
	}

	.setlist-encore::after {
		content: '';
		flex: 1;
		block-size: 2px;
		background-color: var(--accent);
	}
</style>
