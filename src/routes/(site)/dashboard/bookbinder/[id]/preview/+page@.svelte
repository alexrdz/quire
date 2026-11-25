<script lang="ts">
	import type { ComponentProps } from 'svelte';
	// The Issue reader itself, not a copy: the preview renders exactly what Fans see.
	import IssueReaderPage from '../../../../../(zine)/i/[slug]/+page.svelte';

	let { data, form } = $props();

	/** The preview's actions only ever refuse, with the reader's own error fields. */
	type ReaderForm = ComponentProps<typeof IssueReaderPage>['form'];
</script>

<!-- The Artist's preview is never indexed (the response also sends X-Robots-Tag). -->
<svelte:head>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<IssueReaderPage {data} form={form as ReaderForm} />
