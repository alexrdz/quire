<script lang="ts">
	import { untrack } from 'svelte';
	import { Frame } from '$lib/components/layout';
	import { resolveVideoEmbed, type PageContent, type PageShell } from './reader';

	/**
	 * A video page in the Stories reader (ADR 0011).
	 *
	 * - An uploaded clip fills the page: portrait clips are cropped to fill it, landscape
	 *   clips are shown whole, centred on black. It plays muted and inline when its page
	 *   becomes current and pauses when the Fan leaves, with a clear mute button. Its
	 *   native controls sit just above the bottom bar and never page the reader (the
	 *   reader ignores taps that start on a video).
	 * - YouTube and Vimeo stay a tap-to-load facade (no request until the Fan taps, and
	 *   the CSP allows only those frames), centred at 16:9 on black. Bandcamp is centred
	 *   at its own size. None autoplays, and a tap inside an iframe never reaches the reader.
	 * - Any other link is a clean card with a button.
	 */
	interface Props {
		shell: PageShell;
		content: PageContent;
		/** Whether this is the page on screen, from the reader: the clip plays only then. */
		current?: boolean;
	}

	let { shell, content, current = false }: Props = $props();

	const embed = $derived(resolveVideoEmbed(content.videoUrl || content.embedUrl));
	const heading = $derived(content.title || 'Live Video');
	const titleId = $derived(`${shell.id}-title`);

	/** YouTube and Vimeo load only after a tap (lazy facade), so a page view never contacts them. */
	let activated = $state(false);

	let videoEl = $state<HTMLVideoElement | null>(null);

	/** The YouTube poster failed to load: show the plain dark facade, not a broken image. */
	let posterEl = $state<HTMLImageElement | null>(null);
	let posterFailed = $state(false);
	// Listened for here, not with onerror on <img>: Svelte server-renders that as an
	// inline handler, which the CSP refuses.
	$effect(() => {
		const img = posterEl;
		if (!img) return;
		const fail = () => (posterFailed = true);
		if (img.complete && img.naturalWidth === 0 && img.currentSrc) fail();
		img.addEventListener('error', fail);
		return () => img.removeEventListener('error', fail);
	});
	let muted = $state(true);
	/** From the saved orientation, or the clip's own size once it loads. */
	let measuredLandscape = $state<boolean | null>(null);
	const landscape = $derived(
		content.orientation === 'landscape' || (content.orientation !== 'portrait' && measuredLandscape === true)
	);

	// Reads the clip's size once its metadata loads. A listener, not onloadedmetadata
	// on the element: that would server-render an inline handler, which the CSP refuses.
	$effect(() => {
		const video = videoEl;
		if (!video) return;
		const read = () => {
			if (video.videoWidth && video.videoHeight) measuredLandscape = video.videoWidth > video.videoHeight;
		};
		if (video.readyState >= 1) read();
		video.addEventListener('loadedmetadata', read);
		return () => video.removeEventListener('loadedmetadata', read);
	});

	// Plays when the page becomes current, pauses when the Fan leaves. Muted until the
	// Fan unmutes, so the browser allows it to start on its own.
	$effect(() => {
		const video = videoEl;
		if (!video) return;
		if (current) {
			video.muted = untrack(() => muted);
			video.play().catch(() => {
				// The browser declined (data saver, low power): the controls still work.
			});
		} else {
			video.pause();
		}
	});

	function toggleMute() {
		muted = !muted;
		if (videoEl) {
			videoEl.muted = muted;
			if (!muted && videoEl.paused && current) videoEl.play().catch(() => {});
		}
	}
</script>

<section id={shell.id} class="story-video" aria-labelledby={titleId}>
	{#if embed.kind === 'video-file'}
		<video
			bind:this={videoEl}
			bind:muted
			class="story-video-clip"
			class:is-landscape={landscape}
			aria-label="Video: {heading}"
			src={embed.src}
			preload="metadata"
			playsinline
			loop
			controls
		>
			<track kind="captions" />
		</video>

		<button
			type="button"
			class="story-mute"
			onclick={toggleMute}
			aria-label={muted ? 'Unmute video' : 'Mute video'}
			aria-pressed={!muted}
		>
			{#if muted}
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
					<path d="m16 9 5 6m0-6-5 6" />
				</svg>
			{:else}
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" />
					<path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
				</svg>
			{/if}
		</button>

		<div class="story-video-caption">
			<h2 id={titleId} class="story-media-title" tabindex="-1">{heading}</h2>
			{#if content.body}
				<p class="story-media-body">{content.body}</p>
			{/if}
		</div>
	{:else}
		<div class="story-media-stage">
			{#if embed.kind === 'youtube' || embed.kind === 'vimeo'}
				{@const service = embed.kind === 'youtube' ? 'YouTube' : 'Vimeo'}
				<Frame ratio="16-9" class="story-embed">
					{#if activated}
						<iframe
							src={embed.embedSrc}
							title={content.title || `${service} video player`}
							allow={embed.kind === 'youtube'
								? 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
								: 'autoplay; fullscreen; picture-in-picture'}
							allowfullscreen
							loading="lazy"
						></iframe>
					{:else}
						<div class="story-embed-facade">
							{#if embed.kind === 'youtube'}
								{#if !posterFailed}
									<img src={embed.posterSrc} alt="" loading="lazy" class="story-embed-poster" bind:this={posterEl} />
								{/if}
							{/if}
							<button
								type="button"
								class="story-embed-play"
								onclick={() => (activated = true)}
								aria-label="Play {content.title || `${service} video`}"
							>
								<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14l11-7z" fill="currentColor" /></svg>
							</button>
						</div>
					{/if}
				</Frame>
				<div class="story-media-text">
					<h2 id={titleId} class="story-media-title" tabindex="-1">{heading}</h2>
					{#if content.body}
						<p class="story-media-body">{content.body}</p>
					{/if}
					<a href={embed.watchUrl} target="_blank" rel="noopener noreferrer" class="story-media-link">
						Watch on {service}
					</a>
				</div>
			{:else if embed.kind === 'bandcamp-embed'}
				<iframe
					src={embed.embedSrc}
					title={content.title || 'Bandcamp player'}
					class="story-bandcamp"
					loading="lazy"
					seamless
				></iframe>
				<div class="story-media-text">
					<h2 id={titleId} class="story-media-title" tabindex="-1">{heading}</h2>
					{#if content.body}
						<p class="story-media-body">{content.body}</p>
					{/if}
				</div>
			{:else if embed.kind === 'bandcamp-link' || embed.kind === 'external-link'}
				<div class="story-link-card">
					<span class="story-link-kind">{embed.kind === 'bandcamp-link' ? 'Bandcamp' : 'Video'}</span>
					<h2 id={titleId} class="story-media-title" tabindex="-1">{heading}</h2>
					{#if content.body}
						<p class="story-media-body">{content.body}</p>
					{/if}
					<a href={embed.watchUrl} target="_blank" rel="noopener noreferrer" class="story-link-button">
						{embed.kind === 'bandcamp-link' ? 'Open on Bandcamp' : 'Open video'}
					</a>
				</div>
			{:else}
				<div class="story-media-text">
					<h2 id={titleId} class="story-media-title" tabindex="-1">{heading}</h2>
					{#if content.body}
						<p class="story-media-body">{content.body}</p>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</section>

<style>
	.story-video {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: #000000;
		color: #ffffff;
	}

	/* The clip fills the page down to the bottom bar, so its native controls stay above the bar. */
	.story-video-clip {
		position: absolute;
		inset-inline: 0;
		inset-block-start: 0;
		inline-size: 100%;
		block-size: calc(100% - var(--story-bottom-space));
		object-fit: cover;
		background: #000000;
	}

	.story-video-clip.is-landscape {
		object-fit: contain;
	}

	/* Mute and unmute: a clear 44 px round button under the header, on its own dark disc. */
	.story-mute {
		position: absolute;
		inset-block-start: var(--story-top-space);
		inset-inline-end: var(--space-s);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		inline-size: 44px;
		block-size: 44px;
		padding: 0;
		border: none;
		border-radius: 999px;
		background-color: rgba(0, 0, 0, 0.62);
		color: #ffffff;
		cursor: pointer;
	}

	.story-mute svg {
		inline-size: 1.375rem;
		block-size: 1.375rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.story-mute:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* The title and words over a scrim, just above the native controls; taps on them page as usual.
	   The scrim is at least 62% black under every word, so white text passes AA over any frame. */
	.story-video-caption {
		position: absolute;
		inset-inline: 0;
		inset-block-end: calc(var(--story-bottom-space) + var(--control-size) + var(--space-2xs));
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
		max-block-size: 35dvh;
		overflow-y: auto;
		padding-block: var(--space-s);
		padding-inline: var(--space-s);
		background-color: rgba(0, 0, 0, 0.62);
	}

	.story-video-caption::before {
		content: '';
		position: absolute;
		inset-inline: 0;
		inset-block-end: 100%;
		block-size: 12dvh;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.62), transparent);
		pointer-events: none;
	}

	/* Embeds and links: centred between the header and the bottom bar, on black. */
	.story-media-stage {
		position: absolute;
		inset-inline: 0;
		inset-block: var(--story-top-space) var(--story-bottom-space);
		display: flex;
		flex-direction: column;
		justify-content: safe center;
		align-items: center;
		gap: var(--space-s);
		overflow-y: auto;
		padding-inline: var(--space-s);
	}

	:global(.story-embed) {
		inline-size: 100%;
		border-radius: 12px;
		overflow: hidden;
		background: #000000;
	}

	:global(.story-embed) iframe {
		inline-size: 100%;
		block-size: 100%;
		border: 0;
	}

	.story-embed-facade {
		position: relative;
		inline-size: 100%;
		block-size: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #111111;
	}

	.story-embed-poster {
		position: absolute;
		inset: 0;
		inline-size: 100%;
		block-size: 100%;
		object-fit: cover;
	}

	.story-embed-play {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		inline-size: 64px;
		block-size: 64px;
		padding: 0;
		border: none;
		border-radius: 999px;
		background-color: var(--accent);
		color: var(--on-accent);
		cursor: pointer;
	}

	.story-embed-play svg {
		inline-size: 1.75rem;
		block-size: 1.75rem;
	}

	.story-embed-play:focus-visible,
	.story-media-link:focus-visible,
	.story-link-button:focus-visible {
		outline: 2px solid #ffffff;
		outline-offset: 2px;
	}

	.story-bandcamp {
		inline-size: 100%;
		max-inline-size: 22rem;
		block-size: 30rem;
		max-block-size: 100%;
		flex-shrink: 0;
		border: 0;
		border-radius: 12px;
	}

	.story-media-text {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
		inline-size: 100%;
		max-inline-size: 65ch;
	}

	.story-media-title {
		margin: 0;
		font-family: var(--story-heading-font, inherit);
		font-size: var(--text-heading-sm);
		font-weight: var(--weight-bold);
		line-height: var(--leading-heading);
		color: #ffffff;
		overflow-wrap: anywhere;
	}

	.story-media-title:focus {
		outline: none;
	}

	.story-media-body {
		margin: 0;
		max-inline-size: 60ch;
		font-size: var(--text-body);
		line-height: var(--leading-body);
		color: #ffffff;
		overflow-wrap: anywhere;
	}

	.story-media-link {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		min-block-size: 44px;
		font-size: var(--text-small);
		font-weight: var(--weight-bold);
		color: #ffffff;
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	/* A link out: a clean card with one clear button. */
	.story-link-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		inline-size: 100%;
		max-inline-size: 26rem;
		padding: var(--space-m);
		border-radius: 12px;
		background-color: var(--bg-surface);
	}

	.story-link-kind {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.78);
	}

	.story-link-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-block-size: 44px;
		padding-inline: var(--space-m);
		border-radius: 12px;
		background-color: var(--accent);
		color: var(--on-accent);
		font-size: var(--text-ui);
		font-weight: var(--weight-bold);
		text-decoration: none;
	}
</style>
