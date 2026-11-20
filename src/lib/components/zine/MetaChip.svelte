<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ChipTone } from './reader';

	interface Props {
		tone?: ChipTone;
		children: Snippet;
	}

	let { tone, children }: Props = $props();
</script>

<span class="meta-chip {tone ? `meta-${tone}` : ''}">{@render children()}</span>

<style>
	.meta-chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-3xs);
		padding-block: var(--space-3xs);
		padding-inline: var(--space-2xs);
		border-radius: 4px;
		font-size: var(--text-meta);
		font-weight: var(--weight-bold);
		font-family: var(--font-mono);
		letter-spacing: var(--tracking-label);
		text-transform: uppercase;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.12);
		color: #e4e4e7;
	}

	.meta-chip.meta-highlight {
		background: rgba(1, 255, 195, 0.12);
		border-color: rgba(1, 255, 195, 0.35);
		color: var(--highlight);
	}

	.meta-chip.meta-accent {
		background: rgba(5, 217, 232, 0.12);
		border-color: rgba(5, 217, 232, 0.35);
		color: var(--accent);
	}

	.meta-chip.meta-support {
		background: rgba(255, 42, 109, 0.14);
		border-color: rgba(255, 42, 109, 0.4);
		color: #ff6b9b;
	}
</style>
