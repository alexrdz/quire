<script lang="ts">
	import type { PhotoEntry } from '$domain/photo-pile';
	import PhotoPile from '../PhotoPile.svelte';

	/**
	 * A photo page (ADR 0011, amended by B1-T35): the polaroid stack, centred between the
	 * header and the bottom bar on the dark page, with the page's title and words under it.
	 * The stack is one segment of the progress bar: it handles its own photos (swipe or
	 * tap to toss, tap to flip for the caption, Back, Restack), and a tap or drag that
	 * starts on it never changes the page. A single photo is one polaroid that flips if
	 * captioned, with no toss, counter or restack.
	 */
	interface Props {
		id: string;
		photos: PhotoEntry[];
		title?: string;
		body?: string;
		city: string;
	}

	let { id, photos, title, body, city }: Props = $props();

	const heading = $derived(title || 'From Tonight');
</script>

<section {id} class="story-photo" aria-labelledby="{id}-title">
	<div class="story-photo-stage">
		{#if photos.length > 0}
			<!-- Full width, so the stack sizes itself (min(100%, 24rem, 48dvh)) instead of
			     shrinking to nothing inside the centred column. -->
			<div class="story-photo-pile">
				<PhotoPile {photos} label={title || `${city} photo pile`} />
			</div>
		{:else}
			<div class="story-photo-empty" aria-hidden="true">{city}</div>
		{/if}

		<div class="story-photo-text">
			<h2 id="{id}-title" class="story-photo-title" tabindex="-1">{heading}</h2>
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
		background-color: var(--bg-void);
		color: #ffffff;
	}

	/* The stack and its words, centred between the header and the bottom bar; they
	   scroll inside the page if a long caption needs the room. */
	.story-photo-stage {
		position: absolute;
		inset-inline: 0;
		inset-block: var(--story-top-space) var(--story-bottom-space);
		display: flex;
		flex-direction: column;
		justify-content: safe center;
		align-items: center;
		gap: var(--space-s);
		overflow-x: hidden;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding-block: var(--space-xs);
		padding-inline: var(--space-s);
	}

	.story-photo-pile {
		inline-size: 100%;
	}

	.story-photo-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		min-block-size: 30dvh;
		font-size: var(--text-title);
		font-weight: var(--weight-heavy);
		color: rgba(255, 255, 255, 0.18);
	}

	.story-photo-text {
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
		inline-size: 100%;
		max-inline-size: 65ch;
		text-align: center;
	}

	.story-photo-title {
		margin: 0;
		font-family: var(--story-heading-font, inherit);
		font-size: var(--text-heading-sm);
		font-weight: var(--weight-bold);
		line-height: var(--leading-heading);
		color: #ffffff;
		overflow-wrap: anywhere;
	}

	.story-photo-title:focus {
		outline: none;
	}

	.story-photo-body {
		margin: 0;
		font-size: var(--text-body);
		line-height: var(--leading-body);
		color: #ffffff;
		overflow-wrap: anywhere;
	}
</style>
