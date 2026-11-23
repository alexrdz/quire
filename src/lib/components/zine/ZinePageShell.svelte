<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Stack } from '$lib/components/layout';
	import type { PageShell } from './reader';

	/**
	 * The frame the not-yet-restyled pages (setlist, text, audio, video, the Wall
	 * and the Endpaper) sit in inside the Stories reader (ADR 0011). The reader
	 * draws the header, progress and paging, so this is only the page itself;
	 * R-T02 to R-T04 restyle what is inside.
	 */
	interface Props {
		shell: PageShell;
		/**
		 * content: a content page (the body is centred).
		 * endpaper: the same layout on the Endpaper canvas.
		 * wall: the Wall, whose body fills the page.
		 */
		variant?: 'content' | 'wall' | 'endpaper';
		children: Snippet;
	}

	let { shell, variant = 'content', children }: Props = $props();

	const canvasClass = $derived(
		variant === 'wall' ? 'wall-canvas' : variant === 'endpaper' ? 'endpaper-canvas' : 'content-page-canvas'
	);
</script>

<section id={shell.id} class="page zine-paper {canvasClass}">
	{#if variant === 'wall'}
		<Stack gap="md" class="page-inner wall-full-stack">
			{@render children()}
		</Stack>
	{:else}
		<div class="page-inner">
			<Stack gap="lg" class="page-body margin-auto">
				{@render children()}
			</Stack>
		</div>
	{/if}
</section>

<style>
	/* Inside the Stories reader (ADR 0011) the page fills its frame instead of the
	   viewport, and leaves room for the reader's header and bottom bar. */
	.page {
		position: absolute;
		inset: 0;
		flex: none;
		inline-size: 100%;
		max-inline-size: none;
		block-size: 100%;
		max-block-size: none;
		scroll-snap-align: none;
		padding-block: var(--story-top-space, var(--page-padding-block)) var(--story-bottom-space, var(--page-padding-block));
		overscroll-behavior: contain;
	}

	:global(.margin-auto) {
		margin-block: auto;
		inline-size: 100%;
	}

	:global(.wall-full-stack) {
		block-size: 100%;
	}

	/* Type and links the inner pages share, so each is defined once for every page in the shell. */
	.page :global(.eyebrow-small) {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		letter-spacing: var(--tracking-wide);
		text-transform: uppercase;
	}

	.page :global(.bespoke-heading) {
		font-size: var(--text-heading);
		font-weight: var(--weight-heavy);
		color: #ffffff;
		letter-spacing: var(--tracking-snug);
	}

	.page :global(.bespoke-body-text) {
		font-size: var(--text-body);
		line-height: var(--leading-body);
		color: #d4d2df;
	}

	.page :global(.btn-action-highlight) {
		display: inline-flex;
		align-items: center;
		padding-block: var(--space-compact);
		padding-inline: var(--space-xs);
		border-radius: 6px;
		background: rgba(1, 255, 195, 0.14);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.4);
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		text-decoration: none;
		transition: background-color 0.15s ease;
	}

	.page :global(.btn-action-highlight:hover) {
		background: rgba(1, 255, 195, 0.24);
		color: var(--highlight);
	}
</style>
