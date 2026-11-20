<script lang="ts">
	import { Stack, Box, Cluster, Frame } from '$lib/components/layout';
	import MetaChip from './MetaChip.svelte';
	import ZinePageShell from './ZinePageShell.svelte';
	import { resolveVideoEmbed, type PageContent, type PageShell } from './reader';

	interface Props {
		shell: PageShell;
		content: PageContent;
	}

	let { shell, content }: Props = $props();

	const videoEmbed = $derived(resolveVideoEmbed(content.videoUrl || content.embedUrl));
	/** YouTube and Vimeo load only after a tap (lazy facade), so a page view never contacts them. */
	let activated = $state(false);
</script>

<ZinePageShell {shell}>
	<Stack gap="md">
		<h2 class="bespoke-heading">{content.title || 'Live Video'}</h2>

		{#if videoEmbed.kind === 'youtube'}
			<Stack gap="xs">
				<Frame ratio="16-9" class="video-frame">
					{#if activated}
						<iframe
							src={videoEmbed.embedSrc}
							title={content.title || 'YouTube video player'}
							allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
							allowfullscreen
							loading="lazy"
						></iframe>
					{:else}
						<img
							src={videoEmbed.posterSrc}
							alt={content.title || 'Video thumbnail'}
							loading="lazy"
							class="video-poster-img"
						/>
						<button
							type="button"
							class="video-facade-play"
							onclick={() => (activated = true)}
							aria-label="Play {content.title || 'video'}"
						>
							<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="video-play-icon">
								<path d="M8 5v14l11-7z" />
							</svg>
							<span>Play Video</span>
						</button>
					{/if}
				</Frame>
				<Cluster justify="end">
					<a href={videoEmbed.watchUrl} target="_blank" rel="noopener noreferrer" class="video-external-link">
						Watch on YouTube ↗
					</a>
				</Cluster>
			</Stack>
		{:else if videoEmbed.kind === 'vimeo'}
			<Stack gap="xs">
				<Frame ratio="16-9" class="video-frame">
					{#if activated}
						<iframe
							src={videoEmbed.embedSrc}
							title={content.title || 'Vimeo video player'}
							allow="autoplay; fullscreen; picture-in-picture"
							allowfullscreen
							loading="lazy"
						></iframe>
					{:else}
						<div class="video-facade-backdrop">
							<button
								type="button"
								class="video-facade-play"
								onclick={() => (activated = true)}
								aria-label="Play {content.title || 'Vimeo video'}"
							>
								<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="video-play-icon">
									<path d="M8 5v14l11-7z" />
								</svg>
								<span>Play Vimeo Video</span>
							</button>
						</div>
					{/if}
				</Frame>
				<Cluster justify="end">
					<a href={videoEmbed.watchUrl} target="_blank" rel="noopener noreferrer" class="video-external-link">
						Watch on Vimeo ↗
					</a>
				</Cluster>
			</Stack>
		{:else if videoEmbed.kind === 'bandcamp-embed'}
			<Box variant="raised" padding="sm" radius="md" class="bandcamp-card">
				<iframe
					src={videoEmbed.embedSrc}
					title={content.title || 'Bandcamp Player'}
					class="bandcamp-iframe"
					loading="lazy"
					seamless
				></iframe>
			</Box>
		{:else if videoEmbed.kind === 'video-file'}
			<Frame ratio="16-9" class="video-frame">
				<video controls preload="metadata" src={videoEmbed.src}>
					<track kind="captions" />
				</video>
			</Frame>
		{:else if videoEmbed.kind === 'bandcamp-link' || videoEmbed.kind === 'external-link'}
			<Box variant="raised" padding="lg" radius="lg" class="video-link-card">
				<Cluster justify="between" align="center" gap="sm">
					<Stack gap="3xs">
						<MetaChip tone="accent">
							{videoEmbed.kind === 'bandcamp-link' ? 'BANDCAMP' : 'VIDEO / EMBED'}
						</MetaChip>
						<span class="video-link-title">{content.title || 'Open Media'}</span>
					</Stack>
					<a href={videoEmbed.watchUrl} target="_blank" rel="noopener noreferrer" class="btn-action-highlight">
						Open ↗
					</a>
				</Cluster>
			</Box>
		{/if}

		{#if content.body}
			<p class="bespoke-body-text">{content.body}</p>
		{/if}
	</Stack>
</ZinePageShell>

<style>
	:global(.video-frame) {
		border-radius: var(--radius-lg);
		border: 1px solid var(--glass-border);
		background: rgba(9, 7, 16, 0.9);
	}

	.video-poster-img {
		inline-size: 100%;
		block-size: 100%;
		object-fit: cover;
		display: block;
	}

	.video-facade-backdrop {
		inline-size: 100%;
		block-size: 100%;
		background: radial-gradient(circle at 50% 40%, rgba(5, 217, 232, 0.16), rgba(9, 7, 16, 0.95));
	}

	.video-facade-play {
		position: absolute;
		inset-block-start: 50%;
		inset-inline-start: 50%;
		transform: translate(-50%, -50%);
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
		padding-block: var(--space-xs);
		padding-inline: var(--space-s);
		border-radius: 8px;
		background: rgba(9, 7, 16, 0.88);
		color: #ffffff;
		border: 1px solid var(--accent);
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		cursor: pointer;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
		transition: background-color 0.15s ease, transform 0.15s ease;
	}

	.video-facade-play:hover {
		background: var(--accent);
		color: #090710;
	}

	.video-play-icon {
		inline-size: 1.15rem;
		block-size: 1.15rem;
		display: block;
	}

	.video-external-link {
		font-family: var(--font-mono);
		font-size: var(--text-meta);
		color: var(--accent);
		text-decoration: none;
	}

	.video-external-link:hover {
		text-decoration: underline;
	}

	:global(.bandcamp-card),
	:global(.video-link-card) {
		border-color: var(--glass-border);
	}

	.bandcamp-iframe {
		inline-size: 100%;
		block-size: 120px;
		border: none;
	}

	.video-link-title {
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		color: #ffffff;
	}
</style>
