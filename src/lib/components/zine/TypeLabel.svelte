<script lang="ts">
	import type { Snippet } from 'svelte';
	import { zineTilt } from './reader';

	interface Props {
		/** Picks the label's deterministic tilt (at most about 1.5 degrees). */
		position?: number;
		/** The colour of the label's inked edge, as the old chips used them. */
		tone?: 'plain' | 'highlight' | 'accent' | 'support';
		children: Snippet;
	}

	let { position = 0, tone = 'plain', children }: Props = $props();

	const tilt = $derived(zineTilt(position, 1.5));
</script>

<span class="type-label type-label-{tone} type-face" style="--label-tilt: {tilt}deg;">{@render children()}</span>

<style>
	/* A typed paper label stuck on the page: dark ink on a light slip. */
	.type-label {
		display: inline-flex;
		align-items: center;
		padding-block: var(--space-4xs);
		padding-inline: var(--space-2xs);
		background-color: var(--zine-scrap-light);
		background-image: var(--zine-mottle);
		background-size: 420px 420px;
		color: var(--zine-scrap-light-ink);
		font-size: var(--text-meta);
		line-height: 1.5;
		text-transform: uppercase;
		border-inline-start: 4px solid transparent;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
		transform: rotate(var(--label-tilt));
	}

	.type-label-highlight {
		border-inline-start-color: var(--highlight);
	}

	.type-label-accent {
		border-inline-start-color: var(--accent);
	}

	.type-label-support {
		border-inline-start-color: var(--support);
	}
</style>
