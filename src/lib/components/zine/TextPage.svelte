<script lang="ts">
	import { Stack } from '$lib/components/layout';
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
		<p class="bespoke-body-text">
			{content.body || 'Thank you for being here tonight with us in this room.'}
		</p>
	</Stack>
</ZinePageShell>
