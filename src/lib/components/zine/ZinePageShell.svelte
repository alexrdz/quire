<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Stack, Cluster } from '$lib/components/layout';
	import MetaChip from './MetaChip.svelte';
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
	<header class="cover-header">
		<Cluster align="center" gap="xs">
			{#each shell.chips as chip}
				<MetaChip tone={chip.tone}>{chip.label}</MetaChip>
			{/each}
		</Cluster>
		<span class="text-muted font-mono subtext-page">
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

<section id={shell.id} class="page {canvasClass} {photoUrl ? 'has-photo-bg' : ''}" style={pageStyle}>
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
	.has-photo-bg {
		background-image: var(--page-photo, none);
		background-size: cover;
		background-position: center;
	}

	.content-page-canvas,
	.wall-canvas,
	.endpaper-canvas {
		background-color: var(--bg-void);
		background-image: radial-gradient(circle at 50% 0%, rgba(21, 17, 36, 0.9), var(--bg-void) 75%);
	}

	.subtext-page {
		font-size: var(--text-body);
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

	.btn-page-nav {
		display: inline-flex;
		align-items: center;
		padding-block: var(--space-2xs);
		padding-inline: var(--space-xs);
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.05);
		color: #e4e4e7;
		border: 1px solid rgba(255, 255, 255, 0.12);
		font-size: var(--text-meta);
		font-weight: var(--weight-semibold);
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.btn-page-nav:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
	}

	.btn-page-nav-primary {
		display: inline-flex;
		align-items: center;
		padding-block: var(--space-2xs);
		padding-inline: var(--space-s);
		border-radius: 6px;
		background: rgba(1, 255, 195, 0.14);
		color: var(--highlight);
		border: 1px solid rgba(1, 255, 195, 0.4);
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.btn-page-nav-primary:hover {
		background: rgba(1, 255, 195, 0.24);
	}
</style>
