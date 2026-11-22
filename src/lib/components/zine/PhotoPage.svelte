<script lang="ts">
	import { Stack } from '$lib/components/layout';
	import { resolvePhotoEntries } from '$domain/photo-pile';
	import PhotoPile from './PhotoPile.svelte';
	import Scrap from './Scrap.svelte';
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
		<!-- The page's title and words are a typed caption slip stuck under the photos. -->
		<Scrap position={shell.pageNumber} tone="light" class="photo-caption">
			<Stack gap="2xs">
				<h2 class="bespoke-heading">
					{content.title || 'From Tonight'}
				</h2>
				{#if content.body}
					<p class="bespoke-body-text">{content.body}</p>
				{/if}
			</Stack>
		</Scrap>
	</Stack>
</ZinePageShell>

<style>
	:global(.photo-caption) {
		max-inline-size: 30rem;
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.25),
			0 12px 28px -6px rgba(0, 0, 0, 0.6);
	}

	/* Typed on the slip: the typewriter face in dark ink. */
	:global(.photo-caption) h2.bespoke-heading {
		font-family: var(--font-type);
		font-size: var(--text-heading-sm);
		font-weight: var(--weight-regular);
		letter-spacing: var(--tracking-normal);
		line-height: var(--leading-heading);
		color: var(--zine-scrap-light-ink);
	}

	:global(.photo-caption) p.bespoke-body-text {
		font-family: var(--font-type);
		font-size: var(--text-ui);
		line-height: var(--leading-snug);
		color: var(--zine-scrap-light-ink);
	}
</style>
