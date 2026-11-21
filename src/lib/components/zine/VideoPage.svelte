<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Stack, Cluster, Frame } from '$lib/components/layout';
	import Scrap from './Scrap.svelte';
	import Tape from './Tape.svelte';
	import TypeLabel from './TypeLabel.svelte';
	import ZinePageShell from './ZinePageShell.svelte';
	import { resolveVideoEmbed, zineTilt, type PageContent, type PageShell } from './reader';

	interface Props {
		shell: PageShell;
		content: PageContent;
	}

	let { shell, content }: Props = $props();

	const videoEmbed = $derived(resolveVideoEmbed(content.videoUrl || content.embedUrl));
	/** YouTube and Vimeo load only after a tap (lazy facade), so a page view never contacts them. */
	let activated = $state(false);
	/** The taped-on screen lies a little crooked; less than text, so a playing video stays square enough. */
	const tilt = $derived(zineTilt(shell.pageNumber + 2, 1.2));
</script>

{#snippet screen(children: Snippet, isPortrait = false)}
	<!-- A screen taped onto the page: a dark bezel around the player. -->
	<div class="video-screen" class:is-portrait={isPortrait} style="--screen-tilt: {tilt}deg;">
		<Tape placement="top-left" position={shell.pageNumber} />
		<Tape placement="top-right" position={shell.pageNumber + 1} />
		{@render children()}
	</div>
{/snippet}

<ZinePageShell {shell}>
	<Stack gap="md">
		<h2 class="bespoke-heading">{content.title || 'Live Video'}</h2>

		{#if videoEmbed.kind === 'youtube'}
			<Stack gap="xs">
				{#snippet youtube()}
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
				{/snippet}
				{@render screen(youtube)}
				<Cluster justify="end">
					<a href={videoEmbed.watchUrl} target="_blank" rel="noopener noreferrer" class="video-external-link">
						Watch on YouTube ↗
					</a>
				</Cluster>
			</Stack>
		{:else if videoEmbed.kind === 'vimeo'}
			<Stack gap="xs">
				{#snippet vimeo()}
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
				{/snippet}
				{@render screen(vimeo)}
				<Cluster justify="end">
					<a href={videoEmbed.watchUrl} target="_blank" rel="noopener noreferrer" class="video-external-link">
						Watch on Vimeo ↗
					</a>
				</Cluster>
			</Stack>
		{:else if videoEmbed.kind === 'bandcamp-embed'}
			{#snippet bandcamp()}
				<iframe
					src={videoEmbed.embedSrc}
					title={content.title || 'Bandcamp Player'}
					class="bandcamp-iframe"
					loading="lazy"
					seamless
				></iframe>
			{/snippet}
			{@render screen(bandcamp)}
		{:else if videoEmbed.kind === 'video-file'}
			{@const isPortrait = content.orientation === 'portrait'}
			{#snippet file()}
				<Frame ratio={isPortrait ? '9-16' : '16-9'} class="video-frame {isPortrait ? 'video-frame-portrait' : ''}">
					<video controls preload="metadata" src={videoEmbed.src} playsinline>
						<track kind="captions" />
					</video>
				</Frame>
			{/snippet}
			{@render screen(file, isPortrait)}
		{:else if videoEmbed.kind === 'bandcamp-link' || videoEmbed.kind === 'external-link'}
			<!-- A link out is a dark scrap taped down, not a glass card. -->
			<Scrap position={shell.pageNumber} class="video-link-card">
				<Tape placement="top" position={shell.pageNumber + 3} />
				<Cluster justify="between" align="center" gap="sm">
					<Stack gap="2xs">
						<TypeLabel position={shell.pageNumber} tone="accent">
							{videoEmbed.kind === 'bandcamp-link' ? 'BANDCAMP' : 'VIDEO / EMBED'}
						</TypeLabel>
						<span class="video-link-title">{content.title || 'Open Media'}</span>
					</Stack>
					<a href={videoEmbed.watchUrl} target="_blank" rel="noopener noreferrer" class="btn-action-highlight">
						Open ↗
					</a>
				</Cluster>
			</Scrap>
		{/if}

		{#if content.body}
			<p class="bespoke-body-text">{content.body}</p>
		{/if}
	</Stack>
</ZinePageShell>

<style>
	/* The screen: a dark bezel, taped on at a slight angle, with a faint glass sheen at the top. */
	.video-screen {
		position: relative;
		/* Inset so the corner tape lands on the page, clear of its edge gutter. */
		margin-inline: var(--space-s);
		padding-block: var(--space-2xs) var(--space-xs);
		padding-inline: var(--space-2xs);
		background-color: #121016;
		background-image: var(--zine-grain), linear-gradient(to bottom, #24202b, #121016 40%);
		background-size: 160px 160px, auto;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 12px;
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.08),
			0 16px 28px -12px rgba(0, 0, 0, 0.85);
		transform: rotate(var(--screen-tilt, 0deg));
	}

	.video-screen.is-portrait {
		max-inline-size: 300px;
		margin-inline: auto;
	}

	:global(.video-frame) {
		border-radius: 6px;
		background: #050407;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.6);
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

	:global(.video-link-card) {
		inline-size: 100%;
	}

	.bandcamp-iframe {
		display: block;
		inline-size: 100%;
		block-size: 120px;
		border: none;
		border-radius: 6px;
	}

	.video-link-title {
		font-size: var(--text-body);
		font-weight: var(--weight-bold);
		color: #ffffff;
	}
</style>
