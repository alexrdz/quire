<script lang="ts">
	import type { Component } from 'svelte';
	import RootLayout from '../../../src/routes/+layout.svelte';
	import type { PublicFeatures } from '$lib/features';

	/** Renders a page component inside the real root layout, as SvelteKit does. */
	interface Props {
		features: PublicFeatures;
		page?: Component<any>;
		pageProps?: Record<string, unknown>;
		/** Plain text for the body when there is no page component (the error page). */
		text?: string;
	}

	let { features, page: Page, pageProps = {}, text = '' }: Props = $props();
</script>

<RootLayout data={{ features } as never}>
	{#if Page}
		<Page {...pageProps} />
	{:else}
		<h1>{text}</h1>
	{/if}
</RootLayout>
