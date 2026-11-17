<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Center, Stack } from '$lib/components/layout';

	interface Props {
		title: string;
		eyebrow: string;
		updated?: string;
		children: Snippet;
	}

	let { title, eyebrow, updated, children }: Props = $props();
</script>

<svelte:head>
	<title>{title} | Quire</title>
</svelte:head>

<Center as="main" max="measure" padding="md" class="info-page">
	<Stack as="article" gap="xl">
		<Stack as="header" gap="xs">
			<a href="/" class="info-page-back">← Quire Home</a>
			<span class="info-page-eyebrow">{eyebrow}</span>
			<h1>{title}</h1>
			{#if updated}
				<p class="info-page-meta">Last updated {updated}</p>
			{/if}
		</Stack>
		{@render children()}
	</Stack>
</Center>
