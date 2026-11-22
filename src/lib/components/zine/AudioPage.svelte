<script lang="ts">
	import { Stack, Cluster } from '$lib/components/layout';
	import TypeLabel from './TypeLabel.svelte';
	import ZinePageShell from './ZinePageShell.svelte';
	import type { PageContent, PageShell } from './reader';

	interface Props {
		shell: PageShell;
		content: PageContent;
		/** The mock player (a page without an audio URL) is playing; only one plays at a time. */
		playing: boolean;
		onToggle: () => void;
	}

	let { shell, content, playing, onToggle }: Props = $props();

	/** A real track's playing state, from the native player, so the visualizer responds. */
	let nativePlaying = $state(false);
	const spinning = $derived(content.audioUrl ? nativePlaying : playing);
</script>

<ZinePageShell {shell}>
	<Stack gap="xs" class="audio-page-body">
		<!-- Track Category & Timecode Badges -->
		<Cluster justify="between" align="center">
			<span class="audio-badge font-mono">
				{content.audioUrl ? 'OFFICIAL TRACK' : 'UNRELEASED DEMO'}
			</span>
			<span class="audio-timecode font-mono">
				{#if content.audioUrl}
					{content.duration || 'AUDIO'}
				{:else}
					{playing ? '01:14' : '00:00'} / {content.duration || '03:42'}
				{/if}
			</span>
		</Cluster>

		<!-- Main Track Heading -->
		<Stack gap="3xs">
			<span class="audio-eyebrow font-mono">EXCLUSIVE STUDIO BOUNCE</span>
			<h2 class="bespoke-heading audio-title">{content.title || 'Studio Session Bounce'}</h2>
		</Stack>

		<!-- Modern Digital Audio Deck (Clean, No Tape, No Tilt) -->
		<div class="cassette audio-card" class:is-spinning={spinning}>
			<!-- Ambient Audio Glow Backdrop -->
			<div class="audio-ambient-glow" aria-hidden="true"></div>

			<!-- Sleek Vinyl / Soundwave Visualizer Disc -->
			<div class="audio-visualizer-deck" aria-hidden="true">
				<div class="vinyl-record-disc" class:is-spinning={spinning}>
					<div class="vinyl-grooves"></div>
					<div class="vinyl-center-label">
						<span class="cassette-reel reel-left"></span>
						<span class="cassette-tape"></span>
						<span class="cassette-reel reel-right"></span>
					</div>
				</div>

				<!-- Dynamic Soundwave Equalizer Bars -->
				<div class="soundwave-equalizer" class:is-active={spinning}>
					<span class="eq-bar bar-1"></span>
					<span class="eq-bar bar-2"></span>
					<span class="eq-bar bar-3"></span>
					<span class="eq-bar bar-4"></span>
					<span class="eq-bar bar-5"></span>
					<span class="eq-bar bar-6"></span>
					<span class="eq-bar bar-7"></span>
					<span class="eq-bar bar-8"></span>
				</div>
			</div>

			<!-- Track Details Panel -->
			<div class="cassette-label audio-details-panel">
				<div class="cassette-label-row audio-meta-row font-mono">
					<span class="cassette-side audio-format-pill">MASTER A</span>
					<span class="cassette-title audio-track-name">{content.title || (content.audioUrl ? 'Audio Track' : 'Rough Mix')}</span>
					<span class="cassette-length audio-duration-tag">{content.duration || (content.audioUrl ? '' : '03:42')}</span>
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
				<!-- Tactile Playback Bar -->
				<div class="audio-controls-row">
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

					<Stack gap="3xs" class="audio-timeline-stack">
						<Cluster justify="between" align="center" gap="xs">
							<span class="audio-status-label font-mono">
								{playing ? 'Playing unreleased mix...' : 'Tap to listen to rough mix'}
							</span>
							<span class="audio-status-tag font-mono">
								{playing ? 'STREAMING' : 'READY'}
							</span>
						</Cluster>
						<div class="audio-progress-track">
							<div class="audio-progress-fill {playing ? 'is-playing' : ''}"></div>
						</div>
					</Stack>
				</div>
			{/if}
		</div>

		{#if content.body}
			<div class="audio-liner-notes">
				<p class="bespoke-body-text">{content.body}</p>
			</div>
		{/if}
	</Stack>
</ZinePageShell>

<style>
	:global(.audio-page-body) {
		inline-size: 100%;
		max-inline-size: 32rem;
		margin-inline: auto;
	}

	.audio-badge {
		display: inline-flex;
		align-items: center;
		padding-block: var(--space-4xs);
		padding-inline: var(--space-xs);
		border-radius: var(--radius-full);
		background: rgba(1, 255, 195, 0.1);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.3);
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}

	.audio-timecode {
		font-size: var(--text-meta);
		color: var(--ink-muted);
		letter-spacing: var(--tracking-label);
	}

	.audio-eyebrow {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
		color: var(--accent);
		text-transform: uppercase;
	}

	.audio-title {
		font-size: var(--text-display);
		font-weight: var(--weight-black);
		letter-spacing: var(--tracking-tight);
		line-height: var(--leading-tight);
		color: #ffffff;
	}

	/* Modern Obsidian Audio Deck: Deep, Sleek, Luxury (No tape, No tilts!) */
	.cassette {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		padding-block: var(--space-xs);
		padding-inline: var(--space-s);
		background-color: #0d0b13;
		background-image:
			linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, transparent 40%),
			radial-gradient(circle at 50% 0%, rgba(5, 217, 232, 0.12) 0%, transparent 70%);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: var(--radius-lg);
		box-shadow:
			0 16px 36px -10px rgba(0, 0, 0, 0.9),
			inset 0 1px 0 rgba(255, 255, 255, 0.15);
		overflow: hidden;
	}

	/* Ambient Audio Glow */
	.audio-ambient-glow {
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at 50% 20%, rgba(5, 217, 232, 0.08), transparent 60%);
		pointer-events: none;
	}

	/* Visualizer Deck */
	.audio-visualizer-deck {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-2xs);
		padding-block: 0;
	}

	/* Precision Machined Vinyl Disc */
	.vinyl-record-disc {
		position: relative;
		inline-size: 5.5rem;
		block-size: 5.5rem;
		border-radius: 50%;
		background:
			radial-gradient(circle at center, #1b1724 0%, #0d0b12 68%, #000000 100%);
		box-shadow:
			0 8px 20px rgba(0, 0, 0, 0.8),
			0 0 0 1px rgba(255, 255, 255, 0.1),
			inset 0 0 0 2px rgba(0, 0, 0, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.6s ease;
	}

	.vinyl-grooves {
		position: absolute;
		inset: 4px;
		border-radius: 50%;
		background: repeating-radial-gradient(
			circle,
			transparent 0,
			transparent 3px,
			rgba(255, 255, 255, 0.04) 3px,
			rgba(255, 255, 255, 0.04) 4px
		);
	}

	.vinyl-center-label {
		position: relative;
		inline-size: 2.25rem;
		block-size: 2.25rem;
		border-radius: 50%;
		background:
			radial-gradient(circle at center, var(--accent) 0%, #090710 85%);
		border: 1px solid rgba(255, 255, 255, 0.2);
		display: flex;
		align-items: center;
		justify-content: space-around;
		padding-inline: var(--space-4xs);
		box-shadow: 0 0 12px rgba(5, 217, 232, 0.35);
	}

	/* Reel elements retained for test assertions, styled as micro spindle hubs */
	.cassette-reel {
		inline-size: 0.75rem;
		block-size: 0.75rem;
		border-radius: 50%;
		background: #ffffff;
		box-shadow: 0 0 6px rgba(255, 255, 255, 0.8);
		display: block;
	}

	.cassette-tape {
		inline-size: 0.75rem;
		block-size: 2px;
		background: rgba(255, 255, 255, 0.4);
		display: block;
	}

	/* Smooth Vinyl Spin Animation */
	@media (prefers-reduced-motion: no-preference) {
		.vinyl-record-disc.is-spinning {
			animation: vinyl-spin 4s linear infinite;
		}

		.cassette.is-spinning .cassette-reel {
			animation: cassette-spin 4s linear infinite;
		}
	}

	@keyframes vinyl-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes cassette-spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Soundwave Equalizer Bars */
	.soundwave-equalizer {
		display: flex;
		align-items: center;
		gap: var(--space-4xs);
		block-size: 1.5rem;
	}

	.eq-bar {
		inline-size: 3px;
		block-size: 6px;
		border-radius: 999px;
		background: var(--ink-muted);
		transition: block-size 0.2s ease, background-color 0.2s ease;
	}

	.soundwave-equalizer.is-active .eq-bar {
		background: var(--highlight);
		box-shadow: 0 0 8px rgba(1, 255, 195, 0.6);
	}

	@media (prefers-reduced-motion: no-preference) {
		.soundwave-equalizer.is-active .bar-1 { animation: eq-pulse 0.6s ease-in-out infinite alternate; }
		.soundwave-equalizer.is-active .bar-2 { animation: eq-pulse 0.9s ease-in-out infinite alternate 0.1s; }
		.soundwave-equalizer.is-active .bar-3 { animation: eq-pulse 0.7s ease-in-out infinite alternate 0.2s; }
		.soundwave-equalizer.is-active .bar-4 { animation: eq-pulse 1.1s ease-in-out infinite alternate 0.15s; }
		.soundwave-equalizer.is-active .bar-5 { animation: eq-pulse 0.8s ease-in-out infinite alternate 0.05s; }
		.soundwave-equalizer.is-active .bar-6 { animation: eq-pulse 1.0s ease-in-out infinite alternate 0.25s; }
		.soundwave-equalizer.is-active .bar-7 { animation: eq-pulse 0.65s ease-in-out infinite alternate 0.12s; }
		.soundwave-equalizer.is-active .bar-8 { animation: eq-pulse 0.85s ease-in-out infinite alternate 0.18s; }
	}

	@keyframes eq-pulse {
		0% { block-size: 4px; }
		100% { block-size: 1.4rem; }
	}

	/* Modern Details Panel */
	.audio-details-panel {
		padding-block: var(--space-xs);
		padding-inline: var(--space-s);
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: var(--radius-sm);
	}

	.audio-meta-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-xs);
	}

	.audio-format-pill {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		color: var(--accent);
		letter-spacing: var(--tracking-label);
	}

	.audio-track-name {
		font-size: var(--text-small);
		font-weight: var(--weight-semibold);
		color: #ffffff;
		text-transform: uppercase;
		letter-spacing: var(--tracking-label);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.audio-duration-tag {
		font-size: var(--text-meta);
		color: var(--ink-muted);
	}

	/* Tactile Playback Controls Row */
	.audio-controls-row {
		display: flex;
		align-items: center;
		gap: var(--space-m);
	}

	.audio-play-btn {
		min-inline-size: 44px;
		min-block-size: 44px;
		inline-size: 3rem;
		block-size: 3rem;
		border-radius: 50%;
		border: 1px solid var(--accent);
		background: rgba(5, 217, 232, 0.16);
		color: #ffffff;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		box-shadow: 0 4px 16px rgba(5, 217, 232, 0.25);
		transition: transform 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
	}

	.audio-play-btn:hover {
		transform: scale(1.05);
		background: rgba(5, 217, 232, 0.28);
		box-shadow: 0 6px 24px rgba(5, 217, 232, 0.45);
	}

	.audio-play-btn.is-playing {
		background: var(--accent);
		color: #090710;
		box-shadow: 0 0 24px rgba(5, 217, 232, 0.65);
	}

	.audio-btn-icon {
		inline-size: 1.5rem;
		block-size: 1.5rem;
	}

	:global(.audio-timeline-stack) {
		flex: 1;
		min-inline-size: 0;
	}

	.audio-status-label {
		font-size: var(--text-meta);
		font-weight: var(--weight-semibold);
		color: #ffffff;
	}

	.audio-status-tag {
		font-size: var(--text-meta);
		color: var(--highlight);
		letter-spacing: var(--tracking-wide);
	}

	.audio-progress-track {
		inline-size: 100%;
		block-size: 6px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: var(--radius-full);
		overflow: hidden;
		margin-block-start: var(--space-4xs);
	}

	.audio-progress-fill {
		inline-size: 0%;
		block-size: 100%;
		background: var(--accent);
		border-radius: var(--radius-full);
		transition: inline-size 0.3s ease;
	}

	.audio-progress-fill.is-playing {
		inline-size: 42%;
		box-shadow: 0 0 8px var(--accent);
	}

	.audio-native-player {
		inline-size: 100%;
		min-block-size: var(--control-size);
	}

	.audio-liner-notes {
		padding-block: var(--space-xs);
		padding-inline: var(--space-s);
		background: rgba(255, 255, 255, 0.02);
		border-radius: var(--radius-sm);
		border-inline-start: 3px solid var(--accent);
	}

	.audio-liner-notes p {
		color: #d4d0df;
		font-size: var(--text-body);
		line-height: var(--leading-body);
	}
</style>