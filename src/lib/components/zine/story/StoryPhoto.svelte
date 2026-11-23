<script lang="ts">
	import type { PhotoEntry } from '$domain/photo-pile';

	/**
	 * A photo page (ADR 0011): each photo fills the page and is its own segment
	 * of the progress bar. Portrait photos cover the page; landscape photos are
	 * shown whole, centred on black. The page title, the photo's caption and the
	 * page's words sit at the bottom over a scrim.
	 */
	interface Props {
		id: string;
		photos: PhotoEntry[];
		/** Which photo is showing. */
		part: number;
		title?: string;
		body?: string;
		city: string;
	}

	let { id, photos, part, title, body, city }: Props = $props();

	const heading = $derived(title || 'From Tonight');
	const current = $derived(photos[Math.min(Math.max(0, part), photos.length - 1)]);
	/** Photos measured wider than tall, by index: shown whole instead of cropped. */
	let landscape = $state<Record<number, boolean>>({});

	let images = $state<HTMLImageElement[]>([]);

	// Notes whether each photo is landscape once it loads. Listeners are added
	// here, not as onload or an action on <img>: for those Svelte server-renders an
	// inline onload attribute, which is inline script the CSP refuses.
	$effect(() => {
		const cleanups = images.map((img, index) => {
			if (!img) return () => {};
			const read = () => {
				if (img.naturalWidth && img.naturalHeight) landscape[index] = img.naturalWidth > img.naturalHeight;
			};
			if (img.complete) read();
			img.addEventListener('load', read);
			return () => img.removeEventListener('load', read);
		});
		return () => cleanups.forEach((cleanup) => cleanup());
	});
</script>

<section {id} class="story-photo" aria-labelledby="{id}-title">
	{#each photos as photo, i (i)}
		<img
			class="story-photo-img"
			class:is-current={i === part}
			class:is-landscape={landscape[i]}
			src={photo.url}
			alt={photo.caption || (photos.length > 1 ? `${heading}, photo ${i + 1} of ${photos.length}` : heading)}
			aria-hidden={i === part ? undefined : 'true'}
			bind:this={images[i]}
		/>
	{/each}
	{#if photos.length === 0}
		<div class="story-photo-empty" aria-hidden="true">{city}</div>
	{/if}

	<div class="story-caption-wrap">
	<div class="story-caption" data-scrim>
		{#if photos.length > 1}
			<span class="story-photo-count">{part + 1} / {photos.length}</span>
		{/if}
		<h2 id="{id}-title" class="story-photo-title" tabindex="-1">{heading}</h2>
		{#if current?.caption}
			<p class="story-photo-caption">{current.caption}</p>
		{/if}
		{#if body}
			<p class="story-photo-body">{body}</p>
		{/if}
	</div>
	</div>
</section>

<style>
	.story-photo {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: #000000;
		color: #ffffff;
	}

	.story-photo-img {
		position: absolute;
		inset: 0;
		inline-size: 100%;
		block-size: 100%;
		object-fit: cover;
		visibility: hidden;
	}

	.story-photo-img.is-current {
		visibility: visible;
	}

	.story-photo-img.is-landscape {
		object-fit: contain;
	}

	.story-photo-empty {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: var(--text-title);
		font-weight: var(--weight-heavy);
		color: rgba(255, 255, 255, 0.18);
	}

	/* The scrim: at least 62% black under every word, so white text passes AA over any photo.
	   It sits above the bottom bar, which brings its own scrim. */
	.story-caption-wrap {
		position: absolute;
		inset-inline: 0;
		inset-block-end: 0;
	}

	.story-caption {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
		max-block-size: 55dvh;
		overflow-y: auto;
		padding-block: var(--space-s) var(--story-bottom-space);
		padding-inline: var(--space-s);
		background-color: rgba(0, 0, 0, 0.62);
	}

	.story-caption-wrap::before {
		content: '';
		position: absolute;
		inset-inline: 0;
		inset-block-end: 100%;
		block-size: 25dvh;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.62), transparent);
		pointer-events: none;
	}

	.story-photo-count {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		color: #ffffff;
	}

	.story-photo-title {
		margin: 0;
		font-family: var(--story-heading-font, inherit);
		font-size: var(--text-heading-sm);
		font-weight: var(--weight-bold);
		line-height: var(--leading-heading);
		color: #ffffff;
	}

	.story-photo-title:focus {
		outline: none;
	}

	.story-photo-caption,
	.story-photo-body {
		margin: 0;
		max-inline-size: 60ch;
		font-size: var(--text-body);
		line-height: var(--leading-body);
		color: #ffffff;
	}
</style>
