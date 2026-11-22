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
	/** The studio deck lies at a small angle; its label is text, so it stays within about 2 degrees. */
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

		<!-- Studio tape/vinyl deck: dark anodized chassis with rotating machined reels. -->
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
						{#if playing}
							<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="audio-btn-icon">
								<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
							</svg>
							<span class="visually-hidden">Pause track</span>
						{:else}
							<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="audio-btn-icon">
								<path d="M8 5v14l11-7z" />
							</svg>
							<span class="visually-hidden">Play track</span>
						{/if}
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
	/* Dark anodized brushed studio deck chassis */
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
		background-color: #121016;
		background-image:
			var(--zine-grain),
			linear-gradient(145deg, rgba(255, 255, 255, 0.05) 0%, transparent 60%),
			linear-gradient(to bottom, #191622, #0d0b12);
		background-size: 160px 160px, auto, auto;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-md);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.12),
			inset 0 0 24px rgba(0, 0, 0, 0.7),
			0 18px 36px -12px rgba(0, 0, 0, 0.85);
		transform: rotate(var(--cassette-tilt, 0deg));
	}

	/* Studio master tape faceplate */
	.cassette-label {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		padding-block: var(--space-2xs) var(--space-xs);
		padding-inline: var(--space-xs);
		background-color: #1c1826;
		background-image: var(--zine-grain);
		background-size: 160px 160px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-sm);
	}

	/* Side, title and length on one typed line over an accent index rule */
	.cassette-label-row {
		display: flex;
		align-items: baseline;
		gap: var(--space-2xs);
		padding-block-end: var(--space-3xs);
		border-block-end: 2px solid var(--accent);
	}

	.cassette-side {
		flex-shrink: 0;
		font-family: var(--font-mono);
		font-size: var(--text-lead);
		font-weight: var(--weight-bold);
		color: var(--accent);
		line-height: 1;
	}

	.cassette-title {
		flex: 1 1 auto;
		min-inline-size: 0;
		font-family: var(--font-mono);
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--tracking-label);
		color: #ffffff;
		overflow-wrap: anywhere;
	}

	.cassette-length {
		flex-shrink: 0;
		font-family: var(--font-mono);
		font-size: var(--text-meta);
		color: #c4bcd0;
	}

	/* Studio reel bay: dual machined aluminum / vinyl studio reels */
	.cassette-window {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-xs);
		padding-block: var(--space-2xs);
		padding-inline: var(--space-s);
		background-color: #09080d;
		border-radius: var(--radius-full);
		box-shadow:
			inset 0 3px 8px rgba(0, 0, 0, 0.8),
			inset 0 0 0 1px rgba(255, 255, 255, 0.04);
	}

	.cassette-reel {
		flex-shrink: 0;
		inline-size: 2.75rem;
		block-size: 2.75rem;
		border-radius: 50%;
		position: relative;
		background:
			radial-gradient(circle at 50% 50%, #ffffff 0 6%, #121016 7% 18%, #363242 19% 22%, transparent 23%),
			conic-gradient(
				from 0deg,
				#1e1b26 0deg,
				#433d52 45deg,
				#1e1b26 90deg,
				#433d52 135deg,
				#1e1b26 180deg,
				#433d52 225deg,
				#1e1b26 270deg,
				#433d52 315deg,
				#1e1b26 360deg
			);
		box-shadow:
			0 0 0 2px #5a5268,
			0 0 0 4px #262230,
			0 4px 8px rgba(0, 0, 0, 0.6);
	}

	.cassette-tape {
		flex: 1 1 auto;
		block-size: 0.35rem;
		background: linear-gradient(to right, #382c24, #523f33, #382c24);
		border-radius: 2px;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
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

	/* Glowing 48px studio play button (touch target >= 44px) */
	.audio-play-btn {
		inline-size: 3rem;
		block-size: 3rem;
		min-inline-size: 3rem;
		min-block-size: 3rem;
		border-radius: 50%;
		border: 1px solid var(--accent);
		background: rgba(5, 217, 232, 0.12);
		color: var(--accent);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		box-shadow: 0 0 16px rgba(5, 217, 232, 0.25);
		transition: transform 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease;
	}

	.audio-play-btn:hover {
		transform: scale(1.05);
		background: rgba(5, 217, 232, 0.22);
		box-shadow: 0 0 22px rgba(5, 217, 232, 0.45);
	}

	.audio-play-btn.is-playing {
		background: var(--accent);
		color: #090710;
		box-shadow: 0 0 24px var(--accent);
	}

	.audio-btn-icon {
		inline-size: 1.25rem;
		block-size: 1.25rem;
		display: block;
	}

	:global(.audio-meta-stack) {
		flex: 1;
	}

	.audio-track-label {
		font-family: var(--font-mono);
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		color: #ffffff;
	}

	.audio-progress-track {
		inline-size: 100%;
		block-size: 6px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
		overflow: hidden;
		margin-block-start: var(--space-3xs);
	}

	/* Animated progress fill */
	.audio-progress-fill {
		inline-size: 0%;
		block-size: 100%;
		background: var(--accent);
		box-shadow: 0 0 10px var(--accent);
		transition: inline-size 0.3s ease;
	}

	.audio-progress-fill.is-playing {
		inline-size: 38%;
	}

	@media (prefers-reduced-motion: no-preference) {
		.audio-progress-fill.is-playing {
			animation: audio-pulse 2s ease-in-out infinite alternate;
		}
	}

	@keyframes audio-pulse {
		0% {
			opacity: 0.85;
		}
		100% {
			opacity: 1;
			box-shadow: 0 0 14px var(--accent);
		}
	}

	.audio-native-player {
		inline-size: 100%;
		min-block-size: var(--control-size);
	}
</style>
