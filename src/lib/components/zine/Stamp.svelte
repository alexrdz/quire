<script lang="ts">
	import { zineTilt } from './reader';

	interface Props {
		label: string;
		tone?: 'highlight' | 'support' | 'accent' | 'plain';
		/** Picks the stamp's deterministic angle (short text, so it stays readable). */
		position?: number;
	}

	let { label, tone = 'highlight', position = 0 }: Props = $props();

	const tilt = $derived(zineTilt(position + 3, 4));
</script>

<span class="stamp stamp-{tone} type-face" style="--stamp-tilt: {tilt}deg;">{label}</span>

<style>
	/* An ink stamp: a double rule in the stamp's ink, with the ink broken up by grain. */
	.stamp {
		display: inline-flex;
		align-items: center;
		padding-block: var(--space-3xs);
		padding-inline: var(--space-2xs);
		border: 2px solid currentColor;
		border-radius: 3px;
		outline: 1px solid currentColor;
		outline-offset: 2px;
		font-size: var(--text-meta);
		letter-spacing: var(--tracking-label);
		line-height: 1.2;
		text-transform: uppercase;
		transform: rotate(var(--stamp-tilt));
		mask-image: var(--zine-ink-grain);
		mask-size: 120px 120px;
	}

	.stamp-highlight {
		color: var(--highlight);
	}

	.stamp-support {
		color: #ff6b9b;
	}

	.stamp-accent {
		color: var(--accent);
	}

	.stamp-plain {
		color: #e4e4e7;
	}
</style>
