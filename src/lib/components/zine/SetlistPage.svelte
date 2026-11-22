<script lang="ts">
	import { Stack, Cluster } from '$lib/components/layout';
	import Tape from './Tape.svelte';
	import ZinePageShell from './ZinePageShell.svelte';
	import { zineTilt, type PageContent, type PageShell } from './reader';

	interface Props {
		shell: PageShell;
		content: PageContent;
		venue: string;
	}

	let { shell, content, venue }: Props = $props();

	const songs = $derived(content.songs || ['Opener', 'New Track', 'Crowd Favorite', 'Encore']);
	/** The sheet's resting tilt: text, so within the ADR 0009 limit of about 2 degrees. */
	const tilt = $derived(zineTilt(shell.pageNumber));
</script>

<ZinePageShell {shell}>
	<Stack gap="xs">
		<span class="text-highlight type-face eyebrow-small">{venue}</span>
		<h2 class="bespoke-heading">{content.title || "Tonight's Setlist"}</h2>
	</Stack>

	<!-- An authentic laminated backstage setlist sheet, taped to the page. -->
	<div class="setlist-sheet" style="--sheet-tilt: {tilt}deg;">
		<Tape placement="top" position={shell.pageNumber} />
		<div class="setlist-paper">
			<div class="setlist-laminate-header">
				<Cluster justify="between" align="center">
					<span class="setlist-badge font-mono">BACKSTAGE SETLIST</span>
					<span class="setlist-order-tag font-mono">OFFICIAL RUN</span>
				</Cluster>
			</div>
			<ol class="setlist-songs type-face">
				{#each songs as song, sIdx}
					<li class="song-row" class:is-last={sIdx === songs.length - 1}>
						<span class="song-num">{String(sIdx + 1).padStart(2, '0')}</span>
						<span class="song-title">{song}</span>
						<span class="song-tag">LIVE</span>
					</li>
				{/each}
			</ol>
		</div>
	</div>
</ZinePageShell>

<style>
	.setlist-sheet {
		position: relative;
		inline-size: 100%;
		max-inline-size: 30rem;
		margin-inline: auto;
		transform: rotate(var(--sheet-tilt, 0deg));
	}

	.setlist-sheet :global(.tape) {
		background: rgba(255, 255, 255, 0.22);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.35);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
	}

	.setlist-paper {
		position: relative;
		padding-block: var(--space-m) var(--space-l);
		padding-inline: var(--space-m);
		background-color: var(--zine-scrap-dark);
		background-image: var(--zine-grain);
		background-size: 160px 160px;
		color: #ffffff;
		border: 1px solid rgba(255, 255, 255, 0.16);
		border-radius: 6px;
		box-shadow:
			0 4px 20px rgba(0, 0, 0, 0.7),
			0 0 0 4px rgba(255, 255, 255, 0.04),
			inset 0 0 0 1px rgba(255, 255, 255, 0.08);
	}

	.setlist-laminate-header {
		padding-block-end: var(--space-s);
		margin-block-end: var(--space-xs);
		border-block-end: 1px solid rgba(255, 255, 255, 0.1);
	}

	.setlist-badge {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
		color: var(--highlight);
		text-transform: uppercase;
	}

	.setlist-order-tag {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
		color: #cbd5e1;
		text-transform: uppercase;
	}

	.setlist-songs {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		margin: 0;
		padding: 0;
	}

	.song-row {
		display: flex;
		align-items: baseline;
		gap: var(--space-s);
		padding-block: var(--space-2xs);
		border-block-end: 1px solid rgba(255, 255, 255, 0.06);
		font-size: var(--text-body);
		line-height: var(--leading-body);
	}

	.song-row:last-child {
		border-block-end: none;
	}

	.song-num {
		flex-shrink: 0;
		font-size: var(--text-small);
		color: #cbd5e1;
		font-variant-numeric: tabular-nums;
	}

	.song-title {
		position: relative;
		min-inline-size: 0;
		overflow-wrap: anywhere;
		color: #ffffff;
	}

	.song-tag {
		flex-shrink: 0;
		margin-inline-start: auto;
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-label);
		padding-block: var(--space-4xs);
		padding-inline: var(--space-3xs);
		border-radius: 4px;
		background: rgba(1, 255, 195, 0.12);
		border: 1px solid rgba(1, 255, 195, 0.35);
		color: var(--highlight);
	}

	/* The last song (the encore) is underlined in marker, by hand. */
	.song-row.is-last .song-title::after {
		content: '';
		position: absolute;
		inset-inline: -0.2em -0.35em;
		inset-block-end: -0.2em;
		block-size: 0.55em;
		border-block-end: 3px solid var(--support);
		border-bottom-style: solid;
		border-radius: 0 0 60% 40% / 0 0 100% 70%;
		transform: rotate(-1.5deg);
		pointer-events: none;
	}
</style>
