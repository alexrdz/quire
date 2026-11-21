<script lang="ts">
	import { Stack } from '$lib/components/layout';
	import Scrap from './Scrap.svelte';
	import Tape from './Tape.svelte';
	import ZinePageShell from './ZinePageShell.svelte';
	import type { PageContent, PageShell, PageSource } from './reader';

	interface Props {
		shell: PageShell;
		content: PageContent;
		source: PageSource;
		artistName: string;
	}

	let { shell, content, source, artistName }: Props = $props();
</script>

<ZinePageShell {shell}>
	<Stack gap="md">
		<h2 class="bespoke-heading">
			{content.title || (source === 'template' ? `About ${artistName}` : 'From the Road')}
		</h2>
		<!-- The words are on a paper scrap taped to the page, within the ADR 0009 tilt for text. -->
		<Scrap position={shell.pageNumber} tone="light" class="text-scrap">
			<Tape placement={shell.pageNumber % 2 === 0 ? 'top-left' : 'top-right'} position={shell.pageNumber} />
			<p class="bespoke-body-text">
				{content.body || 'Thank you for being here tonight with us in this room.'}
			</p>
		</Scrap>
	</Stack>
</ZinePageShell>

<style>
	:global(.text-scrap) {
		max-inline-size: 34rem;
		/* Inset so the corner tape lands on the page, clear of its edge gutter. */
		margin-inline: var(--space-s);
	}

	/* Dark ink on the light scrap; the Artist's body face is kept. */
	:global(.text-scrap) p.bespoke-body-text {
		color: var(--zine-scrap-light-ink);
	}
</style>
