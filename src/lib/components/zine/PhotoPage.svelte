<script lang="ts">
	import { Stack } from '$lib/components/layout';
	import { resolvePhotoEntries } from '$domain/photo-pile';
	import PhotoPile from './PhotoPile.svelte';
	import ZinePageShell from './ZinePageShell.svelte';
	import type { PageContent, PageShell } from './reader';

	interface Props {
		shell: PageShell;
		content: PageContent;
		city: string;
	}

	let { shell, content, city }: Props = $props();

	const photos = $derived(resolvePhotoEntries(content));
</script>

<ZinePageShell {shell} photoUrl={photos[0]?.url}>
	<Stack gap="md">
		{#if photos.length > 0}
			<!-- One photo is a single polaroid card; its caption lives on the back. -->
			<PhotoPile {photos} label={content.title || `${city} photo pile`} />
		{/if}
		<h2 class="bespoke-heading">
			{content.title || 'From Tonight'}
		</h2>
		{#if content.body}
			<p class="bespoke-body-text">{content.body}</p>
		{/if}
	</Stack>
</ZinePageShell>
