<script lang="ts">
	import { Stack, Box, Cluster } from '$lib/components/layout';
	import ZinePageShell from './ZinePageShell.svelte';
	import type { PageContent, PageShell } from './reader';

	interface Props {
		shell: PageShell;
		content: PageContent;
		venue: string;
	}

	let { shell, content, venue }: Props = $props();
</script>

<ZinePageShell {shell}>
	<Stack gap="xs">
		<span class="text-highlight font-mono eyebrow-small">{venue}</span>
		<h2 class="bespoke-heading">{content.title || "Tonight's Setlist"}</h2>
	</Stack>

	<Box variant="raised" padding="lg" radius="lg" class="setlist-card">
		<Stack gap="sm">
			{#each content.songs || ['Opener', 'New Track', 'Crowd Favorite', 'Encore'] as song, sIdx}
				<Cluster justify="between" align="center" class="song-row">
					<Cluster align="center" gap="sm">
						<span class="text-highlight font-mono song-num">
							{String(sIdx + 1).padStart(2, '0')}
						</span>
						<span class="song-title">{song}</span>
					</Cluster>
					<span class="text-muted font-mono song-tag">LIVE</span>
				</Cluster>
			{/each}
		</Stack>
	</Box>
</ZinePageShell>

<style>
	:global(.setlist-card) {
		border-color: var(--glass-border);
	}

	:global(.song-row) {
		padding-block-end: var(--space-2xs);
		border-block-end: 1px solid rgba(255, 255, 255, 0.07);
	}

	.song-num {
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
	}

	.song-title {
		font-weight: var(--weight-semibold);
		color: #ffffff;
	}

	.song-tag {
		font-size: var(--text-meta);
	}
</style>
