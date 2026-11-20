<script lang="ts">
	import { Stack, Box, Cluster } from '$lib/components/layout';
	import MetaChip from './MetaChip.svelte';
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
</script>

<ZinePageShell {shell}>
	<Stack gap="md">
		<Cluster justify="between" align="center">
			<MetaChip tone="accent">
				{content.audioUrl ? 'AUDIO TRACK' : 'UNRELEASED DEMO'}
			</MetaChip>
			{#if content.audioUrl}
				{#if content.duration}
					<span class="text-accent font-mono">{content.duration}</span>
				{/if}
			{:else}
				<span class="text-accent font-mono">
					{playing ? '01:14' : '00:00'} / {content.duration || '03:42'}
				</span>
			{/if}
		</Cluster>

		<h2 class="bespoke-heading">{content.title || 'Studio Session Bounce'}</h2>

		<Box variant="raised" padding="lg" radius="lg" class="audio-card">
			{#if content.audioUrl}
				<Stack gap="sm">
					<audio controls preload="metadata" src={content.audioUrl} class="audio-native-player"></audio>
					<Cluster justify="between" align="center">
						<span class="audio-track-label">{content.title || 'Audio Track'}</span>
						{#if content.duration}
							<span class="text-muted font-mono audio-duration-label">{content.duration}</span>
						{/if}
					</Cluster>
				</Stack>
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
		</Box>

		{#if content.body}
			<p class="bespoke-body-text">{content.body}</p>
		{/if}
	</Stack>
</ZinePageShell>

<style>
	:global(.audio-card) {
		border-color: var(--glass-border);
	}

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
	}

	.audio-duration-label {
		font-size: var(--text-meta);
	}
</style>
