<script lang="ts">
	import { page } from '$app/state';
	import { Center, Stack } from '$lib/components/layout';

	const notFound = $derived(page.status === 404);
	const title = $derived(notFound ? 'Page not found' : 'Something went wrong');
</script>

<svelte:head>
	<title>{title} | Quire</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<Center as="main" class="error-page">
	<Stack gap="sm" align="center">
		<p class="error-status">{page.status}</p>
		<h1>{title}</h1>
		{#if page.error?.message && page.error.message !== title + '.'}
			<p>{page.error.message}</p>
		{/if}
		{#if page.error?.id}
			<p class="error-id">Reference: <code>{page.error.id}</code></p>
		{/if}
		<a href="/">Back to Quire</a>
	</Stack>
</Center>

<style>
	@layer components {
		:global(.error-page) {
			min-block-size: 70vh;
			padding-inline: var(--space-m);
			text-align: center;
		}

		.error-status {
			font-size: var(--step-3);
			font-weight: 700;
			margin-block: 0;
		}

		h1 {
			margin-block: 0;
		}

		.error-id {
			font-size: var(--step--1);
			opacity: 0.75;
		}
	}
</style>
