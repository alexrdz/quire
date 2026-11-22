<script lang="ts">
	import { Stack, Cluster } from '$lib/components/layout';
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
	<Stack gap="md" class="tour-diary-container">
		<header class="tour-diary-header">
			<Cluster justify="between" align="center" gap="xs" class="diary-meta-bar">
				<span class="diary-badge type-face">Tour Diary</span>
				<span class="diary-byline type-face">By {artistName}</span>
			</Cluster>
			<h2 class="bespoke-heading diary-heading">
				{content.title || (source === 'template' ? `About ${artistName}` : 'From the Road')}
			</h2>
		</header>

		<!-- The words are on an archival paper scrap taped to the page, within the ADR 0009 tilt for text. -->
		<Scrap position={shell.pageNumber} tone="light" class="text-scrap">
			<Tape placement={shell.pageNumber % 2 === 0 ? 'top-left' : 'top-right'} position={shell.pageNumber} />
			<div class="reading-measure">
				<p class="bespoke-body-text diary-prose">
					{content.body || 'Thank you for being here tonight with us in this room.'}
				</p>
			</div>
		</Scrap>
	</Stack>
</ZinePageShell>

<style>
	:global(.tour-diary-container) {
		inline-size: 100%;
		max-inline-size: 65ch;
		margin-inline: auto;
	}

	.tour-diary-header {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	:global(.diary-meta-bar) {
		inline-size: 100%;
		padding-block-end: var(--space-3xs);
		border-block-end: 1px solid rgba(255, 255, 255, 0.12);
	}

	.diary-badge {
		font-size: var(--text-meta);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: var(--highlight);
	}

	.diary-byline {
		font-size: var(--text-meta);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		color: #d4cfdc;
	}

	.diary-heading {
		font-size: var(--text-heading);
		font-weight: var(--weight-black);
		line-height: 1.15;
		color: var(--paper);
		letter-spacing: var(--tracking-tight);
	}

	:global(.text-scrap) {
		max-inline-size: 65ch;
		inline-size: 100%;
		/* Inset so the corner tape lands on the page, clear of its edge gutter. */
		margin-inline: auto;
		padding-block: var(--space-m);
		padding-inline: var(--space-m);
	}

	.reading-measure {
		max-inline-size: 65ch;
	}

	/* Dark ink on the light scrap; comfortable reading measure with editorial typography. */
	:global(.text-scrap) p.bespoke-body-text {
		color: var(--zine-scrap-light-ink);
		font-size: var(--step-0);
		line-height: 1.7;
		white-space: pre-wrap;
		overflow-wrap: break-word;
	}
</style>
