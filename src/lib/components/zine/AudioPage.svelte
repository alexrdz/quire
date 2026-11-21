<script lang="ts">
	import { Stack, Cluster } from '$lib/components/layout';
	import TypeLabel from './TypeLabel.svelte';
	import Tape from './Tape.svelte';
	import ZinePageShell from './ZinePageShell.svelte';
	import { zineTilt, type PageContent, type PageShell } from './reader';

	interface Props {
		shell: PageShell;
		content: PageContent;
		/** The mock player (a page without an audio URL) is playing; only one plays at a time. */
		playing: boolean;
		onToggle: () => void;
	}

	let { shell, content, playing, onToggle }: Props = $props();

	/** A real track's playing state, from the native player, so the reels turn with it. */
	let nativePlaying = $state(false);
	const spinning = $derived(content.audioUrl ? nativePlaying : playing);
	/** The cassette lies at a small angle; its label is text, so it stays within about 2 degrees. */
	const tilt = $derived(zineTilt(shell.pageNumber + 1));
</script>

<ZinePageShell {shell}>
	<Stack gap="md">
		<Cluster justify="between" align="center">
			<TypeLabel position={shell.pageNumber} tone="accent">
				{content.audioUrl ? 'AUDIO TRACK' : 'UNRELEASED DEMO'}
			</TypeLabel>
			{#if content.audioUrl}
				{#if content.duration}
					<span class="text-accent type-face">{content.duration}</span>
				{/if}
			{:else}
				<span class="text-accent type-face">
					{playing ? '01:14' : '00:00'} / {content.duration || '03:42'}
				</span>
			{/if}
		</Cluster>

		<h2 class="bespoke-heading">{content.title || 'Studio Session Bounce'}</h2>

		<!-- A cassette: a typed label over a window with two reels. The controls below it are the standard ones. -->
		<div class="cassette audio-card" class:is-spinning={spinning} style="--cassette-tilt: {tilt}deg;">
			<Tape placement="top-right" position={shell.pageNumber + 2} />
			<div class="cassette-label">
				<div class="cassette-label-row">
					<span class="cassette-side type-face" aria-hidden="true">A</span>
					<span class="cassette-title type-face">{content.title || (content.audioUrl ? 'Audio Track' : 'Rough Mix')}</span>
					<span class="cassette-length type-face" aria-hidden="true">{content.duration || (content.audioUrl ? '' : '03:42')}</span>
				</div>
				<div class="cassette-window" aria-hidden="true">
					<span class="cassette-reel"></span>
					<span class="cassette-tape"></span>
					<span class="cassette-reel"></span>
				</div>
			</div>

			{#if content.audioUrl}
				<audio
					controls
					preload="metadata"
					src={content.audioUrl}
					class="audio-native-player"
					onplay={() => (nativePlaying = true)}
					onpause={() => (nativePlaying = false)}
					onended={() => (nativePlaying = false)}
				></audio>
			{:else}
				<Cluster justify="between" align="center" gap="md">
					<button
						type="button"
						class="audio-play-btn {playing ? 'is-playing' : ''}"
						onclick={onToggle}
						aria-label={playing ? 'Pause track' : 'Play track'}
					>
						{playing ? 'PAUSE' : 'PLAY'}
					</button>
					<Stack gap="3xs" class="audio-meta-stack">
						<span class="audio-track-label">
							{playing ? 'Playing 4-Track Tape Bounce...' : 'Tap to preview rough mix'}
						</span>
						<div class="audio-progress-track">
							<div class="audio-progress-fill {playing ? 'is-playing' : ''}"></div>
						</div>
					</Stack>
				</Cluster>
			{/if}
		</div>

		{#if content.body}
			<p class="bespoke-body-text">{content.body}</p>
		{/if}
	</Stack>
</ZinePageShell>

<style>
	/* The cassette shell: dark plastic with screw holes, lying at a small angle. */
	.cassette {
		position: relative;
		/* Inset so the corner tape lands on the page, clear of its edge gutter. */
		margin-inline: var(--space-s);
		display: flex;
		flex-direction: column;
		gap: var(--space-s);
		max-inline-size: 30rem;
		padding-block: var(--space-s);
		padding-inline: var(--space-s);
		background-color: #1d1924;
		background-image:
			var(--zine-grain),
			radial-gradient(circle at 0.9rem 0.9rem, #0d0b11 0.22rem, transparent 0.24rem),
			radial-gradient(circle at calc(100% - 0.9rem) 0.9rem, #0d0b11 0.22rem, transparent 0.24rem),
			radial-gradient(circle at 0.9rem calc(100% - 0.9rem), #0d0b11 0.22rem, transparent 0.24rem),
			radial-gradient(circle at calc(100% - 0.9rem) calc(100% - 0.9rem), #0d0b11 0.22rem, transparent 0.24rem);
		background-size: 160px 160px, auto, auto, auto, auto;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 10px;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.06),
			0 14px 26px -12px rgba(0, 0, 0, 0.85);
		transform: rotate(var(--cassette-tilt, 0deg));
	}

	/* The paper label, typed on, with the accent stripe a real tape label has. */
	.cassette-label {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		padding-block: var(--space-2xs) var(--space-xs);
		padding-inline: var(--space-xs);
		background-color: var(--zine-scrap-light);
		background-image: var(--zine-mottle);
		background-size: 420px 420px;
		color: var(--zine-scrap-light-ink);
		border-radius: 4px;
	}

	/* Side, title and length on one typed line, over the accent stripe a real tape label has. */
	.cassette-label-row {
		display: flex;
		align-items: baseline;
		gap: var(--space-2xs);
		padding-block-end: var(--space-3xs);
		border-block-end: 3px solid var(--accent);
	}

	.cassette-side {
		flex-shrink: 0;
		font-size: var(--text-lead);
		line-height: 1;
	}

	.cassette-title {
		flex: 1 1 auto;
		min-inline-size: 0;
		font-size: var(--text-small);
		text-transform: uppercase;
		letter-spacing: var(--tracking-label);
		overflow-wrap: anywhere;
	}

	.cassette-length {
		flex-shrink: 0;
		font-size: var(--text-meta);
		color: #5b5466;
	}

	/* The window: two reels joined by a strip of tape. */
	.cassette-window {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-xs);
		padding-block: var(--space-2xs);
		padding-inline: var(--space-s);
		background-color: #2a2433;
		border-radius: 999px;
		box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.6);
	}

	.cassette-reel {
		flex-shrink: 0;
		inline-size: 2.6rem;
		block-size: 2.6rem;
		border-radius: 50%;
		background:
			radial-gradient(circle, #ebe5d5 0 22%, transparent 23%),
			conic-gradient(#1a1620 0 10%, #3a3245 10% 23%, #1a1620 23% 43%, #3a3245 43% 56%, #1a1620 56% 76%, #3a3245 76% 90%, #1a1620 90%);
		box-shadow: 0 0 0 3px #4a3f37;
	}

	.cassette-tape {
		flex: 1 1 auto;
		block-size: 0.5rem;
		background-color: #4a3f37;
		border-radius: 2px;
	}

	@media (prefers-reduced-motion: no-preference) {
		.cassette.is-spinning .cassette-reel {
			animation: cassette-spin 2.4s linear infinite;
		}
	}

	@keyframes cassette-spin {
		to {
			transform: rotate(-360deg);
		}
	}

	/* The standard controls, unchanged in behaviour. */
	.audio-play-btn {
		inline-size: 3.5rem;
		block-size: 3.5rem;
		border-radius: 50%;
		border: 1px solid var(--accent);
		background: rgba(5, 217, 232, 0.14);
		color: #ffffff;
		font-family: var(--font-mono);
		font-size: var(--text-meta);
		font-weight: var(--weight-heavy);
		letter-spacing: var(--tracking-label);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: transform 0.15s ease, background-color 0.15s ease;
	}

	.audio-play-btn.is-playing {
		background: var(--accent);
		color: #090710;
	}

	:global(.audio-meta-stack) {
		flex: 1;
	}

	.audio-track-label {
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		color: #ffffff;
	}

	.audio-progress-track {
		inline-size: 100%;
		block-size: 6px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		overflow: hidden;
		margin-block-start: var(--space-3xs);
	}

	/* The mock player's progress: a class, not an inline style (CLAUDE.md). */
	.audio-progress-fill {
		inline-size: 0%;
		block-size: 100%;
		background: var(--accent);
		transition: inline-size 0.3s ease;
	}

	.audio-progress-fill.is-playing {
		inline-size: 38%;
	}

	.audio-native-player {
		inline-size: 100%;
		min-block-size: var(--control-size);
	}
</style>
