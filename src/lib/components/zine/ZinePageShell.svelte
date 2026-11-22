<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Stack, Cluster } from '$lib/components/layout';
	import TypeLabel from './TypeLabel.svelte';
	import { scrollToPage, type PageShell } from './reader';

	interface Props {
		shell: PageShell;
		/**
		 * content: a content page (the body is centred, and a photo can back it).
		 * endpaper: the same layout on the Endpaper canvas.
		 * wall: the Wall, whose header, body and footer share one Stack.
		 */
		variant?: 'content' | 'wall' | 'endpaper';
		/** The first photo of a photo page, shown dimmed behind it. */
		photoUrl?: string;
		children: Snippet;
	}

	let { shell, variant = 'content', photoUrl, children }: Props = $props();

	const canvasClass = $derived(
		variant === 'wall' ? 'wall-canvas' : variant === 'endpaper' ? 'endpaper-canvas' : 'content-page-canvas'
	);
	const safePhotoCssUrl = $derived(photoUrl ? photoUrl.replace(/'/g, '%27') : '');
	const pageStyle = $derived(
		variant === 'content'
			? `--page-photo: ${
					photoUrl
						? `linear-gradient(to bottom, rgba(9, 7, 16, 0.72), rgba(9, 7, 16, 0.96)), url('${safePhotoCssUrl}')`
						: 'none'
				};`
			: undefined
	);
</script>

{#snippet header()}
	<div
		class="story-progress-bar"
		role="progressbar"
		aria-label="Story progress"
		aria-valuenow={shell.pageNumber}
		aria-valuemin={1}
		aria-valuemax={shell.pageCount}
	>
		{#each Array.from({ length: shell.pageCount }, (_, i) => i + 1) as pageNum}
			<div
				class="story-progress-segment{pageNum === shell.pageNumber
					? ' is-active'
					: pageNum < shell.pageNumber
						? ' is-completed'
						: ''}"
			></div>
		{/each}
	</div>
	<header class="cover-header">
		<Cluster align="center" gap="xs">
			{#each shell.chips as chip, i}
				<TypeLabel position={i} tone={chip.tone ?? 'plain'}>{chip.label}</TypeLabel>
			{/each}
		</Cluster>
		<span class="text-muted type-face subtext-page">
			Page {shell.pageNumber} of {shell.pageCount}
		</span>
	</header>
{/snippet}

{#snippet footer()}
	<footer class="page-footer">
		{#each shell.nav as link}
			<button
				type="button"
				class={link.primary ? 'btn-page-nav-primary' : 'btn-page-nav'}
				onclick={() => scrollToPage(link.target)}
			>
				{link.label}
			</button>
		{/each}
	</footer>
{/snippet}

<section
	id={shell.id}
	class="page zine-paper zine-page {canvasClass} {photoUrl ? 'has-photo-bg' : ''}"
	style={pageStyle}
>
	{#if variant === 'wall'}
		<Stack gap="md" class="page-inner wall-full-stack">
			{@render header()}
			{@render children()}
			{@render footer()}
		</Stack>
	{:else}
		<div class="page-inner">
			{@render header()}
			<Stack gap="lg" class="page-body margin-auto">
				{@render children()}
			</Stack>
			{@render footer()}
		</div>
	{/if}
</section>

<style>
	/* Dark paper and grain come from .zine-paper; a photo page keeps the grain over its dimmed photo.
	   --page-photo is two layers (the dimming gradient, then the photo), so three sizes in all. */
	.has-photo-bg {
		background-image: var(--zine-grain), var(--page-photo, none);
		background-size: 160px 160px, cover, cover;
		background-position: 0 0, center, center;
		background-repeat: repeat, no-repeat, no-repeat;
	}

	.subtext-page {
		font-size: var(--text-small);
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

	.header-chip-link {
		display: inline-flex;
		align-items: center;
		text-decoration: none;
		color: inherit;
		cursor: pointer;
		transition: opacity 0.15s ease;
	}

	.header-chip-link:hover {
		opacity: 0.85;
	}

	.btn-page-nav {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		/* Page buttons are tap targets: at least 44 px (Z-T08). */
		min-block-size: 44px;
		min-inline-size: 44px;
		block-size: 44px;
		padding-block: 0;
		padding-inline: var(--space-s);
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.08);
		color: #ffffff;
		border: 1px solid rgba(255, 255, 255, 0.3);
		font-size: var(--text-meta);
		font-weight: var(--weight-semibold);
		cursor: pointer;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
		transition: background-color 0.15s ease, border-color 0.15s ease;
	}

	.btn-page-nav:hover {
		background: rgba(255, 255, 255, 0.16);
		border-color: rgba(255, 255, 255, 0.55);
		color: #ffffff;
	}

	.btn-page-nav-primary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		/* Page buttons are tap targets: at least 44 px (Z-T08). */
		min-block-size: 44px;
		min-inline-size: 44px;
		block-size: 44px;
		padding-block: 0;
		padding-inline: var(--space-m);
		border-radius: 6px;
		background: rgba(1, 255, 195, 0.16);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.7);
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		cursor: pointer;
		box-shadow: 0 0 10px rgba(1, 255, 195, 0.2), 0 1px 3px rgba(0, 0, 0, 0.5);
		transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.btn-page-nav-primary:hover {
		background: rgba(1, 255, 195, 0.28);
		border-color: rgba(1, 255, 195, 0.95);
		box-shadow: 0 0 16px rgba(1, 255, 195, 0.4);
	}
</style>
