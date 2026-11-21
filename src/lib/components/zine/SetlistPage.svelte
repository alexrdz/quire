<script lang="ts">
	import { Stack } from '$lib/components/layout';
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

	<!-- A typewritten sheet with a torn bottom edge, taped to the page. -->
	<div class="setlist-sheet" style="--sheet-tilt: {tilt}deg;">
		<Tape placement="top" position={shell.pageNumber} />
		<div class="setlist-paper">
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
		transform: rotate(var(--sheet-tilt, 0deg));
		/* The shadow follows the torn edge (a box-shadow would be clipped with it). */
		filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.45)) drop-shadow(0 12px 16px rgba(0, 0, 0, 0.55));
	}

	.setlist-paper {
		padding-block: var(--space-m) var(--space-l);
		padding-inline: var(--space-s);
		background-color: var(--zine-scrap-light);
		background-image: var(--zine-mottle);
		background-size: 420px 420px;
		color: var(--zine-scrap-light-ink);
		/* Torn off the pad at the bottom. */
		clip-path: polygon(
			0% 0%,
			100% 0%,
			100.00% 100%,
			95.45% calc(100% - 7px),
			90.91% 100%,
			86.36% calc(100% - 6px),
			81.82% 100%,
			77.27% calc(100% - 8px),
			72.73% 100%,
			68.18% calc(100% - 5px),
			63.64% 100%,
			59.09% calc(100% - 5px),
			54.55% 100%,
			50.00% calc(100% - 5px),
			45.45% 100%,
			40.91% calc(100% - 7px),
			36.36% 100%,
			31.82% calc(100% - 5px),
			27.27% 100%,
			22.73% calc(100% - 6px),
			18.18% 100%,
			13.64% calc(100% - 5px),
			9.09% 100%,
			4.55% calc(100% - 5px),
			0.00% 100%
		);
	}

	.setlist-songs {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.song-row {
		display: flex;
		align-items: baseline;
		gap: var(--space-xs);
		font-size: var(--text-body);
		line-height: 1.5;
	}

	.song-num {
		flex-shrink: 0;
		font-size: var(--text-small);
		color: #5b5466;
	}

	.song-title {
		position: relative;
		min-inline-size: 0;
		overflow-wrap: anywhere;
	}

	.song-tag {
		flex-shrink: 0;
		margin-inline-start: auto;
		font-size: var(--text-meta);
		letter-spacing: var(--tracking-label);
		color: #5b5466;
	}

	/* The last song (the encore) is underlined in marker, by hand. */
	.song-row.is-last .song-title::after {
		content: '';
		position: absolute;
		inset-inline: -0.2em -0.35em;
		inset-block-end: -0.2em;
		block-size: 0.55em;
		border-block-end: 3px solid var(--support);
		border-radius: 0 0 60% 40% / 0 0 100% 70%;
		transform: rotate(-1.5deg);
		pointer-events: none;
	}
</style>
